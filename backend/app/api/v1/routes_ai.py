from typing import Any
import json
import logging

from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException

from app.ai.client import is_ai_configured, masked_ai_secret
from app.ai.invoice_analysis import analyze_invoice
from app.ai.service import generate_copilot_response
from app.ai.threshold_analysis import run_threshold_analysis
from app.ai.restock_analysis import run_restock_analysis
from app.core.config import AI_PROVIDER, CURRENT_AI_BASE_URL, CURRENT_AI_MODEL


router = APIRouter(prefix="/ai", tags=["ai"])
logger = logging.getLogger(__name__)


class CopilotRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="User question or instruction for the copilot.")
    sku: str | None = Field(default=None, description="Optional SKU for product and restock context.")
    invoice_id: str | None = Field(default=None, description="Optional internal invoice ID.")
    invoice_number: str | None = Field(default=None, description="Optional external invoice number.")
    supplier_id: str | None = Field(default=None, description="Optional supplier ID for negotiation context.")
    conversation_id: str | None = Field(default=None, description="Optional conversation ID for direct thread lookup.")
    conversation_limit: int = Field(default=5, ge=1, le=20, description="How many recent supplier messages to load.")


class ThresholdAnalysisRequest(BaseModel):
    skus: list[str] | None = Field(
        default=None,
        description="Optional explicit list of SKUs to analyze. If omitted, the backend selects threshold-review candidates automatically.",
    )
    limit: int | None = Field(
        default=None,
        ge=1,
        le=1000,
        description="Optional cap on automatically selected SKUs. If omitted, the backend analyzes all SKUs without pending requests.",
    )


class InvoiceAnalysisRequest(BaseModel):
    invoice_data: dict[str, Any] = Field(
        ...,
        description="Minimal structured invoice data with actual values.",
    )
    expected_data: dict[str, Any] = Field(
        ...,
        description="Expected/reference values derived from workflows and supplier history.",
    )


@router.get("/status")
def ai_status():
    return {
        "configured": is_ai_configured(),
        "provider": AI_PROVIDER,
        "base_url": CURRENT_AI_BASE_URL,
        "model": CURRENT_AI_MODEL,
    }


@router.post("/copilot")
async def copilot(payload: CopilotRequest):
    if not is_ai_configured():
        raise HTTPException(
            status_code=503,
            detail="AI model is not configured. Add Gemini or Anthropic credentials to backend/.env.",
        )

    try:
        return await generate_copilot_response(
            prompt=payload.prompt,
            sku=payload.sku,
            invoice_id=payload.invoice_id,
            invoice_number=payload.invoice_number,
            supplier_id=payload.supplier_id,
            conversation_id=payload.conversation_id,
            conversation_limit=payload.conversation_limit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/threshold-analysis/run")
async def threshold_analysis(payload: ThresholdAnalysisRequest):
    if not is_ai_configured():
        raise HTTPException(
            status_code=503,
            detail="AI model is not configured. Add Gemini or Anthropic credentials to backend/.env.",
        )

    try:
        return await run_threshold_analysis(skus=payload.skus, limit=payload.limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/invoice-analysis")
async def invoice_analysis(payload: InvoiceAnalysisRequest):
    logger.info(
        "🔥 AI route hit: /api/v1/ai/invoice-analysis configured=%s base_url=%s model=%s key=%s",
        is_ai_configured(),
        CURRENT_AI_BASE_URL,
        CURRENT_AI_MODEL,
        masked_ai_secret(),
    )
    logger.info(
        "Incoming invoice-analysis payload: %s",
        json.dumps(
            {
                "invoice_data": payload.invoice_data,
                "expected_data": payload.expected_data,
            },
            default=str,
        ),
    )
    if not is_ai_configured():
        raise HTTPException(
            status_code=503,
            detail="AI model is not configured. Add Gemini or Anthropic credentials to backend/.env.",
        )

    try:
        return await analyze_invoice(
            invoice_data=payload.invoice_data,
            expected_data=payload.expected_data,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/restock-analysis/run")
async def restock_analysis():
    if not is_ai_configured():
        raise HTTPException(
            status_code=503,
            detail="AI model is not configured. Add Gemini or Anthropic credentials to backend/.env.",
        )

    try:
        return await run_restock_analysis()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
