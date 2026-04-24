from __future__ import annotations

import json
from statistics import mean
from typing import Any

import httpx
from pydantic import BaseModel, Field, ValidationError, field_validator
from sqlalchemy import case, desc, exists, select

from app.ai.client import create_message, extract_text, messages_endpoint
from app.ai.tools import (
    get_product_stock_and_target_price,
    get_product_stock_demand_trend,
    list_threshold_change_requests_for_sku,
    request_reorder_threshold_update,
    session_scope,
    table,
)


THRESHOLD_ANALYSIS_SYSTEM_PROMPT = """
You are a threshold analysis agent for a B2B restocking system.

Rules:
- You must use tools to inspect the SKU before making any recommendation.
- Always inspect both the current stock/threshold context and the demand history.
- Never write to the database yourself.
- Return only valid JSON that matches the requested schema.
- Never include markdown, tables, bullet lists, or explanatory prose outside the JSON object.
- Recommend a threshold change only when the data supports a meaningful adjustment.
- If there is no strong case to change the threshold, set should_create_request to false.
""".strip()


class ThresholdDecision(BaseModel):
    should_create_request: bool = Field(..., description="Whether a threshold change request should be created.")
    proposed_threshold: int | None = Field(default=None, ge=0)
    reason_type: str = Field(
        ...,
        description="Short machine-readable reason type such as demand_spike, demand_drop, lead_time_shift, bundle_opportunity, or new_product.",
    )
    reason_summary: str = Field(..., min_length=1)
    confidence: int = Field(..., ge=0, le=100)

    @field_validator("confidence", mode="before")
    @classmethod
    def _normalize_confidence(cls, value: Any) -> Any:
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, str):
            stripped = value.strip()
            try:
                value = float(stripped)
            except ValueError:
                return value

        if isinstance(value, (int, float)):
            numeric = float(value)
            if 0 <= numeric <= 1:
                numeric *= 100
            return int(round(numeric))

        return value


SUPPORTED_REASON_TYPES = {
    "demand_spike",
    "demand_drop",
    "lead_time_shift",
    "bundle_opportunity",
    "new_product",
}


def _tool_schema(tool_obj: Any) -> dict[str, Any]:
    schema = tool_obj.args_schema.model_json_schema() if tool_obj.args_schema else {"type": "object", "properties": {}}
    schema.pop("title", None)
    return {
        "name": tool_obj.name,
        "description": tool_obj.description or "",
        "input_schema": schema,
    }


def _tool_result_content(value: Any) -> str:
    return json.dumps(value, default=str)


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


def _trace_event(
    kind: str,
    message: str,
    **extra: Any,
) -> dict[str, Any]:
    event = {
        "kind": kind,
        "message": message,
    }
    event.update(extra)
    return event


def _safe_json(value: Any) -> Any:
    try:
        json.dumps(value, default=str)
        return value
    except Exception:
        return str(value)


def _summarize_tool_output(tool_name: str, tool_output: Any) -> str:
    if tool_name == "get_product_stock_and_target_price" and isinstance(tool_output, dict):
        product = tool_output.get("product", {})
        target_price = tool_output.get("target_price", {})
        target_band = "N/A"
        if isinstance(target_price, dict):
            low = target_price.get("min")
            high = target_price.get("max")
            if low is not None or high is not None:
                target_band = f"{low} to {high}"
        return (
            f"stock={product.get('current_stock')}, threshold={product.get('current_threshold')}, "
            f"status={product.get('status')}, target_price={target_band}"
        )

    if tool_name == "get_product_stock_demand_trend" and isinstance(tool_output, dict):
        trends = tool_output.get("trends", [])
        if isinstance(trends, list) and trends:
            latest = trends[-1]
            avg_demand = round(mean(int(row.get("demand", 0)) for row in trends), 2)
            return (
                f"months={len(trends)}, latest={latest.get('month')} stock={latest.get('stock')} "
                f"demand={latest.get('demand')}, average_demand={avg_demand}"
            )
        return "no demand trend rows returned"

    return json.dumps(tool_output, default=str)[:280]


def _candidate_skus(limit: int | None = None) -> list[str]:
    products = table("products")
    threshold_requests = table("threshold_change_requests")

    pending_exists = exists(
        select(threshold_requests.c.id).where(
            threshold_requests.c.product_id == products.c.id,
            threshold_requests.c.status == "pending",
        )
    )

    priority = case(
        (products.c.status == "below_threshold", 0),
        (products.c.status == "near_threshold", 1),
        (products.c.status == "batch_candidate", 2),
        else_=3,
    )

    with session_scope() as session:
        stmt = (
            select(products.c.sku)
            .where(~pending_exists)
            .order_by(priority.asc(), desc(products.c.updated_at), products.c.sku.asc())
        )
        if limit is not None:
            stmt = stmt.limit(limit)

        rows = session.execute(stmt).all()

    return [row[0] for row in rows]


