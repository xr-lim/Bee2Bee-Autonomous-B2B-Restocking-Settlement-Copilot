from __future__ import annotations

import os
import uuid
from contextlib import contextmanager
from datetime import date, datetime
from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv
from langchain_core.tools import tool
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import MetaData, Table, create_engine, desc, func, insert, select, update
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker


JsonValue = dict[str, Any] | list[Any] | str | int | float | bool | None

_MODULE_DIR = Path(__file__).resolve().parent
_BACKEND_ROOT = _MODULE_DIR.parents[1]
load_dotenv(_BACKEND_ROOT / ".env.local")
load_dotenv(_BACKEND_ROOT / ".env")


def _database_url() -> str:
    return (
        os.getenv("DATABASE_URL")
        or os.getenv("SUPABASE_DB_URL")
        or ""
    ).strip()


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    """Return a cached SQLAlchemy engine bound to the configured database.

    The tools in this module are meant to run against the real Supabase/Postgres
    database. The engine is created lazily so the module can be imported even if
    the environment variable is not set yet.
    """

    database_url = _database_url()
    if not database_url:
        raise RuntimeError(
            "Missing DATABASE_URL or SUPABASE_DB_URL. Set one of them before using the LangChain tools."
        )

    return create_engine(database_url, pool_pre_ping=True)


@lru_cache(maxsize=1)
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, autocommit=False)


@contextmanager
def session_scope():
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()


metadata = MetaData(schema="public")


@lru_cache(maxsize=None)
def table(name: str) -> Table:
    return Table(name, metadata, schema="public", autoload_with=get_engine())


def _json_ready(value: Any) -> JsonValue:
    if isinstance(value, dict):
        return {key: _json_ready(nested) for key, nested in value.items()}
    if isinstance(value, list):
        return [_json_ready(item) for item in value]
    if isinstance(value, tuple):
        return [_json_ready(item) for item in value]
    if isinstance(value, set):
        return [_json_ready(item) for item in value]
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    return value


def _row_to_dict(row: Any) -> dict[str, Any]:
    return dict(_json_ready(dict(row)))


def _normalize_text(value: str) -> str:
    return value.strip().lower()


def _resolve_product(session: Session, sku: str) -> dict[str, Any]:
    products = table("products")
    row = session.execute(
        select(products).where(func.lower(products.c.sku) == _normalize_text(sku))
    ).mappings().first()

    if not row:
        raise ValueError(f"No product found for SKU '{sku}'.")

    return dict(row)


def _resolve_supplier(
    session: Session,
    supplier_id: str | None = None,
    supplier_name: str | None = None,
    product_sku: str | None = None,
) -> dict[str, Any]:
    suppliers = table("suppliers")
    products = table("products")
    product_suppliers = table("product_suppliers")

    if supplier_id:
        row = session.execute(
            select(suppliers).where(suppliers.c.id == supplier_id)
        ).mappings().first()
        if row:
            return dict(row)

    if supplier_name:
        row = session.execute(
            select(suppliers).where(func.lower(suppliers.c.name) == _normalize_text(supplier_name))
        ).mappings().first()
        if row:
            return dict(row)

    if product_sku:
        product = _resolve_product(session, product_sku)
        primary_supplier_id = product.get("primary_supplier_id")
        if primary_supplier_id:
            row = session.execute(
                select(suppliers).where(suppliers.c.id == primary_supplier_id)
            ).mappings().first()
            if row:
                return dict(row)

        linked_supplier = session.execute(
            select(suppliers)
            .select_from(product_suppliers.join(suppliers, product_suppliers.c.supplier_id == suppliers.c.id))
            .where(product_suppliers.c.product_id == product["id"])
            .order_by(desc(product_suppliers.c.is_primary), suppliers.c.name)
        ).mappings().first()
        if linked_supplier:
            return dict(linked_supplier)

    raise ValueError(
        "Could not resolve supplier. Provide supplier_id, supplier_name, or product_sku."
    )


def _resolve_invoice(
    session: Session,
    invoice_id: str | None = None,
    invoice_number: str | None = None,
) -> dict[str, Any]:
    invoices = table("invoices")

    if invoice_id:
        row = session.execute(
            select(invoices).where(invoices.c.id == invoice_id)
        ).mappings().first()
        if row:
            return dict(row)

    if invoice_number:
        row = session.execute(
            select(invoices).where(invoices.c.invoice_number == invoice_number)
        ).mappings().first()
        if row:
            return dict(row)

    raise ValueError(
        "Could not resolve invoice. Provide invoice_id or invoice_number."
    )


def _aggregate_validation_status(results: list[str]) -> str:
    if "failed" in results:
        return "mismatch_detected"
    if "warning" in results:
        return "missing_information"
    return "validated"


