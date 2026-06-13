from __future__ import annotations

import json
from typing import Any

import httpx

from app.ai.client import create_message, extract_text, messages_endpoint
from app.ai.tools import (
    get_last_supplier_conversation_messages,
    get_product_operational_context,
    get_receipt_info,
    get_supplier_info,
)


SYSTEM_PROMPT = """
You are the Autonomous B2B Restocking and Settlement Copilot for a merchant operations team.

Stay grounded in the supplied business context. If the context is missing or incomplete, say so clearly instead of inventing facts.
Prioritize operationally useful answers about:
- stock and reorder risk,
- supplier negotiation progress,
- invoice and receipt validation risk,
- concrete next actions for the merchant team.

Keep answers concise, practical, and decision-oriented.
If the user asks for a supplier-facing message and the context includes a supplier preferred language,
write that message in the supplier's preferred language label/code.
If the language is missing, default to English.
Preserve product names, company names, SKU values, prices, quantities, delivery dates, currency codes, invoice numbers, and payment terms exactly.
Supplier-facing messages should sound like a real procurement teammate wrote them:
- warm, polite, commercially natural, and specific to the supplier's last message,
- not templated, robotic, or overly formal,
- clear about the ask, counter-offer, acceptance, delivery expectation, or next document needed,
- never mentioning AI, automation, tools, prompts, internal reasoning, or database records.
""".strip()


def _json_ready(value: Any) -> Any:
    return json.loads(json.dumps(value, default=str))


def build_context(
    *,
    sku: str | None = None,
    invoice_id: str | None = None,
    invoice_number: str | None = None,
    supplier_id: str | None = None,
    conversation_id: str | None = None,
    conversation_limit: int = 5,
) -> tuple[dict[str, Any], list[str]]:
    context: dict[str, Any] = {}
    sources: list[str] = []

    if sku:
        context["product_operational_context"] = _json_ready(
            get_product_operational_context.invoke({"sku": sku})
        )
        sources.append("get_product_operational_context")

    if invoice_id or invoice_number:
        invoice_payload: dict[str, str] = {}
        if invoice_id:
            invoice_payload["invoice_id"] = invoice_id
        if invoice_number:
            invoice_payload["invoice_number"] = invoice_number
        context["receipt_info"] = _json_ready(get_receipt_info.invoke(invoice_payload))
        sources.append("get_receipt_info")

    if supplier_id:
        context["supplier_profile"] = _json_ready(
            get_supplier_info.invoke({"supplier_id": supplier_id})
        )
        sources.append("get_supplier_info")

    if supplier_id or conversation_id:
        conversation_payload: dict[str, Any] = {"limit": conversation_limit}
        if supplier_id:
            conversation_payload["supplier_id"] = supplier_id
        if conversation_id:
            conversation_payload["conversation_id"] = conversation_id
        context["conversation_buffer"] = _json_ready(
            get_last_supplier_conversation_messages.invoke(conversation_payload)
        )
        sources.append("get_last_supplier_conversation_messages")

    return context, sources


async def generate_copilot_response(
    *,
    prompt: str,
    sku: str | None = None,
    invoice_id: str | None = None,
    invoice_number: str | None = None,
    supplier_id: str | None = None,
    conversation_id: str | None = None,
    conversation_limit: int = 5,
) -> dict[str, Any]:
    context, sources = build_context(
        sku=sku,
        invoice_id=invoice_id,
        invoice_number=invoice_number,
        supplier_id=supplier_id,
        conversation_id=conversation_id,
        conversation_limit=conversation_limit,
    )

    grounded_prompt = (
        "User request:\n"
        f"{prompt.strip()}\n\n"
        "Business context (JSON):\n"
        f"{json.dumps(context, indent=2, default=str)}"
    )

    try:
        model_response = await create_message(
            prompt=grounded_prompt,
            system_prompt=SYSTEM_PROMPT,
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
            f"Unable to reach AI gateway at {endpoint}. "
            f"{error_name}: {error_detail}"
        ) from exc

    return {
        "answer": extract_text(model_response),
        "raw_response": model_response,
        "context": context,
        "sources": sources,
    }
