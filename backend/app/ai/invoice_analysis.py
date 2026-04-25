from __future__ import annotations

import json
import logging
import re
from typing import Any, Literal

import httpx
from pydantic import BaseModel, Field, ValidationError, field_validator

from app.ai.client import create_message, extract_text, messages_endpoint
from app.ai.tools import get_receipt_info, get_supplier_info


INVOICE_ANALYSIS_SYSTEM_PROMPT = """
You are an invoice risk analysis system.

Rules:
- You must use the provided tools before making a final decision.
- Compare the structured invoice data against the expected system data.
- Invoice data may include a compact extracted-text snippet from OCR or PDF parsing. Use it only as supporting evidence.
- Focus on mismatches, suspicious values, missing fields, fraud signals, and risky commercial terms.
- Return JSON only.
- Do not include markdown, commentary, or extra text outside the JSON object.
- Keep the summary short and operationally useful.
""".strip()

logger = logging.getLogger(__name__)


def _tool_schema(tool_obj: Any) -> dict[str, Any]:
    schema = (
        tool_obj.args_schema.model_json_schema()
        if getattr(tool_obj, "args_schema", None)
        else {"type": "object", "properties": {}}
    )
    schema.pop("title", None)
    return {
        "name": tool_obj.name,
        "description": tool_obj.description or "",
        "input_schema": schema,
    }


def _tool_result_content(value: Any) -> str:
    return json.dumps(value, default=str)


class InvoiceAnalysisIssue(BaseModel):
    type: Literal[
        "amount_mismatch",
        "missing_field",
        "bank_mismatch",
        "suspicious_value",
        "other",
    ]
    description: str = Field(..., min_length=1)
    severity: Literal["low", "medium", "high"]


class InvoiceAnalysisParsedLineItem(BaseModel):
    description: str | None = None
    unitPrice: float | None = Field(default=None, ge=0)
    quantity: float | None = Field(default=None, ge=0)
    lineTotal: float | None = Field(default=None, ge=0)


class InvoiceAnalysisParsedFields(BaseModel):
    invoiceNumber: str | None = None
    supplierName: str | None = None
    amount: float | None = Field(default=None, ge=0)
    currency: str | None = None
    quantity: float | None = Field(default=None, ge=0)
    unitPrice: float | None = Field(default=None, ge=0)
    subtotal: float | None = Field(default=None, ge=0)
    paymentTerms: str | None = None
    bankDetails: str | None = None
    lineItems: list[InvoiceAnalysisParsedLineItem] = Field(default_factory=list)

    @field_validator("currency", mode="before")
    @classmethod
    def _normalize_currency(cls, value: Any) -> Any:
        if value is None:
            return None

        if not isinstance(value, str):
            return value

        raw = value.strip()
        if not raw:
            return None

        normalized = raw.upper()

        direct_map = {
            "$": "USD",
            "RM": "MYR",
            "MYR": "MYR",
            "USD": "USD",
            "SGD": "SGD",
            "S$": "SGD",
            "£": "GBP",
            "GBP": "GBP",
            "€": "EUR",
            "EUR": "EUR",
            "THB": "THB",
            "IDR": "IDR",
            "JPY": "JPY",
            "CNY": "CNY",
            "RMB": "CNY",
            "CNH": "CNY",
        }

        if normalized in direct_map:
            return direct_map[normalized]

        if normalized == "¥":
            return None

        code_match = re.search(r"\b([A-Z]{3})\b", normalized)
        if code_match:
            return code_match.group(1)

        text_map = {
            "US DOLLAR": "USD",
            "US DOLLARS": "USD",
            "MALAYSIAN RINGGIT": "MYR",
            "SINGAPORE DOLLAR": "SGD",
            "SINGAPORE DOLLARS": "SGD",
            "POUND STERLING": "GBP",
            "BRITISH POUND": "GBP",
            "EURO": "EUR",
            "EUROS": "EUR",
            "JAPANESE YEN": "JPY",
            "CHINESE YUAN": "CNY",
            "RENMINBI": "CNY",
            "THAI BAHT": "THB",
            "INDONESIAN RUPIAH": "IDR",
        }

        compact = re.sub(r"\s+", " ", normalized)
        for phrase, code in text_map.items():
            if phrase in compact:
                return code

        return normalized