def _build_fallback_trends(product: dict[str, Any]) -> list[dict[str, Any]]:
    stock_on_hand = int(product["current_stock"])
    monthly_velocity = max(0, int(round((int(product["max_capacity"]) - stock_on_hand) * 0.45)))

    return [
        {
            "month": "May",
            "stock": round(stock_on_hand * 1.6),
            "demand": max(0, round(monthly_velocity * 0.95)),
            "promotion": "",
        },
        {
            "month": "Jun",
            "stock": round(stock_on_hand * 1.4),
            "demand": round(monthly_velocity * 1.05),
            "promotion": "Payday Sale",
        },
        {
            "month": "Jul",
            "stock": round(stock_on_hand * 1.2),
            "demand": max(0, round(monthly_velocity * 0.93)),
            "promotion": "",
        },
        {
            "month": "Aug",
            "stock": round(stock_on_hand * 1.1),
            "demand": round(monthly_velocity * 0.97),
            "promotion": "",
        },
        {
            "month": "Sep",
            "stock": round(stock_on_hand * 0.95),
            "demand": round(monthly_velocity * 1.0),
            "promotion": "Payday Sale",
        },
        {
            "month": "Oct",
            "stock": round(stock_on_hand * 0.85),
            "demand": round(monthly_velocity * 1.02),
            "promotion": "",
        },
        {
            "month": "Nov",
            "stock": round(stock_on_hand * 0.7),
            "demand": round(monthly_velocity * 1.3),
            "promotion": "11.11",
        },
        {
            "month": "Dec",
            "stock": round(stock_on_hand * 1.05),
            "demand": round(monthly_velocity * 1.08),
            "promotion": "Holiday",
        },
        {
            "month": "Jan",
            "stock": round(stock_on_hand * 0.9),
            "demand": round(monthly_velocity * 0.96),
            "promotion": "",
        },
        {
            "month": "Feb",
            "stock": round(stock_on_hand * 0.82),
            "demand": round(monthly_velocity * 0.99),
            "promotion": "Payday Sale",
        },
        {
            "month": "Mar",
            "stock": round(stock_on_hand * 0.7),
            "demand": round(monthly_velocity * 1.1),
            "promotion": "Raya",
        },
        {
            "month": "Apr",
            "stock": stock_on_hand,
            "demand": monthly_velocity,
            "promotion": "",
        },
    ]


class ProductSkuInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    sku: str = Field(
        ...,
        min_length=1,
        description="Exact product SKU to look up, for example 'SKU-ALM-8842'.",
    )


class ThresholdChangeRequestInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    sku: str = Field(
        ...,
        min_length=1,
        description="Exact product SKU whose reorder threshold should be reviewed.",
    )
    proposed_threshold: int = Field(
        ...,
        ge=0,
        description="The new proposed reorder threshold value that should be reviewed by a human or finance workflow.",
    )
    reason_type: str = Field(
        ...,
        min_length=1,
        description="Short machine-readable reason label such as 'demand_spike', 'lead_time_shift', or 'bundle_opportunity'.",
    )
    reason_summary: str = Field(
        ...,
        min_length=1,
        description="Human-readable explanation that justifies why the threshold should change.",
    )
    old_threshold: int | None = Field(
        default=None,
        ge=0,
        description="Optional current threshold to store in the request. If omitted, the tool uses the product's current threshold.",
    )
    requested_by: str | None = Field(
        default=None,
        description="Optional identifier for the agent or human who requested the change.",
    )


class SupplierInfoInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    supplier_id: str | None = Field(
        default=None,
        description="Optional supplier ID from the suppliers table. Use this when you already know the exact supplier record.",
    )
    supplier_name: str | None = Field(
        default=None,
        description="Optional supplier name for a case-insensitive exact lookup when the ID is not known.",
    )
    product_sku: str | None = Field(
        default=None,
        description="Optional product SKU. If provided, the tool resolves the product's primary supplier before returning the supplier profile.",
    )

    @model_validator(mode="after")
    def _check_identifier(self):
        if not any([self.supplier_id, self.supplier_name, self.product_sku]):
            raise ValueError(
                "Provide supplier_id, supplier_name, or product_sku so the tool can resolve a supplier."
            )
        return self


class ProductStockDemandTrendInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    sku: str = Field(
        ...,
        min_length=1,
        description="Exact product SKU whose month-by-month stock and demand trend should be returned.",
    )


class ConversationBufferInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    conversation_id: str | None = Field(
        default=None,
        description="Optional exact conversation ID. If omitted, the tool resolves the most recent conversation for the supplier.",
    )
    supplier_id: str | None = Field(
        default=None,
        description="Optional supplier ID used to locate the latest conversation when conversation_id is not available.",
    )
    limit: int = Field(
        5,
        ge=1,
        le=20,
        description="How many of the most recent messages to return. Default is 5.",
    )

    @model_validator(mode="after")
    def _check_identifier(self):
        if not self.conversation_id and not self.supplier_id:
            raise ValueError(
                "Provide either conversation_id or supplier_id so the tool can find the correct chat thread."
            )
        return self


class ReceiptInfoInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    invoice_id: str | None = Field(
        default=None,
        description="Optional invoice ID from the invoices table.",
    )
    invoice_number: str | None = Field(
        default=None,
        description="Optional supplier invoice/receipt number. Use this when the internal invoice ID is not available.",
    )

    @model_validator(mode="after")
    def _check_identifier(self):
        if not self.invoice_id and not self.invoice_number:
            raise ValueError(
                "Provide invoice_id or invoice_number so the tool can resolve the receipt record."
            )
        return self


class InvoiceValidationResultInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    invoice_id: str | None = Field(
        default=None,
        description="Optional invoice ID from the invoices table.",
    )
    invoice_number: str | None = Field(
        default=None,
        description="Optional invoice number when the invoice ID is not known.",
    )
    check_name: str = Field(
        ...,
        min_length=1,
        description="Human-readable validation rule name, such as 'bank_details_match_supplier' or 'quantity_matches_conversation'.",
    )
    result: Literal["passed", "warning", "failed"] = Field(
        ...,
        description="Outcome of the validation check as defined by the invoice validation_results schema.",
    )
    expected_value: str | None = Field(
        default=None,
        description="Optional expected value that the check was comparing against.",
    )
    actual_value: str | None = Field(
        default=None,
        description="Optional actual value observed during validation.",
    )

    @model_validator(mode="after")
    def _check_identifier(self):
        if not self.invoice_id and not self.invoice_number:
            raise ValueError(
                "Provide invoice_id or invoice_number so the tool can attach the validation result to the correct invoice."
            )
        return self


class ProductOperationalContextInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    sku: str = Field(
        ...,
        min_length=1,
        description="Exact product SKU to inspect before taking any modifying action on thresholds, workflows, or invoices.",
    )


class ThresholdRequestListInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    sku: str = Field(
        ...,
        min_length=1,
        description="Exact product SKU whose threshold change requests should be listed.",
    )
    status: str | None = Field(
        default=None,
        description="Optional request status filter such as 'pending', 'reviewed', 'approved', or 'rejected'.",
    )


class InvoiceActionInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    invoice_id: str | None = Field(
        default=None,
        description="Optional invoice ID from the invoices table.",
    )
    invoice_number: str | None = Field(
        default=None,
        description="Optional invoice number if the internal ID is not known.",
    )
    action_type: str = Field(
        ...,
        min_length=1,
        description="Short action label to store in the invoice_actions audit trail, such as 'parsed', 'validated', or 'flagged'.",
    )
    note: str = Field(
        ...,
        min_length=1,
        description="Free-text explanation of what happened and why this action was recorded.",
    )
    actor_type: Literal["merchant", "supplier", "ai", "system", "finance"] = Field(
        ...,
        description="Actor category responsible for the action record.",
    )

    @model_validator(mode="after")
    def _check_identifier(self):
        if not self.invoice_id and not self.invoice_number:
            raise ValueError(
                "Provide invoice_id or invoice_number so the action can be attached to a receipt record."
            )
        return self


class RestockRequestInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    sku: str = Field(
        ...,
        min_length=1,
        description="Exact product SKU to create a restock request for.",
    )
    workflow_id: str | None = Field(
        default=None,
        description="Optional active workflow ID to link this request to.",
    )
    requested_threshold: int | None = Field(
        default=None,
        ge=0,
        description="Optional new reorder threshold proposed as part of this restock event.",
    )
    requested_quantity: int = Field(
        ...,
        ge=1,
        description="The number of units recommended to restock.",
    )
    target_price_min: float = Field(
        ...,
        ge=0,
        description="The lower bound of the target unit price range.",
    )
    target_price_max: float = Field(
        ...,
        ge=0,
        description="The upper bound of the target unit price range.",
    )
    reason_summary: str = Field(
        ...,
        min_length=1,
        description="A human-readable explanation of why this restock is needed (e.g. 'Stock below threshold', 'Seasonality spike').",
    )
    status: Literal["pending", "reviewed", "accepted", "rejected", "cancelled"] = Field(
        default="pending",
        description="The initial status of the restock request.",
    )
    requested_by: Literal["ai", "merchant", "system"] = Field(
        default="ai",
        description="Who is making the request.",
    )


def _get_product_stock_and_target_price_impl(sku: str) -> dict[str, Any]:
    products = table("products")
    workflows = table("workflows")

    with session_scope() as session:
        product = _resolve_product(session, sku)
        workflow = session.execute(
            select(workflows)
            .where(workflows.c.product_id == product["id"])
            .order_by(desc(workflows.c.updated_at), desc(workflows.c.created_at))
            .limit(1)
        ).mappings().first()

        return {
            "sku": product["sku"],
            "product": {
                "id": product["id"],
                "name": product["name"],
                "category": product["category"],
                "current_stock": int(product["current_stock"]),
                "unit_price": float(product["unit_price"]),
                "current_threshold": int(product["current_threshold"]),
                "status": product["status"],
                "primary_supplier_id": product["primary_supplier_id"],
            },
            "target_price": {
                "min": float(workflow["target_price_min"]) if workflow and workflow["target_price_min"] is not None else None,
                "max": float(workflow["target_price_max"]) if workflow and workflow["target_price_max"] is not None else None,
                "band": None
                if not workflow or workflow["target_price_min"] is None or workflow["target_price_max"] is None
                else {
                    "low": float(workflow["target_price_min"]),
                    "high": float(workflow["target_price_max"]),
                    "midpoint": round(
                        (float(workflow["target_price_min"]) + float(workflow["target_price_max"])) / 2,
                        2,
                    ),
                },
            },
            "workflow": _json_ready(dict(workflow)) if workflow else None,
        }


@tool("get_product_stock_and_target_price", args_schema=ProductSkuInput)
def get_product_stock_and_target_price(sku: str) -> dict[str, Any]:
    """Fetch the live stock position and active target price band for one SKU.

    Use this tool when the agent is about to reason about restock quantity,
    negotiate a quote, or evaluate whether the current stock position is below
    the configured target band. It is the most direct read-only lookup for the
    product row plus the latest workflow target-price range.

    Use it before:
    - drafting a restock recommendation,
    - comparing supplier quotes against the active target band,
    - deciding whether the product is under the reorder threshold.

    Do not use it if the agent already has an up-to-date product record and no
    database confirmation is required.
    """

    return _json_ready(_get_product_stock_and_target_price_impl(sku))


def _request_reorder_threshold_update_impl(
    sku: str,
    proposed_threshold: int,
    reason_type: str,
    reason_summary: str,
    old_threshold: int | None = None,
    requested_by: str | None = None,
) -> dict[str, Any]:
    threshold_requests = table("threshold_change_requests")

    with session_scope() as session:
        product = _resolve_product(session, sku)
        current_threshold = int(old_threshold if old_threshold is not None else product["current_threshold"])
        request_id = f"thr-{uuid.uuid4().hex[:12]}"

        insert_stmt = (
            insert(threshold_requests)
            .values(
                id=request_id,
                product_id=product["id"],
                old_threshold=current_threshold,
                proposed_threshold=proposed_threshold,
                reason_type=reason_type,
                reason_summary=reason_summary,
                status="pending",
                reviewed_by=None,
                reviewed_at=None,
            )
            .returning(*threshold_requests.c)
        )
        created_request = session.execute(insert_stmt).mappings().one()
        session.commit()

        return {
            "request": {
                "id": created_request["id"],
                "sku": product["sku"],
                "product_name": product["name"],
                "old_threshold": int(created_request["old_threshold"]),
                "proposed_threshold": int(created_request["proposed_threshold"]),
                "reason_type": created_request["reason_type"],
                "status": created_request["status"],
            },
            "requested_by": requested_by,
            "product": {
                "sku": product["sku"],
                "name": product["name"],
                "current_threshold": int(product["current_threshold"]),
            },
        }


