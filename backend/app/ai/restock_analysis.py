from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select

from app.ai.client import create_message, extract_ai_text
from app.ai.tools import (
    get_product_stock_and_target_price,
    get_product_stock_demand_trend,
    get_supplier_info,
    create_restock_request,
    session_scope,
    table,
)


RESTOCK_ANALYSIS_SYSTEM_PROMPT = """
You are an AI inventory decision agent for a B2B procurement system.

Your task is to analyze stock data and decide whether restocking is required.
""".strip()

USER_FRIENDLY_FALLBACK_REASON = (
    "AI recommendation unavailable, fallback generated from stock threshold, MOQ, and lead time."
)
EMPTY_RESPONSE_FALLBACK_REASON = "Fallback used because AI returned an empty response."
JSON_PARSE_FALLBACK_REASON = "Fallback used because AI returned invalid JSON."
INVALID_SCHEMA_FALLBACK_REASON = "Fallback used because AI returned an incomplete recommendation."


class RestockDecision(BaseModel):
    should_restock: bool = True
    requested_quantity: int = Field(..., ge=1, description="Recommended number of units to restock.")
    target_price_min: float = Field(..., ge=0, description="Lower bound of target price range.")
    target_price_max: float = Field(..., ge=0, description="Upper bound of target price range.")
    confidence: str = Field(default="medium", min_length=1)
    reason_summary: str = Field(..., min_length=1, description="Justification for the restock quantity and price.")
    source: str = Field(default="ai")
    ai_error: str | None = None

    @field_validator("target_price_max")
    @classmethod
    def _validate_price_range(cls, v: float, info: Any) -> float:
        if "target_price_min" in info.data and v < info.data["target_price_min"]:
            raise ValueError("target_price_max cannot be less than target_price_min")
        return v


class RestockAIOutput(BaseModel):
    should_restock: bool
    requested_quantity: int = Field(..., ge=0)
    target_price_min: float = Field(..., ge=0)
    target_price_max: float = Field(..., ge=0)
    confidence: str = Field(..., min_length=1)
    reason_summary: str = Field(..., min_length=1)
    source: str = Field(default="ai")
    ai_error: str | None = None

    @field_validator("target_price_max")
    @classmethod
    def _validate_ai_price_range(cls, v: float, info: Any) -> float:
        if "target_price_min" in info.data and v < info.data["target_price_min"]:
            raise ValueError("target_price_max cannot be less than target_price_min")
        return v


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
        return f"stock={product.get('current_stock')}, threshold={product.get('current_threshold')}, capacity={product.get('max_capacity', 'N/A')}"
    
    if tool_name == "get_supplier_info" and isinstance(tool_output, dict):
        supplier = tool_output.get("supplier", {})
        return f"name={supplier.get('name')}, lead_time={supplier.get('lead_time_days')}, moq={supplier.get('moq')}"

    return json.dumps(tool_output, default=str)[:280]


def _build_structured_prompt(
    *,
    current_stock: int,
    threshold: int,
    sales_30: int,
    trend: str,
    lead_time: int | None,
) -> str:
    return f"""Given this product context:
{{
  "current_stock": {current_stock},
  "current_threshold": {threshold},
  "sales_last_30_days": {sales_30},
  "sales_trend": "{trend}",
  "supplier_lead_time_days": {lead_time if lead_time is not None else "null"}
}}

Return exactly this JSON schema:
{{
  "should_restock": true,
  "requested_quantity": 300,
  "target_price_min": 10,
  "target_price_max": 20,
  "confidence": "medium",
  "reason_summary": "Stock is below threshold and demand is stable."
}}

Rules:
- Return valid JSON only
- No markdown
- reason_summary must be one short sentence"""


def _extract_sales_30(trend_snapshot: dict[str, Any]) -> int:
    summary = trend_snapshot.get("trend_summary", {})
    latest_demand = summary.get("latest_demand")
    if latest_demand is not None:
        return int(latest_demand)

    points = summary.get("points", [])
    if points:
        return int(points[-1].get("demand") or 0)

    return 0


def _extract_trend_label(trend_snapshot: dict[str, Any]) -> str:
    points = trend_snapshot.get("trend_summary", {}).get("points", [])
    if len(points) < 2:
        return trend_snapshot.get("source", "unknown")

    first = int(points[0].get("demand") or 0)
    last = int(points[-1].get("demand") or 0)
    if last > first:
        return "upward"
    if last < first:
        return "downward"
    return "stable"