def _normalize_reason_type(reason_type: str, *, current_threshold: int, proposed_threshold: int) -> str:
    cleaned = reason_type.strip().lower()
    if cleaned in SUPPORTED_REASON_TYPES:
        return cleaned
    return "demand_spike" if proposed_threshold > current_threshold else "demand_drop"


def _extract_created_threshold_request(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError(f"Threshold request tool returned a non-object payload: {payload!r}")

    request = payload.get("threshold_request")
    if request is None:
        request = payload.get("request")

    if not isinstance(request, dict):
        available_keys = ", ".join(sorted(str(key) for key in payload.keys())) or "<none>"
        raise ValueError(
            "Threshold request tool response did not include a request object. "
            f"Available keys: {available_keys}."
        )

    return request


async def _run_threshold_analysis_agent_for_sku(
    sku: str,
) -> tuple[ThresholdDecision, list[dict[str, Any]]]:
    tool_objects = [
        get_product_stock_and_target_price,
        get_product_stock_demand_trend,
    ]
    tool_schemas = [_tool_schema(tool_obj) for tool_obj in tool_objects]
    tool_map = {tool_obj.name: tool_obj for tool_obj in tool_objects}
    trace: list[dict[str, Any]] = [
        _trace_event(
            "agent",
            f"Starting agent analysis for {sku}.",
        )
    ]

    messages: list[dict[str, Any]] = [
        {
            "role": "user",
            "content": (
                f"Analyze SKU {sku} for reorder threshold review.\n"
                "Before deciding, call both get_product_stock_and_target_price and get_product_stock_demand_trend.\n"
                "Then return JSON with keys: should_create_request, proposed_threshold, reason_type, reason_summary, confidence.\n"
                "Use snake_case for reason_type.\n"
                "Do not include markdown, analysis notes, or any text before or after the JSON.\n"
                "If no threshold change is justified, set should_create_request=false and proposed_threshold to the current threshold or null."
            ),
        }
    ]

    for round_index in range(6):
        try:
            response = await create_message(
                messages=messages,
                system_prompt=THRESHOLD_ANALYSIS_SYSTEM_PROMPT,
                tools=tool_schemas,
                tool_choice={"type": "auto"},
                max_tokens=900,
                temperature=0,
            )
            trace.append(
                _trace_event(
                    "agent",
                    f"Model round {round_index + 1} completed with stop_reason={response.get('stop_reason')}.",
                )
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
                tool_input = block.get("input", {})
                tool_obj = tool_map[tool_name]
                trace.append(
                    _trace_event(
                        "tool_call",
                        f"Calling {tool_name}.",
                        tool_name=tool_name,
                        tool_input=_safe_json(tool_input),
                    )
                )

                try:
                    tool_output = tool_obj.invoke(tool_input)
                    trace.append(
                        _trace_event(
                            "tool_result",
                            f"{tool_name} returned successfully.",
                            tool_name=tool_name,
                            tool_input=_safe_json(tool_input),
                            tool_summary=_summarize_tool_output(tool_name, tool_output),
                        )
                    )
                    tool_result_blocks.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block["id"],
                            "content": _tool_result_content(tool_output),
                        }
                    )
                except Exception as exc:
                    trace.append(
                        _trace_event(
                            "tool_error",
                            f"{tool_name} failed: {exc}",
                            tool_name=tool_name,
                            tool_input=_safe_json(tool_input),
                        )
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
            decision_payload = _extract_json_object(raw_text)
            decision = ThresholdDecision.model_validate(decision_payload)
            trace.append(
                _trace_event(
                    "decision",
                    "Model returned a threshold decision.",
                    decision=_safe_json(decision_payload),
                )
            )
            return decision, trace
        except (ValueError, ValidationError) as exc:
            trace.append(
                _trace_event(
                    "agent",
                    "Model response was not valid JSON. Requesting a strict JSON retry.",
                    raw_output_preview=raw_text[:400],
                )
            )
            messages.append(
                {
                    "role": "user",
                    "content": (
                        "Your previous reply was invalid because it was not a single valid JSON object. "
                        "Reply again now with ONLY one compact JSON object and nothing else. "
                        "Required keys: should_create_request, proposed_threshold, reason_type, "
                        "reason_summary, confidence."
                    ),
                }
            )
            if round_index == 5:
                raise ValueError(f"Model returned invalid threshold decision JSON: {exc}") from exc

    raise RuntimeError("Threshold analysis exceeded the maximum tool-call rounds.")


async def run_threshold_analysis(
    *,
    skus: list[str] | None = None,
    limit: int | None = None,
) -> dict[str, Any]:
    candidate_skus = skus or _candidate_skus(limit)
    results: list[dict[str, Any]] = []

    for sku in candidate_skus:
        trace: list[dict[str, Any]] = [
            _trace_event("backend", f"Selected {sku} for threshold analysis.")
        ]
        current_snapshot = get_product_stock_and_target_price.invoke({"sku": sku})
        current_threshold = int(current_snapshot["product"]["current_threshold"])
        trace.append(
            _trace_event(
                "backend",
                "Loaded current stock snapshot before agent run.",
                tool_name="get_product_stock_and_target_price",
                tool_summary=_summarize_tool_output(
                    "get_product_stock_and_target_price",
                    current_snapshot,
                ),
            )
        )

        existing_requests = list_threshold_change_requests_for_sku.invoke(
            {"sku": sku, "status": "pending"}
        )
        pending_requests = existing_requests.get("requests", [])
        if pending_requests:
            trace.append(
                _trace_event(
                    "backend",
                    "Skipped because a pending threshold request already exists.",
                )
            )
            results.append(
                {
                    "sku": sku,
                    "product_name": current_snapshot["product"]["name"],
                    "status": "skipped_existing_pending_request",
                    "current_threshold": None,
                    "proposed_threshold": None,
                    "confidence": None,
                    "detail": "A pending threshold change request already exists for this SKU.",
                    "trace": trace,
                }
            )
            continue

        try:
            decision, agent_trace = await _run_threshold_analysis_agent_for_sku(sku)
            trace.extend(agent_trace)
        except Exception as exc:
            trace.append(
                _trace_event(
                    "backend",
                    f"Analysis failed before decision write: {exc}",
                )
            )
            results.append(
                {
                    "sku": sku,
                    "product_name": current_snapshot["product"]["name"],
                    "status": "analysis_failed",
                    "current_threshold": current_threshold,
                    "proposed_threshold": None,
                    "confidence": None,
                    "detail": str(exc),
                    "trace": trace,
                }
            )
            continue

        proposed_threshold = (
            current_threshold
            if decision.proposed_threshold is None
            else int(decision.proposed_threshold)
        )

        if not decision.should_create_request:
            results.append(
                {
                    "sku": sku,
                    "product_name": current_snapshot["product"]["name"],
                    "status": "no_change_recommended",
                    "current_threshold": current_threshold,
                    "proposed_threshold": proposed_threshold,
                    "confidence": decision.confidence,
                    "detail": decision.reason_summary,
                    "trace": trace,
                }
            )
            continue

        if proposed_threshold == current_threshold:
            trace.append(
                _trace_event(
                    "backend",
                    "No database write needed because proposed threshold equals current threshold.",
                )
            )
            results.append(
                {
                    "sku": sku,
                    "product_name": current_snapshot["product"]["name"],
                    "status": "no_change_recommended",
                    "current_threshold": current_threshold,
                    "proposed_threshold": proposed_threshold,
                    "confidence": decision.confidence,
                    "detail": "Model did not recommend a threshold different from the current value.",
                    "trace": trace,
                }
            )
            continue

        try:
            created_request_payload = request_reorder_threshold_update.invoke(
                {
                    "sku": sku,
                    "proposed_threshold": proposed_threshold,
                    "reason_type": _normalize_reason_type(
                        decision.reason_type,
                        current_threshold=current_threshold,
                        proposed_threshold=proposed_threshold,
                    ),
                    "reason_summary": decision.reason_summary,
                    "old_threshold": current_threshold,
                    "requested_by": "ai",
                }
            )
            created_request = _extract_created_threshold_request(created_request_payload)
        except Exception as exc:
            trace.append(
                _trace_event(
                    "backend",
                    f"Threshold request write failed: {exc}",
                )
            )
            results.append(
                {
                    "sku": sku,
                    "product_name": current_snapshot["product"]["name"],
                    "status": "analysis_failed",
                    "current_threshold": current_threshold,
                    "proposed_threshold": proposed_threshold,
                    "confidence": decision.confidence,
                    "detail": f"Threshold request write failed: {exc}",
                    "trace": trace,
                }
            )
            continue

        trace.append(
            _trace_event(
                "write",
                "Created threshold change request in the backend.",
                proposed_threshold=proposed_threshold,
                request_id=created_request["id"],
            )
        )

        results.append(
            {
                "sku": sku,
                "product_name": current_snapshot["product"]["name"],
                "status": "request_created",
                "current_threshold": current_threshold,
                "proposed_threshold": proposed_threshold,
                "confidence": decision.confidence,
                "detail": decision.reason_summary,
                "request": created_request,
                "trace": trace,
            }
        )

    return {
        "analyzed_count": len(candidate_skus),
        "created_count": len([item for item in results if item["status"] == "request_created"]),
        "skipped_count": len([item for item in results if item["status"] != "request_created"]),
        "results": results,
    }