@tool("request_reorder_threshold_update", args_schema=ThresholdChangeRequestInput)
def request_reorder_threshold_update(
    sku: str,
    proposed_threshold: int,
    reason_type: str,
    reason_summary: str,
    old_threshold: int | None = None,
    requested_by: str | None = None,
) -> dict[str, Any]:
    """Create a pending threshold-change request for one SKU.

    Use this tool only when the agent has already decided that the reorder
    threshold should change, but the change must be tracked as a request rather
    than directly mutating the product row. The tool writes to
    threshold_change_requests with status='pending' and preserves the current
    threshold as the old value.

    Use it when:
    - demand spikes justify a higher buffer,
    - lead time shifts or supplier instability require a larger safety margin,
    - the AI wants to propose a threshold review for a human approver.

    Do not use it to silently update products.current_threshold. This tool records the
    review request only.
    """

    return _json_ready(
        _request_reorder_threshold_update_impl(
            sku=sku,
            proposed_threshold=proposed_threshold,
            reason_type=reason_type,
            reason_summary=reason_summary,
            old_threshold=old_threshold,
            requested_by=requested_by,
        )
    )


def _get_supplier_info_impl(
    supplier_id: str | None = None,
    supplier_name: str | None = None,
    product_sku: str | None = None,
) -> dict[str, Any]:
    suppliers = table("suppliers")
    products = table("products")
    product_suppliers = table("product_suppliers")

    with session_scope() as session:
        supplier = _resolve_supplier(
            session,
            supplier_id=supplier_id,
            supplier_name=supplier_name,
            product_sku=product_sku,
        )

        product_rows = session.execute(
            select(
                products.c.id,
                products.c.sku,
                products.c.name,
                products.c.category,
                products.c.current_stock,
                products.c.current_threshold,
                products.c.status,
                products.c.unit_price,
                product_suppliers.c.is_primary,
            )
            .select_from(product_suppliers.join(products, product_suppliers.c.product_id == products.c.id))
            .where(product_suppliers.c.supplier_id == supplier["id"])
            .order_by(desc(product_suppliers.c.is_primary), products.c.sku)
        ).mappings().all()

        return {
            "supplier": {
                "id": supplier["id"],
                "name": supplier["name"],
                "region": supplier["region"],
                "lead_time_days": int(supplier["lead_time_days"]),
                "reliability_score": float(supplier["reliability_score"]),
                "moq": supplier["moq"],
            },
            "linked_products": [
                {
                    "sku": row["sku"],
                    "name": row["name"],
                    "current_stock": int(row["current_stock"]),
                    "current_threshold": int(row["current_threshold"]),
                    "status": row["status"],
                    "is_primary": bool(row["is_primary"]),
                }
                for row in product_rows
            ],
            "product_count": len(product_rows),
        }


@tool("get_supplier_info", args_schema=SupplierInfoInput)
def get_supplier_info(
    supplier_id: str | None = None,
    supplier_name: str | None = None,
    product_sku: str | None = None,
) -> dict[str, Any]:
    """Return the supplier profile and the product coverage attached to it.

    Use this tool when the agent needs to evaluate a vendor before negotiating,
    deciding which supplier should receive a restock order, checking lead time,
    or inspecting MOQ and reliability. This is the authoritative supplier read
    path for the current schema.

    Use it when you need:
    - lead time, region, MOQ, notes, and reliability,
    - the products linked to that supplier,
    - a supplier lookup resolved from a product SKU.
    """

    return _json_ready(
        _get_supplier_info_impl(
            supplier_id=supplier_id,
            supplier_name=supplier_name,
            product_sku=product_sku,
        )
    )


def _get_product_stock_demand_trend_impl(sku: str) -> dict[str, Any]:
    products = table("products")
    trends = table("product_stock_demand_trends")

    with session_scope() as session:
        product = _resolve_product(session, sku)
        trend_rows = session.execute(
            select(trends)
            .where(trends.c.product_id == product["id"])
            .order_by(trends.c.month_order.asc())
        ).mappings().all()

        if trend_rows:
            return {
                "sku": product["sku"],
                "product_name": product["name"],
                "source": "database",
                "trend_summary": {
                    "latest_month": trend_rows[-1]["month"],
                    "latest_stock": int(trend_rows[-1]["stock"]),
                    "latest_demand": int(trend_rows[-1]["demand"]),
                    "latest_promotion": trend_rows[-1]["promotion"],
                    "points": [
                        {
                            "month": row["month"],
                            "stock": int(row["stock"]),
                            "demand": int(row["demand"]),
                            "promotion": row["promotion"],
                        }
                        for row in trend_rows[-3:]
                    ],
                },
            }

        fallback_trend = _build_fallback_trends(product)
        return {
            "sku": product["sku"],
            "product_name": product["name"],
            "source": "fallback",
            "trend_summary": {
                "latest_month": fallback_trend[-1]["month"],
                "latest_stock": fallback_trend[-1]["stock"],
                "latest_demand": fallback_trend[-1]["demand"],
                "latest_promotion": fallback_trend[-1]["promotion"],
                "points": fallback_trend[-3:],
            },
        }


@tool("get_product_stock_demand_trend", args_schema=ProductStockDemandTrendInput)
def get_product_stock_demand_trend(sku: str) -> dict[str, Any]:
    """Return the month-by-month stock and demand trajectory for one SKU.

    Use this tool when the agent needs seasonality, promotion markers, or a
    stock-versus-demand history for the product. It is the correct tool for
    trend charts, threshold reasoning, and deciding whether a SKU is entering a
    high-demand period.

    Use it when the AI is reasoning about:
    - stock drawdown across months,
    - demand seasonality and promotion spikes,
    - whether the current threshold should be tightened or relaxed.

    The tool reads from product_stock_demand_trends. If a row set is missing, it
    falls back to a deterministic series derived from the product record so the
    agent never receives an empty response for a known SKU.
    """

    return _json_ready(_get_product_stock_demand_trend_impl(sku))