def _fallback_ai_output(
    *,
    current_stock: int,
    threshold: int,
    sales_30: int,
    trend: str,
    lead_time_days: int | None,
    unit_price: float,
    moq: int,
    max_capacity: int | None,
    ai_error: str | None = None,
) -> RestockAIOutput:
    base_qty = max(threshold - current_stock, moq, 0)
    if max_capacity is not None:
        base_qty = min(max(0, max_capacity - current_stock), base_qty)

    should_restock = current_stock < threshold
    requested_quantity = max(1, base_qty) if should_restock else 0
    deficit = max(0, threshold - current_stock)
    lead_time_phrase = (
        f"the supplier lead time is {lead_time_days} days"
        if lead_time_days is not None
        else "supplier lead time is currently unknown"
    )
    trend_phrase = (
        f"sales over the last 30 days reached {sales_30} units with a {trend} trend"
        if sales_30 > 0
        else f"demand is showing a {trend} trend"
    )
    reason_summary = (
        f"Current stock is {deficit} units below the threshold of {threshold}, "
        f"{trend_phrase}, and {lead_time_phrase}, so restocking {requested_quantity} units "
        f"is recommended to reduce stockout risk."
    )
    return RestockAIOutput(
        should_restock=should_restock,
        requested_quantity=requested_quantity,
        target_price_min=round(unit_price * 0.95, 2),
        target_price_max=round(unit_price * 1.05, 2),
        confidence="low",
        reason_summary=reason_summary,
        source="fallback",
        ai_error=ai_error,
    )


def _normalize_ai_payload(data: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(data)
    if "requested_quantity" not in normalized and "recommended_quantity" in normalized:
        normalized["requested_quantity"] = normalized["recommended_quantity"]
    if "reason_summary" not in normalized and "reason" in normalized:
        normalized["reason_summary"] = normalized["reason"]
    return normalized


def _clean_ai_json_text(ai_output: str) -> dict[str, Any]:
    cleaned = (ai_output or "").strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:].strip()
    if cleaned.startswith("```"):
        cleaned = cleaned[3:].strip()
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("No JSON object found in AI output.")

    return json.loads(cleaned[start : end + 1])


async def run_restock_ai_smoke_test() -> dict[str, Any]:
    prompt = 'Return exactly this JSON: {"ok":true}'
    response = await create_message(
        prompt=prompt,
        system_prompt="Return valid JSON only. No markdown.",
        model="gemini-2.5-flash",
        max_tokens=64,
        temperature=0,
    )
    ai_output = extract_ai_text(response)
    print("SMOKE TEST RAW CONTENT:", repr(ai_output))
    parsed = _clean_ai_json_text(ai_output)
    return {
        "raw_response": response,
        "raw_content": ai_output,
        "parsed": parsed,
        "ok": parsed.get("ok") is True,
    }


def _validate_required_fields(payload: dict[str, Any]) -> list[str]:
    required_fields = [
        "should_restock",
        "requested_quantity",
        "target_price_min",
        "target_price_max",
        "confidence",
        "reason_summary",
    ]
    return [field for field in required_fields if field not in payload]


def _low_stock_skus() -> list[str]:
    products = table("products")
    with session_scope() as session:
        stmt = select(products.c.sku).where(products.c.current_stock < products.c.current_threshold)
        rows = session.execute(stmt).all()
    return [row[0] for row in rows]