class InvoiceAnalysisResult(BaseModel):
    parsedInvoiceFields: InvoiceAnalysisParsedFields = Field(
        default_factory=InvoiceAnalysisParsedFields
    )
    riskLevel: Literal["low", "medium", "high"]
    issues: list[InvoiceAnalysisIssue] = Field(default_factory=list)
    summary: str = Field(..., min_length=1)
    confidence: float = Field(..., ge=0, le=1)

    @field_validator("confidence", mode="before")
    @classmethod
    def _normalize_confidence(cls, value: Any) -> Any:
        if isinstance(value, bool):
            return float(value)

        if isinstance(value, str):
            stripped = value.strip()
            try:
                value = float(stripped)
            except ValueError:
                return value

        if isinstance(value, (int, float)):
            numeric = float(value)
            if numeric > 1:
                numeric /= 100
            return max(0.0, min(1.0, numeric))

        return value


def _extract_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError(f"Model did not return a JSON object. Raw output: {text}")

    return json.loads(cleaned[start : end + 1])


def _compact_json(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=True, separators=(",", ":"), default=str)


def _normalize_issue_item(issue: Any) -> dict[str, Any]:
    allowed_types = {
        "amount_mismatch",
        "missing_field",
        "bank_mismatch",
        "suspicious_value",
        "other",
    }
    allowed_severities = {"low", "medium", "high"}

    if isinstance(issue, str):
        return {
            "type": "other",
            "description": issue,
            "severity": "medium",
        }

    if not isinstance(issue, dict):
        return {
            "type": "other",
            "description": str(issue),
            "severity": "medium",
        }

    issue_type = issue.get("type")
    if not isinstance(issue_type, str) or issue_type not in allowed_types:
        issue_type = "other"

    description = issue.get("description")
    if not isinstance(description, str) or not description.strip():
        fallback_parts = []
        for key in ("message", "detail", "reason", "text"):
            value = issue.get(key)
            if isinstance(value, str) and value.strip():
                fallback_parts.append(value.strip())
                break
        description = fallback_parts[0] if fallback_parts else "Issue detected."

    severity = issue.get("severity")
    if not isinstance(severity, str) or severity not in allowed_severities:
        severity = "medium"

    return {
        "type": issue_type,
        "description": description.strip(),
        "severity": severity,
    }