def _get_last_supplier_conversation_messages_impl(
    conversation_id: str | None = None,
    supplier_id: str | None = None,
    limit: int = 5,
) -> dict[str, Any]:
    conversations = table("conversations")
    messages = table("conversation_messages")
    suppliers = table("suppliers")

    with session_scope() as session:
        conversation_row = None
        if conversation_id:
            conversation_row = session.execute(
                select(conversations).where(conversations.c.id == conversation_id)
            ).mappings().first()
        elif supplier_id:
            conversation_row = session.execute(
                select(conversations)
                .where(conversations.c.supplier_id == supplier_id)
                .order_by(desc(conversations.c.updated_at), desc(conversations.c.created_at))
                .limit(1)
            ).mappings().first()

        if not conversation_row:
            raise ValueError(
                "No matching conversation found. Provide a valid conversation_id or a supplier_id with at least one conversation."
            )

        supplier_row = None
        if conversation_row["supplier_id"]:
            supplier_row = session.execute(
                select(suppliers).where(suppliers.c.id == conversation_row["supplier_id"])
            ).mappings().first()

        message_rows = session.execute(
            select(messages)
            .where(messages.c.conversation_id == conversation_row["id"])
            .order_by(messages.c.created_at.desc())
            .limit(limit)
        ).mappings().all()

        return {
            "conversation": {
                "id": conversation_row["id"],
                "state": conversation_row["state"],
                "priority": conversation_row["priority"],
                "latest_message": conversation_row["latest_message"],
            },
            "supplier": {
                "id": supplier_row["id"],
                "name": supplier_row["name"],
            }
            if supplier_row
            else None,
            "messages": [
                {
                    "id": row["id"],
                    "sender_type": row["sender_type"],
                    "message_type": row["message_type"],
                    "content": row["content"],
                    "missing_fields": row["missing_fields"],
                    "created_at": row["created_at"],
                }
                for row in reversed(message_rows)
            ],
            "returned_message_count": len(message_rows),
        }


@tool("get_last_supplier_conversation_messages", args_schema=ConversationBufferInput)
def get_last_supplier_conversation_messages(
    conversation_id: str | None = None,
    supplier_id: str | None = None,
    limit: int = 5,
) -> dict[str, Any]:
    """Fetch the most recent conversational buffer for a supplier thread.

    Use this tool when the agent needs the last few chat messages to preserve
    negotiation context, summarize the current back-and-forth, or decide which
    missing fields still block the order. It is the exact buffer lookup for the
    conversation_messages table.

    Use it when you need:
    - the last 5 messages in a negotiation,
    - a chronological buffer of the most recent conversation state,
    - to recover the latest supplier thread for a supplier_id.

    The tool returns the newest messages in chronological order so the agent can
    read the thread naturally from oldest to newest.
    """

    return _json_ready(
        _get_last_supplier_conversation_messages_impl(
            conversation_id=conversation_id,
            supplier_id=supplier_id,
            limit=limit,
        )
    )


def _get_receipt_info_impl(
    invoice_id: str | None = None,
    invoice_number: str | None = None,
) -> dict[str, Any]:
    invoices = table("invoices")
    suppliers = table("suppliers")
    workflows = table("workflows")
    invoice_products = table("invoice_products")
    invoice_validation_results = table("invoice_validation_results")
    invoice_actions = table("invoice_actions")
    products = table("products")

    with session_scope() as session:
        invoice = _resolve_invoice(session, invoice_id=invoice_id, invoice_number=invoice_number)

        supplier_row = None
        if invoice["supplier_id"]:
            supplier_row = session.execute(
                select(suppliers).where(suppliers.c.id == invoice["supplier_id"])
            ).mappings().first()

        workflow_row = None
        if invoice["workflow_id"]:
            workflow_row = session.execute(
                select(workflows).where(workflows.c.id == invoice["workflow_id"])
            ).mappings().first()

        line_rows = session.execute(
            select(
                invoice_products.c.id,
                invoice_products.c.invoice_id,
                invoice_products.c.product_id,
                invoice_products.c.quantity,
                invoice_products.c.unit_price,
                invoice_products.c.subtotal,
                products.c.sku,
                products.c.name.label("product_name"),
            )
            .select_from(invoice_products.join(products, invoice_products.c.product_id == products.c.id))
            .where(invoice_products.c.invoice_id == invoice["id"])
            .order_by(invoice_products.c.id.asc())
        ).mappings().all()

        validation_rows = session.execute(
            select(invoice_validation_results)
            .where(invoice_validation_results.c.invoice_id == invoice["id"])
            .order_by(invoice_validation_results.c.created_at.asc())
        ).mappings().all()

        action_rows = session.execute(
            select(invoice_actions)
            .where(invoice_actions.c.invoice_id == invoice["id"])
            .order_by(invoice_actions.c.created_at.asc())
        ).mappings().all()

        validation_results = [dict(row) for row in validation_rows]
        critical_checks = [
            {
                "check_name": row["check_name"],
                "result": row["result"],
                "actual_value": row["actual_value"],
            }
            for row in validation_rows
        ]

        return {
            "invoice": {
                "id": invoice["id"],
                "invoice_number": invoice["invoice_number"],
                "amount": float(invoice["amount"]),
                "currency": invoice["currency"],
                "quantity": invoice["quantity"],
                "payment_terms": invoice["payment_terms"],
                "bank_details": invoice["bank_details"],
                "validation_status": invoice["validation_status"],
                "risk_level": invoice["risk_level"],
                "approval_state": invoice["approval_state"],
            },
            "supplier": {
                "id": supplier_row["id"],
                "name": supplier_row["name"],
            }
            if supplier_row
            else None,
            "workflow": {
                "id": workflow_row["id"],
                "current_state": workflow_row["current_state"],
                "approval_state": workflow_row["approval_state"],
            }
            if workflow_row
            else None,
            "line_items": [
                {
                    "sku": row["sku"],
                    "product_name": row["product_name"],
                    "quantity": int(row["quantity"]),
                    "unit_price": float(row["unit_price"]),
                    "subtotal": float(row["subtotal"]),
                }
                for row in line_rows
            ],
            "validation_summary": {
                "status": invoice["validation_status"],
                "checks": critical_checks,
                "check_count": len(validation_results),
            },
            "actions": [
                {
                    "action_type": row["action_type"],
                    "note": row["note"],
                    "actor_type": row["actor_type"],
                    "created_at": row["created_at"],
                }
                for row in action_rows
            ],
        }