async def _run_restock_analysis_agent_for_sku(
    sku: str,
) -> tuple[RestockDecision, list[dict[str, Any]]]:
    trace: list[dict[str, Any]] = [
        _trace_event("agent", f"Starting restock analysis for {sku}.")
    ]

    product_snapshot = get_product_stock_and_target_price.invoke({"sku": sku})
    trend_snapshot = get_product_stock_demand_trend.invoke({"sku": sku})
    supplier_snapshot = get_supplier_info.invoke({"product_sku": sku})

    trace.append(
        _trace_event(
            "tool_result",
            "Fetched product snapshot",
            tool_name="get_product_stock_and_target_price",
            tool_summary=_summarize_tool_output("get_product_stock_and_target_price", product_snapshot),
        )
    )
    trace.append(
        _trace_event(
            "tool_result",
            "Fetched demand trend",
            tool_name="get_product_stock_demand_trend",
            tool_summary=_summarize_tool_output("get_product_stock_demand_trend", trend_snapshot),
        )
    )
    trace.append(
        _trace_event(
            "tool_result",
            "Fetched supplier info",
            tool_name="get_supplier_info",
            tool_summary=_summarize_tool_output("get_supplier_info", supplier_snapshot),
        )
    )

    product = product_snapshot.get("product", {})
    supplier = supplier_snapshot.get("supplier", {})
    current_stock = int(product.get("current_stock") or 0)
    threshold = int(product.get("current_threshold") or 0)
    unit_price = float(product.get("unit_price") or 0)
    max_capacity = product.get("max_capacity")
    moq = int(supplier.get("moq") or 0)
    sales_30 = _extract_sales_30(trend_snapshot)
    trend = _extract_trend_label(trend_snapshot)
    lead_time = supplier.get("lead_time_days")
    lead_time_int = int(lead_time) if lead_time is not None else None

    prompt = _build_structured_prompt(
        current_stock=current_stock,
        threshold=threshold,
        sales_30=sales_30,
        trend=trend,
        lead_time=lead_time_int,
    )
    print("PROMPT SENT:", prompt)

    try:
        response = await create_message(
            prompt=prompt,
            system_prompt="You are a restock planning assistant. Return valid JSON only. No markdown.",
            model="gemini-2.5-flash",
            max_tokens=512,
            temperature=0,
        )
    except Exception as exc:
        raise RuntimeError(f"AI call failed: {exc}") from exc

    ai_output = extract_ai_text(response)
    if not ai_output:
        print("[AI WARNING] Empty response received")
    print("AI RAW CONTENT:", repr(ai_output))

    try:
        if not ai_output:
            raise ValueError("AI output was empty.")
        decision_payload = _normalize_ai_payload(_clean_ai_json_text(ai_output))
    except Exception as exc:
        print("AI PARSE ERROR:", exc)
        fallback = _fallback_ai_output(
            current_stock=current_stock,
            threshold=threshold,
            sales_30=sales_30,
            trend=trend,
            lead_time_days=lead_time_int,
            unit_price=unit_price,
            moq=moq,
            max_capacity=int(max_capacity) if max_capacity is not None else None,
            ai_error=str(exc),
        )
        trace.append(
            _trace_event(
                "backend",
                "Used fallback due to AI parse error.",
                failure_reason="empty_response" if not ai_output else "json_parse_failed",
                parse_error=str(exc),
                raw_response=ai_output,
            )
        )
        return fallback, trace

    if not isinstance(decision_payload, dict):
        fallback = _fallback_ai_output(
            current_stock=current_stock,
            threshold=threshold,
            sales_30=sales_30,
            trend=trend,
            lead_time_days=lead_time_int,
            unit_price=unit_price,
            moq=moq,
            max_capacity=int(max_capacity) if max_capacity is not None else None,
            ai_error="non_object_response",
        )
        trace.append(
            _trace_event(
                "backend",
                "Used fallback due to non-object AI response.",
                failure_reason="json_parse_failed",
                raw_response=decision_payload,
            )
        )
        return fallback, trace

    missing_fields = _validate_required_fields(decision_payload)
    if missing_fields:
        fallback = _fallback_ai_output(
            current_stock=current_stock,
            threshold=threshold,
            sales_30=sales_30,
            trend=trend,
            lead_time_days=lead_time_int,
            unit_price=unit_price,
            moq=moq,
            max_capacity=int(max_capacity) if max_capacity is not None else None,
            ai_error=f"missing_fields:{','.join(missing_fields)}",
        )
        trace.append(
            _trace_event(
                "backend",
                "Used fallback due to missing AI fields.",
                failure_reason="invalid_schema",
                missing_fields=missing_fields,
                raw_response=decision_payload,
            )
        )
        return fallback, trace

    try:
        ai_decision = RestockAIOutput.model_validate(decision_payload)
    except Exception as exc:
        print("AI PARSE ERROR:", exc)
        fallback = _fallback_ai_output(
            current_stock=current_stock,
            threshold=threshold,
            sales_30=sales_30,
            trend=trend,
            lead_time_days=lead_time_int,
            unit_price=unit_price,
            moq=moq,
            max_capacity=int(max_capacity) if max_capacity is not None else None,
            ai_error=str(exc),
        )
        trace.append(
            _trace_event(
                "backend",
                "Used fallback due to AI validation error.",
                failure_reason="invalid_schema",
                validation_error=str(exc),
                raw_response=decision_payload,
            )
        )
        return fallback, trace

    decision = RestockDecision(
        should_restock=ai_decision.should_restock,
        requested_quantity=max(1, ai_decision.requested_quantity),
        target_price_min=ai_decision.target_price_min,
        target_price_max=ai_decision.target_price_max,
        confidence=ai_decision.confidence,
        reason_summary=ai_decision.reason_summary,
        source="ai",
        ai_error=None,
    )
    trace.append(
        _trace_event(
            "agent",
            "AI decision parsed successfully.",
            decision=_safe_json(decision_payload),
        )
    )
    return decision, trace