def _normalize_invoice_analysis_payload(payload: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(payload)
    issues = normalized.get("issues")

    if isinstance(issues, list):
        normalized["issues"] = [_normalize_issue_item(issue) for issue in issues]
    elif issues is None:
        normalized["issues"] = []
    else:
        normalized["issues"] = [_normalize_issue_item(issues)]

    return normalized


def _build_user_prompt(
    invoice_data: dict[str, Any],
    expected_data: dict[str, Any],
) -> str:
    return (
        "You are an invoice risk analysis system.\n\n"
        "Before deciding, call the available tools to inspect the live receipt and supplier context.\n"
        "You must call get_receipt_info first. If supplier context is available, also call get_supplier_info.\n\n"
        "You are given:\n\n"
        "1. Invoice data (actual values)\n"
        "2. Expected values from system records\n\n"
        "Invoice data may also include a short extracted-text snippet from the file. Use it as evidence when helpful.\n\n"
        "Your task:\n\n"
        "* Parse and repair as many invoice fields as possible from the extracted-text evidence\n"
        "* Compare actual vs expected\n"
        "* Detect inconsistencies or suspicious patterns\n"
        "* Identify missing or unusual fields\n"
        "* Assign a risk level\n\n"
        "Return ONLY valid JSON in this exact structure.\n"
        "The values shown below are examples of format only.\n"
        "Do NOT copy them.\n"
        "Always extract real values from Invoice Data and OCR text.\n\n"
        "{\n"
        '"parsedInvoiceFields": {\n'
        '"invoiceNumber": null,\n'
        '"supplierName": null,\n'
        '"amount": 3800,\n'
        '"currency": "USD",\n'
        '"quantity": 8,\n'
        '"unitPrice": 500,\n'
        '"subtotal": 4000,\n'
        '"paymentTerms": null,\n'
        '"bankDetails": "Bank Name; Account Number 123456789; Swift Code 12345",\n'
        '"lineItems": [\n'
        "{\n"
        '"description": "Item Description Here",\n'
        '"unitPrice": 500,\n'
        '"quantity": 2,\n'
        '"lineTotal": 1000\n'
        "}\n"
        "]\n"
        "},\n"
        '"riskLevel": "high",\n'
        '"issues": [\n'
        "{\n"
        '"type": "amount_mismatch",\n'
        '"description": "Actual amount differs from expected amount.",\n'
        '"severity": "high"\n'
        "}\n"
        "],\n"
        '"summary": "short explanation",\n'
        '"confidence": 0.92\n'
        "}\n\n"
        "Rules:\n\n"
        "* Do not copy the example values above.\n"
        "* Use actual invoice and OCR values from the provided Invoice Data.\n"
        "* Extract every field you can confidently find from the invoice text snippet and structured data.\n"
        "* Only leave a parsed field null if the value is truly absent or cannot be inferred with confidence.\n"
        "* If structured data says amount=0 or quantity=0 but OCR contains a real amount or quantity, trust OCR for parsedInvoiceFields.\n"
        "* If totals, quantities, unit prices, payment terms, bank details, or line items appear in the OCR text, include them in parsedInvoiceFields.\n"
        "* For amount, prefer Grand Total, Due Total, Amount Due, or Total Payable over SubTotal.\n"
        "* For subtotal, use SubTotal if present.\n"
        "* For quantity, sum line-item quantities if line items are present.\n"
        "* For unitPrice, use visible line-item unit prices when available.\n"
        "* For paymentTerms, extract terms such as Net 30, Net 15, Due on receipt, or Payable upon receipt.\n"
        "* For bankDetails, combine bank name, account number, account holder, SWIFT, and IBAN if present.\n"
        "* Currency may be any detected code, for example USD, MYR, SGD, CNY, JPY, EUR, GBP, THB, or IDR.\n"
        '* If only a symbol is detected: "$" may be USD unless context suggests otherwise; "RM" means MYR; "£" means GBP; "€" means EUR; "¥" is ambiguous, so return null unless context clearly indicates JPY or CNY.\n'
        "* If a field is not found, return null for that field.\n"
        "* Each item in 'issues' MUST be an object with type, description, and severity.\n"
        "* The 'type' must be one of: amount_mismatch, missing_field, bank_mismatch, suspicious_value, other.\n"
        "* The 'severity' must be one of: low, medium, high.\n"
        "* Do NOT return issues as plain strings.\n"
        "* Do NOT return arrays of text.\n"
        "* Return valid JSON only.\n"
        "* If everything matches -> riskLevel = low\n"
        "* If small mismatch -> medium\n"
        "* If critical mismatch -> high\n\n"
        "Invoice Data:\n"
        "<<<\n"
        f"{_compact_json(invoice_data)}\n"
        ">>>\n\n"
        "Expected Data:\n"
        "<<<\n"
        f"{_compact_json(expected_data)}\n"
        ">>>"
    )


async def _run_invoice_analysis_agent(
    *,
    invoice_data: dict[str, Any],
    expected_data: dict[str, Any],
) -> InvoiceAnalysisResult:
    tool_objects = [get_receipt_info]
    if invoice_data.get("supplierId"):
        tool_objects.append(get_supplier_info)

    tool_schemas = [_tool_schema(tool_obj) for tool_obj in tool_objects]
    tool_map = {tool_obj.name: tool_obj for tool_obj in tool_objects}

    invoice_lookup: dict[str, Any] = {}
    if invoice_data.get("id"):
        invoice_lookup["invoice_id"] = invoice_data["id"]
    if invoice_data.get("invoiceNumber"):
        invoice_lookup["invoice_number"] = invoice_data["invoiceNumber"]

    required_tool_text = (
        "Call get_receipt_info first using the invoice identifier from Invoice Data."
    )
    if invoice_data.get("supplierId"):
        required_tool_text += (
            " Then call get_supplier_info using supplier_id to confirm the linked supplier record."
        )

    messages: list[dict[str, Any]] = [
        {
            "role": "user",
            "content": (
                f"{required_tool_text}\n"
                "After the tool calls, return one valid JSON object only in the required schema.\n\n"
                f"{_build_user_prompt(invoice_data, expected_data)}"
            ),
        }
    ]

    for round_index in range(6):
        try:
            response = await create_message(
                messages=messages,
                system_prompt=INVOICE_ANALYSIS_SYSTEM_PROMPT,
                tools=tool_schemas,
                tool_choice={"type": "auto"},
                max_tokens=5000,
                temperature=0,
            )
            logger.info(
                "Invoice AI tool round completed invoice_id=%s round=%s stop_reason=%s",
                invoice_data.get("id"),
                round_index + 1,
                response.get("stop_reason"),
            )
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text
            raise RuntimeError(
                f"AI gateway returned {exc.response.status_code}. Response: {detail}"
            ) from exc
        except httpx.HTTPError as exc:
            endpoint = messages_endpoint()
            error_name = type(exc).__name__
            error_detail = str(exc).strip() or repr(exc)
            raise RuntimeError(
                f"Unable to reach AI gateway at {endpoint}. {error_name}: {error_detail}"
            ) from exc

        assistant_content = response.get("content", [])
        messages.append({"role": "assistant", "content": assistant_content})

        if response.get("stop_reason") == "tool_use":
            tool_result_blocks: list[dict[str, Any]] = []
            for block in assistant_content:
                if block.get("type") != "tool_use":
                    continue

                tool_name = block["name"]
                tool_input = dict(block.get("input", {}))
                if tool_name == "get_receipt_info":
                    tool_input = {**invoice_lookup, **tool_input}
                elif tool_name == "get_supplier_info" and invoice_data.get("supplierId"):
                    tool_input.setdefault("supplier_id", invoice_data["supplierId"])

                logger.info(
                    "Invoice AI calling tool invoice_id=%s tool=%s input=%s",
                    invoice_data.get("id"),
                    tool_name,
                    json.dumps(tool_input, default=str),
                )

                tool_obj = tool_map[tool_name]
                try:
                    tool_output = tool_obj.invoke(tool_input)
                    logger.info(
                        "Invoice AI tool success invoice_id=%s tool=%s",
                        invoice_data.get("id"),
                        tool_name,
                    )
                    tool_result_blocks.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block["id"],
                            "content": _tool_result_content(tool_output),
                        }
                    )
                except Exception as exc:
                    logger.exception(
                        "Invoice AI tool failed invoice_id=%s tool=%s",
                        invoice_data.get("id"),
                        tool_name,
                    )
                    tool_result_blocks.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block["id"],
                            "content": str(exc),
                            "is_error": True,
                        }
                    )

            messages.append({"role": "user", "content": tool_result_blocks})
            continue

        raw_text = extract_text(response)
        try:
            parsed = _normalize_invoice_analysis_payload(_extract_json_object(raw_text))
            return InvoiceAnalysisResult.model_validate(parsed)
        except (ValueError, ValidationError) as exc:
            messages.append(
                {
                    "role": "user",
                    "content": (
                        "Your previous reply was invalid. Reply again now with ONLY one valid JSON object "
                        "that matches the required schema exactly. Do not include any extra text."
                    ),
                }
            )
            if round_index == 5:
                raise RuntimeError(
                    f"Invoice analysis model returned invalid JSON. Raw output: {raw_text or response}"
                ) from exc

    raise RuntimeError("Invoice analysis exceeded the maximum tool-call rounds.")


async def analyze_invoice(
    *,
    invoice_data: dict[str, Any],
    expected_data: dict[str, Any],
) -> dict[str, Any]:
    logger.info(
        "Invoice AI analyze_invoice called endpoint=%s invoice_id=%s",
        messages_endpoint(),
        invoice_data.get("id"),
    )
    decision = await _run_invoice_analysis_agent(
        invoice_data=invoice_data,
        expected_data=expected_data,
    )

    logger.info(
        "GLM parsed response for invoice_id=%s: %s",
        invoice_data.get("id"),
        json.dumps(decision.model_dump(), default=str),
    )

    return decision.model_dump()