@tool("get_receipt_info", args_schema=ReceiptInfoInput)
def get_receipt_info(
    invoice_id: str | None = None,
    invoice_number: str | None = None,
) -> dict[str, Any]:
    """Fetch the full receipt/invoice record and all linked operational detail.

    Use this tool when the agent needs the invoice header, supplier, workflow,
    line items, validation history, and audit trail before accepting or blocking
    a receipt. In this schema, the invoice table is the receipt authority.

    Use it when you need to:
    - inspect invoice amount, currency, payment terms, and bank details,
    - review line items and subtotal math,
    - inspect invoice validation results and actions before approval.
    """

    return _json_ready(
        _get_receipt_info_impl(invoice_id=invoice_id, invoice_number=invoice_number)
    )


def _record_invoice_validation_result_impl(
    invoice_id: str | None = None,
    invoice_number: str | None = None,
    check_name: str = "",
    result: Literal["passed", "warning", "failed"] = "passed",
    expected_value: str | None = None,
    actual_value: str | None = None,
) -> dict[str, Any]:
    invoices = table("invoices")
    validation_results = table("invoice_validation_results")

    with session_scope() as session:
        invoice = _resolve_invoice(session, invoice_id=invoice_id, invoice_number=invoice_number)
        validation_id = f"ivr-{uuid.uuid4().hex[:12]}"

        created_row = session.execute(
            insert(validation_results)
            .values(
                id=validation_id,
                invoice_id=invoice["id"],
                check_name=check_name,
                expected_value=expected_value,
                actual_value=actual_value,
                result=result,
            )
            .returning(*validation_results.c)
        ).mappings().one()

        all_results = session.execute(
            select(validation_results.c.result).where(validation_results.c.invoice_id == invoice["id"])
        ).scalars().all()

        aggregate_status = _aggregate_validation_status(all_results)

        session.execute(
            update(invoices)
            .where(invoices.c.id == invoice["id"])
            .values(validation_status=aggregate_status)
        )
        session.commit()

        updated_invoice = session.execute(
            select(invoices).where(invoices.c.id == invoice["id"])
        ).mappings().one()

        return {
            "validation_result": {
                "id": created_row["id"],
                "invoice_id": created_row["invoice_id"],
                "check_name": created_row["check_name"],
                "result": created_row["result"],
                "expected_value": created_row["expected_value"],
                "actual_value": created_row["actual_value"],
            },
            "invoice": {
                "id": updated_invoice["id"],
                "invoice_number": updated_invoice["invoice_number"],
                "validation_status": updated_invoice["validation_status"],
                "approval_state": updated_invoice["approval_state"],
            },
            "validation_summary": {
                "total_checks": len(all_results),
                "status": aggregate_status,
            },
        }


@tool("record_invoice_validation_result", args_schema=InvoiceValidationResultInput)
def record_invoice_validation_result(
    invoice_id: str | None = None,
    invoice_number: str | None = None,
    check_name: str = "",
    result: Literal["passed", "warning", "failed"] = "passed",
    expected_value: str | None = None,
    actual_value: str | None = None,
) -> dict[str, Any]:
    """Store a single invoice validation result and refresh the invoice status.

    Use this tool when the agent has completed a parsing or verification step
    and needs to persist the outcome in invoice_validation_results. The tool also
    updates invoices.validation_status using the combined validation outcomes for
    that invoice.

    Use it when:
    - a line item, amount, bank detail, freight cap, or supplier check passes,
    - the AI detects a warning or failure that should be audited,
    - the invoice status needs to move from parsed to validated/mismatch_detected/
      missing_information.

    Do not use this tool to create a general note. Use invoice_actions for audit
    trail notes that are not validation checks.
    """

    return _json_ready(
        _record_invoice_validation_result_impl(
            invoice_id=invoice_id,
            invoice_number=invoice_number,
            check_name=check_name,
            result=result,
            expected_value=expected_value,
            actual_value=actual_value,
        )
    )