async def run_restock_analysis() -> dict[str, Any]:
    skus = _low_stock_skus()
    results = []
    
    for sku in skus:
        trace = [_trace_event("backend", f"Selected {sku} for restock analysis.")]
        
        # Fetch product data for name and fallback
        current_snapshot = get_product_stock_and_target_price.invoke({"sku": sku})
        p = current_snapshot["product"]

        # Check for existing pending/reviewed requests
        restock_requests_table = table("restock_requests")
        with session_scope() as session:
            products_table = table("products")
            pid_stmt = select(products_table.c.id).where(products_table.c.sku == sku)
            pid = session.execute(pid_stmt).scalar()
            
            if pid:
                existing_stmt = select(restock_requests_table.c.id).where(
                    restock_requests_table.c.product_id == pid,
                    restock_requests_table.c.status.in_(["pending", "reviewed", "accepted"])
                )
                if session.execute(existing_stmt).first():
                    results.append({
                        "sku": sku,
                        "product_name": p["name"],
                        "status": "skipped_existing",
                        "detail": "Already has a pending or active restock request."
                    })
                    continue

        try:
            decision, agent_trace = await _run_restock_analysis_agent_for_sku(sku)
            trace.extend(agent_trace)
        except Exception as exc:
            # Fallback
            moq = 0
            supplier_info: dict[str, Any] = {}
            try:
                supplier_info = get_supplier_info.invoke({"product_sku": sku})
                moq = supplier_info["supplier"].get("moq") or 0
            except: pass

            current_stock = int(p.get("current_stock") or 0)
            current_threshold = int(p.get("current_threshold") or 0)
            max_capacity = p.get("max_capacity")
            base_qty = max(current_threshold - current_stock, int(moq))
            trend_snapshot = get_product_stock_demand_trend.invoke({"sku": sku})
            sales_30 = _extract_sales_30(trend_snapshot)
            trend = _extract_trend_label(trend_snapshot)
            lead_time_days = supplier_info.get("supplier", {}).get("lead_time_days")

            if max_capacity is not None:
                available_capacity = max(0, int(max_capacity) - current_stock)
                qty = min(available_capacity, base_qty)
            else:
                qty = base_qty

            fallback_decision = _fallback_ai_output(
                current_stock=current_stock,
                threshold=current_threshold,
                sales_30=sales_30,
                trend=trend,
                lead_time_days=int(lead_time_days) if lead_time_days is not None else None,
                unit_price=float(p["unit_price"]),
                moq=int(moq),
                max_capacity=int(max_capacity) if max_capacity is not None else None,
                ai_error=str(exc),
            )

            decision = RestockDecision(
                should_restock=fallback_decision.should_restock,
                requested_quantity=max(1, qty),
                target_price_min=fallback_decision.target_price_min,
                target_price_max=fallback_decision.target_price_max,
                confidence=fallback_decision.confidence,
                reason_summary=fallback_decision.reason_summary,
                source="fallback",
                ai_error=str(exc),
            )
            trace.append(_trace_event("backend", "Used fallback logic.", error=str(exc)))

        should_restock = getattr(decision, "should_restock", True)
        if not should_restock:
            results.append({
                "sku": sku,
                "product_name": p["name"],
                "status": "no_change_recommended",
                "detail": decision.reason_summary,
                "reason_summary": decision.reason_summary,
                "source": decision.source,
                "ai_error": decision.ai_error,
                "trace": trace,
            })
            continue

        # Create request
        try:
            write_res = create_restock_request.invoke({
                "sku": sku,
                "requested_quantity": decision.requested_quantity,
                "target_price_min": decision.target_price_min,
                "target_price_max": decision.target_price_max,
                "reason_summary": decision.reason_summary,
                "requested_by": "ai"
            })
            results.append({
                "sku": sku,
                "product_name": p["name"],
                "status": "request_created",
                "detail": decision.reason_summary,
                "reason_summary": decision.reason_summary,
                "source": decision.source,
                "ai_error": decision.ai_error,
                "request": write_res,
                "trace": trace,
            })
        except Exception as exc:
            results.append({
                "sku": sku,
                "product_name": p["name"],
                "status": "error",
                "detail": str(exc),
                "reason_summary": decision.reason_summary,
                "source": decision.source,
                "ai_error": decision.ai_error,
                "trace": trace,
            })

    return {
        "success": True,
        "created_count": len([r for r in results if r["status"] == "request_created"]),
        "results": results
    }