def _get_product_operational_context_impl(sku: str) -> dict[str, Any]:
    conversations = table("conversations")
    workflows = table("workflows")
    invoices = table("invoices")
    threshold_requests = table("threshold_change_requests")
    trends = table("product_stock_demand_trends")
    conversation_messages = table("conversation_messages")
    suppliers = table("suppliers")

    with session_scope() as session:
        product = _resolve_product(session, sku)

        supplier_row = None
        if product.get("primary_supplier_id"):
            supplier_row = session.execute(
                select(suppliers).where(suppliers.c.id == product["primary_supplier_id"])
            ).mappings().first()

        workflow_row = session.execute(
            select(workflows)
            .where(workflows.c.product_id == product["id"])
            .order_by(desc(workflows.c.updated_at), desc(workflows.c.created_at))
            .limit(1)
        ).mappings().first()

        conversation_row = None
        invoice_row = None
        if workflow_row and workflow_row.get("conversation_id"):
            conversation_row = session.execute(
                select(conversations).where(conversations.c.id == workflow_row["conversation_id"])
            ).mappings().first()
        if workflow_row and workflow_row.get("invoice_id"):
            invoice_row = session.execute(
                select(invoices).where(invoices.c.id == workflow_row["invoice_id"])
            ).mappings().first()

        request_rows = session.execute(
            select(threshold_requests)
            .where(threshold_requests.c.product_id == product["id"])
            .order_by(desc(threshold_requests.c.created_at))
        ).mappings().all()

        trend_rows = session.execute(
            select(trends)
            .where(trends.c.product_id == product["id"])
            .order_by(trends.c.month_order.asc())
        ).mappings().all()

        recent_message_rows = []
        if conversation_row:
            recent_message_rows = session.execute(
                select(conversation_messages)
                .where(conversation_messages.c.conversation_id == conversation_row["id"])
                .order_by(desc(conversation_messages.c.created_at))
                .limit(3)
            ).mappings().all()

        return {
            "product": {
                "sku": product["sku"],
                "name": product["name"],
                "category": product["category"],
                "current_stock": int(product["current_stock"]),
                "current_threshold": int(product["current_threshold"]),
                "status": product["status"],
            },
            "supplier": {
                "id": supplier_row["id"],
                "name": supplier_row["name"],
                "lead_time_days": int(supplier_row["lead_time_days"]),
                "reliability_score": float(supplier_row["reliability_score"]),
                "moq": supplier_row["moq"],
            }
            if supplier_row
            else None,
            "workflow": {
                "id": workflow_row["id"],
                "current_state": workflow_row["current_state"],
                "approval_state": workflow_row["approval_state"],
                "target_price_min": float(workflow_row["target_price_min"]) if workflow_row["target_price_min"] is not None else None,
                "target_price_max": float(workflow_row["target_price_max"]) if workflow_row["target_price_max"] is not None else None,
                "quantity": workflow_row["quantity"],
            }
            if workflow_row
            else None,
            "pending_threshold_request": {
                "id": request_rows[0]["id"],
                "proposed_threshold": int(request_rows[0]["proposed_threshold"]),
                "reason_type": request_rows[0]["reason_type"],
                "status": request_rows[0]["status"],
                "created_at": request_rows[0]["created_at"],
            }
            if request_rows
            else None,
            "trend_summary": {
                "latest_points": [
                    {
                        "month": row["month"],
                        "stock": int(row["stock"]),
                        "demand": int(row["demand"]),
                        "promotion": row["promotion"],
                    }
                    for row in trend_rows[-3:]
                ],
                "latest_month": trend_rows[-1]["month"] if trend_rows else None,
                "latest_stock": int(trend_rows[-1]["stock"]) if trend_rows else None,
                "latest_demand": int(trend_rows[-1]["demand"]) if trend_rows else None,
                "latest_promotion": trend_rows[-1]["promotion"] if trend_rows else None,
            },
            "conversation_summary": {
                "id": conversation_row["id"],
                "state": conversation_row["state"],
                "priority": conversation_row["priority"],
                "latest_message": conversation_row["latest_message"],
                "recent_messages": [
                    {
                        "sender_type": row["sender_type"],
                        "content": row["content"],
                        "missing_fields": row["missing_fields"],
                        "created_at": row["created_at"],
                    }
                    for row in reversed(recent_message_rows)
                ],
            }
            if conversation_row
            else None,
            "invoice_summary": {
                "id": invoice_row["id"],
                "invoice_number": invoice_row["invoice_number"],
                "amount": float(invoice_row["amount"]),
                "quantity": invoice_row["quantity"],
                "validation_status": invoice_row["validation_status"],
                "risk_level": invoice_row["risk_level"],
                "approval_state": invoice_row["approval_state"],
            }
            if invoice_row
            else None,
        }


@tool("get_product_operational_context", args_schema=ProductOperationalContextInput)
def get_product_operational_context(sku: str) -> dict[str, Any]:
    """Return only the decision-relevant context for one SKU before any modification.

    Use this tool when the agent is about to make a decision that could change a
    threshold, create a validation record, generate an order, or send a supplier
    message. It returns only the fields that affect the decision, not the full
    database rows.

    The returned snapshot is intentionally compact:
    - product status and threshold position
    - supplier lead time and reliability
    - workflow target price band and approval state
    - pending threshold request, if any
    - the latest trend points
    - the latest conversation messages
    - the current invoice summary, if linked

    This is the best "before modify" read tool when the agent wants to avoid
    redundant lookups and see just the evidence needed to decide.
    """

    return _json_ready(_get_product_operational_context_impl(sku))


def _list_threshold_requests_for_sku_impl(sku: str, status: str | None = None) -> dict[str, Any]:
    threshold_requests = table("threshold_change_requests")

    with session_scope() as session:
        product = _resolve_product(session, sku)

        stmt = select(threshold_requests).where(threshold_requests.c.product_id == product["id"])
        if status:
            stmt = stmt.where(func.lower(threshold_requests.c.status) == _normalize_text(status))

        rows = session.execute(
            stmt.order_by(desc(threshold_requests.c.created_at))
        ).mappings().all()

        return {
            "sku": product["sku"],
            "product_name": product["name"],
            "requests": [
                {
                    "id": row["id"],
                    "old_threshold": int(row["old_threshold"]),
                    "proposed_threshold": int(row["proposed_threshold"]),
                    "reason_type": row["reason_type"],
                    "status": row["status"],
                    "created_at": row["created_at"],
                }
                for row in rows
            ],
        }


@tool("list_threshold_change_requests_for_sku", args_schema=ThresholdRequestListInput)
def list_threshold_change_requests_for_sku(
    sku: str,
    status: str | None = None,
) -> dict[str, Any]:
    """List threshold-change requests for a SKU before creating a duplicate request.

    Use this tool when the agent wants to see whether a threshold change has
    already been requested, what the current pending review state is, or whether
    the SKU already has approved/rejected history. This is the guardrail lookup
    that should happen before the agent inserts another request.
    """

    return _json_ready(_list_threshold_requests_for_sku_impl(sku, status=status))


def _record_invoice_action_impl(
    invoice_id: str | None = None,
    invoice_number: str | None = None,
    action_type: str = "",
    note: str = "",
    actor_type: Literal["merchant", "supplier", "ai", "system", "finance"] = "ai",
) -> dict[str, Any]:
    invoices = table("invoices")
    invoice_actions = table("invoice_actions")

    with session_scope() as session:
        invoice = _resolve_invoice(session, invoice_id=invoice_id, invoice_number=invoice_number)
        action_id = f"ia-{uuid.uuid4().hex[:12]}"

        created_action = session.execute(
            insert(invoice_actions)
            .values(
                id=action_id,
                invoice_id=invoice["id"],
                action_type=action_type,
                note=note,
                actor_type=actor_type,
            )
            .returning(*invoice_actions.c)
        ).mappings().one()
        session.commit()

        updated_invoice = session.execute(
            select(invoices).where(invoices.c.id == invoice["id"])
        ).mappings().one()

        return {
            "invoice": {
                "id": updated_invoice["id"],
                "invoice_number": updated_invoice["invoice_number"],
                "validation_status": updated_invoice["validation_status"],
                "approval_state": updated_invoice["approval_state"],
            },
            "invoice_action": {
                "id": created_action["id"],
                "action_type": created_action["action_type"],
                "note": created_action["note"],
                "actor_type": created_action["actor_type"],
            },
        }


@tool("record_invoice_action", args_schema=InvoiceActionInput)
def record_invoice_action(
    invoice_id: str | None = None,
    invoice_number: str | None = None,
    action_type: str = "",
    note: str = "",
    actor_type: Literal["merchant", "supplier", "ai", "system", "finance"] = "ai",
) -> dict[str, Any]:
    """Append a non-validation audit action to invoice_actions.

    Use this tool when the agent needs to log an operational event that is not a
    formal validation result. Good examples are 'parsed', 'blocked', 'escalated',
    'completed', 'sent_to_supplier', or any other audit step that should appear
    in the receipt history.

    Use it when the agent wants to:
    - preserve a finance or AI audit trail,
    - mark a step that happened after invoice parsing,
    - leave a human-readable note tied to a receipt.

    Do not use this tool instead of record_invoice_validation_result when the
    action is specifically a validation check outcome.
    """

    return _json_ready(
        _record_invoice_action_impl(
            invoice_id=invoice_id,
            invoice_number=invoice_number,
            action_type=action_type,
            note=note,
            actor_type=actor_type,
        )
    )


def _create_restock_request_impl(
    sku: str,
    requested_quantity: int,
    target_price_min: float,
    target_price_max: float,
    reason_summary: str,
    workflow_id: str | None = None,
    requested_threshold: int | None = None,
    status: str = "pending",
    requested_by: str = "ai",
) -> dict[str, Any]:
    restock_requests = table("restock_requests")

    with session_scope() as session:
        product = _resolve_product(session, sku)
        request_id = f"rr-{uuid.uuid4().hex[:12]}"

        insert_stmt = (
            insert(restock_requests)
            .values(
                id=request_id,
                product_id=product["id"],
                workflow_id=workflow_id,
                target_price_min=target_price_min,
                target_price_max=target_price_max,
                requested_threshold=requested_threshold,
                requested_quantity=requested_quantity,
                reason_summary=reason_summary,
                status=status,
                requested_by=requested_by,
            )
            .returning(*restock_requests.c)
        )
        created_request = session.execute(insert_stmt).mappings().one()
        session.commit()

        return {
            "success": True,
            "restock_request_id": created_request["id"],
            "sku": product["sku"],
            "product_name": product["name"],
            "requested_quantity": int(created_request["requested_quantity"]),
            "target_price_min": float(created_request["target_price_min"]),
            "target_price_max": float(created_request["target_price_max"]),
            "status": created_request["status"],
        }


@tool("create_restock_request", args_schema=RestockRequestInput)
def create_restock_request(
    sku: str,
    requested_quantity: int,
    target_price_min: float,
    target_price_max: float,
    reason_summary: str,
    workflow_id: str | None = None,
    requested_threshold: int | None = None,
    status: str = "pending",
    requested_by: str = "ai",
) -> dict[str, Any]:
    """Create a formal restock request in the database.

    Use this tool when the agent has decided that a product needs restocking.
    The tool inserts a record into the restock_requests table.

    It should be used after the agent has reasoned about:
    - the quantity to order (based on stock, capacity, and MOQ),
    - the target price range (based on history or trends).
    """

    return _json_ready(
        _create_restock_request_impl(
            sku=sku,
            requested_quantity=requested_quantity,
            target_price_min=target_price_min,
            target_price_max=target_price_max,
            reason_summary=reason_summary,
            workflow_id=workflow_id,
            requested_threshold=requested_threshold,
            status=status,
            requested_by=requested_by,
        )
    )


RECOMMENDED_RESTOCK_TOOLS = [
    "get_product_stock_and_target_price",
    "get_product_stock_demand_trend",
    "get_supplier_info",
    "get_last_supplier_conversation_messages",
    "get_receipt_info",
    "get_product_operational_context",
    "request_reorder_threshold_update",
    "list_threshold_change_requests_for_sku",
    "record_invoice_validation_result",
    "record_invoice_action",
    "create_restock_request",
]


if __name__ == "__main__":
    diagnostics = [
        (get_product_stock_and_target_price, {"sku": "SKU-ALM-8842"}),
        (get_product_stock_demand_trend, {"sku": "SKU-ALM-8842"}),
    ]

    for tool_obj, payload in diagnostics:
        try:
            print(f"Running diagnostic for {tool_obj.name}...")
            result = tool_obj.invoke(payload)
            print(result)
        except Exception as exc:
            print(f"{tool_obj.name} failed: {exc}")
