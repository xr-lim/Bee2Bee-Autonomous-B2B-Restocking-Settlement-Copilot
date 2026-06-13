from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException
import traceback
import logging
import re

from app.ai.negotiation_agent import run_negotiation_agent
from app.core.config import WHATSAPP_ENABLED, WHATSAPP_GRAPH_API_VERSION
from app.db.session import SessionLocal
from app.models.message import Message
from app.realtime import sio
from app.services.whatsapp_service import send_whatsapp_text
from sqlalchemy import text
from sqlalchemy.exc import OperationalError


router = APIRouter(prefix="/negotiation", tags=["negotiation"])
logger = logging.getLogger(__name__)


def _debug_log(message: str, *args: object) -> None:
    logger.warning(message, *args)
    try:
        print(message % args if args else message)
    except Exception:
        print(message)

class StartNegotiationRequest(BaseModel):
    conversation_id: str = Field(
        ...,
        min_length=1,
        description="The conversation ID to start negotiation for.",
    )
    restock_request_id: str | None = Field(
        default=None,
        description="Optional restock request ID. If not provided, the agent will find it from the conversation.",
    )

class SupplierReplyRequest(BaseModel):
    conversation_id: str = Field(
        ...,
        min_length=1,
        description="The conversation ID for this supplier reply.",
    )
    supplier_message: str | None = Field(
        default=None,
        description="The supplier's message or counter-offer.",
    )
    file_url: str | None = Field(
        default=None,
        description="Optional uploaded file URL from the supplier.",
    )
    file_name: str | None = Field(
        default=None,
        description="Optional uploaded file name.",
    )
    file_type: str | None = Field(
        default=None,
        description="Optional uploaded file MIME type.",
    )

async def _emit_ai_message(conversation_id: str, content: str) -> bool:
    _debug_log(
        "[WA DEBUG] _emit_ai_message reached: conversation_id=%s raw_message_preview=%s",
        conversation_id,
        (content or "").strip()[:160],
    )
    emit_succeeded = await _persist_and_emit_message(
        conversation_id=conversation_id,
        sender="AI",
        content=content,
    )
    await _maybe_send_ai_message_to_whatsapp(conversation_id, content)
    _debug_log(
        "[WA DEBUG] _emit_ai_message finished: conversation_id=%s",
        conversation_id,
    )
    return emit_succeeded


def _get_supplier_whatsapp_details(conversation_id: str) -> dict[str, str] | None:
    try:
        with SessionLocal() as db:
            row = db.execute(
                text(
                    """
                    select
                      c.id as conversation_id,
                      c.latest_message as latest_message,
                      s.id as supplier_id,
                      s.name as supplier_name,
                      s.whatsapp_number as whatsapp_number
                    from conversations c
                    left join suppliers s on s.id = c.supplier_id
                    where c.id = :conversation_id
                    limit 1
                    """
                ),
                {
                    "conversation_id": conversation_id,
                },
            ).mappings().first()
    except Exception:
        logger.exception(
            "Unable to load supplier WhatsApp details for conversation %s",
            conversation_id,
        )
        return None

    if not row or not row.get("supplier_id"):
        return None

    return {
        "conversation_id": row["conversation_id"],
        "supplier_id": row["supplier_id"],
        "supplier_name": row.get("supplier_name") or "Supplier",
        "whatsapp_number": row.get("whatsapp_number") or "",
        "latest_message": row.get("latest_message") or "",
    }


def _strip_thinking_blocks(content: str | None) -> str:
    if not content:
        return ""
    return re.sub(
        r"<thinking>.*?</thinking>",
        "",
        content,
        flags=re.IGNORECASE | re.DOTALL,
    ).strip()


def _resolve_whatsapp_message_content(
    *,
    ai_response: str | None,
    supplier_details: dict[str, str] | None,
) -> tuple[str, str]:
    visible_ai_message = _strip_thinking_blocks(ai_response)
    latest_message = (supplier_details or {}).get("latest_message", "").strip()

    if visible_ai_message:
        return visible_ai_message, "final_ai_response"

    if latest_message:
        return latest_message, "conversation_latest_message"

    return (ai_response or "").strip(), "raw_ai_response"


async def _maybe_send_ai_message_to_whatsapp(
    conversation_id: str,
    content: str,
) -> None:
    _debug_log(
        "[WA DEBUG] before WhatsApp send: enabled=%s graph_api_version=%s conversation_id=%s raw_message_preview=%s",
        WHATSAPP_ENABLED,
        WHATSAPP_GRAPH_API_VERSION,
        conversation_id,
        (content or "").strip()[:160],
    )

    if not WHATSAPP_ENABLED:
        _debug_log(
            "[WA DEBUG] WhatsApp send skipped: reason=%s enabled=%s conversation_id=%s",
            "whatsapp_disabled",
            WHATSAPP_ENABLED,
            conversation_id,
        )
        return

    supplier_details = _get_supplier_whatsapp_details(conversation_id)
    if not supplier_details:
        _debug_log(
            "[WA DEBUG] WhatsApp send skipped: reason=%s conversation_id=%s supplier_id=%s whatsapp_number=%s",
            "supplier_not_linked_to_conversation",
            conversation_id,
            None,
            None,
        )
        return

    resolved_whatsapp_number = supplier_details["whatsapp_number"]
    whatsapp_message, message_source = _resolve_whatsapp_message_content(
        ai_response=content,
        supplier_details=supplier_details,
    )
    _debug_log(
        "[WA DEBUG] supplier resolved: conversation_id=%s supplier_id=%s whatsapp_number=%s message_source=%s message_preview=%s",
        conversation_id,
        supplier_details["supplier_id"],
        resolved_whatsapp_number or "",
        message_source,
        whatsapp_message[:160],
    )

    if not resolved_whatsapp_number.strip():
        _debug_log(
            "[WA DEBUG] WhatsApp send skipped: reason=%s conversation_id=%s supplier_id=%s whatsapp_number=%s message_preview=%s",
            "missing_supplier_number",
            conversation_id,
            supplier_details["supplier_id"],
            resolved_whatsapp_number,
            whatsapp_message[:160],
        )

    result = await send_whatsapp_text(
        resolved_whatsapp_number,
        whatsapp_message,
    )

    _debug_log(
        "[WA DEBUG] after WhatsApp send attempt: conversation_id=%s supplier_id=%s whatsapp_number=%s status_code=%s api_url=%s skip_reason=%s",
        conversation_id,
        supplier_details["supplier_id"],
        resolved_whatsapp_number,
        result.get("status_code"),
        result.get("api_url"),
        result.get("skip_reason"),
    )

    if result.get("success"):
        _debug_log(
            "[WA DEBUG] WhatsApp send success: conversation_id=%s supplier_id=%s whatsapp_number=%s status_code=%s message_preview=%s",
            conversation_id,
            supplier_details["supplier_id"],
            resolved_whatsapp_number,
            result.get("status_code"),
            whatsapp_message[:160],
        )
        return

    if result.get("skipped"):
        _debug_log(
            "[WA DEBUG] WhatsApp send skipped: conversation_id=%s supplier_id=%s whatsapp_number=%s reason=%s message_preview=%s api_url=%s",
            conversation_id,
            supplier_details["supplier_id"],
            resolved_whatsapp_number,
            result.get("skip_reason") or result.get("error"),
            whatsapp_message[:160],
            result.get("api_url"),
        )
        return

    _debug_log(
        "[WA DEBUG] WhatsApp send failed: conversation_id=%s supplier_id=%s whatsapp_number=%s message_preview=%s api_url=%s status_code=%s response_body=%s",
        conversation_id,
        supplier_details["supplier_id"],
        resolved_whatsapp_number,
        whatsapp_message[:160],
        result.get("api_url"),
        result.get("status_code"),
        result.get("error"),
    )
    logger.warning(
        "WhatsApp send failed for conversation %s supplier %s: %s "
        "(whatsapp_number=%s api_url=%s status_code=%s response_body=%s)",
        conversation_id,
        supplier_details["supplier_id"],
        result.get("error"),
        resolved_whatsapp_number,
        result.get("api_url"),
        result.get("status_code"),
        result.get("error"),
    )

async def _persist_and_emit_message(
    *,
    conversation_id: str,
    sender: str,
    content: str,
    file_url: str | None = None,
    file_name: str | None = None,
    file_type: str | None = None,
) -> bool:
    msg_data = {
        "room_id": conversation_id,
        "sender": sender,
        "content": content or "",
        "file_url": file_url,
        "file_name": file_name,
        "file_type": file_type,
    }

    # Persist with a short-lived fresh session; retry once on dropped connections.
    for attempt in range(2):
        try:
            with SessionLocal() as db:
                db.add(
                    Message(
                        room_id=conversation_id,
                        sender=sender,
                        content=content or "",
                        file_url=file_url,
                        file_name=file_name,
                        file_type=file_type,
                    )
                )
                db.commit()
            break
        except OperationalError:
            if attempt == 1:
                raise

    if sio is not None:
        await sio.emit("receive_message", msg_data, room=conversation_id)
        return True

    return False


async def process_supplier_reply(
    *,
    conversation_id: str,
    supplier_message: str | None = None,
    file_url: str | None = None,
    file_name: str | None = None,
    file_type: str | None = None,
    source_channel: str = "web",
    external_message_id: str | None = None,
) -> dict[str, object]:
    supplier_message = (supplier_message or "").strip()
    if not supplier_message and not file_url:
        raise HTTPException(
            status_code=400,
            detail="A supplier message or uploaded file is required.",
        )

    logger.info(
        "Processing supplier reply for conversation_id=%s via %s external_message_id=%s",
        conversation_id,
        source_channel,
        external_message_id or "",
    )

    supplier_socketio_emit_succeeded = await _persist_and_emit_message(
        conversation_id=conversation_id,
        sender="Supplier",
        content=supplier_message,
        file_url=file_url,
        file_name=file_name,
        file_type=file_type,
    )
    response = await run_negotiation_agent(
        conversation_id,
        supplier_message or None,
        file_url=file_url,
        file_name=file_name,
        file_type=file_type,
    )
    ai_socketio_emit_succeeded = await _emit_ai_message(conversation_id, response)
    return {
        "conversation_id": conversation_id,
        "status": "response",
        "message": response,
        "supplier_socketio_emit_succeeded": supplier_socketio_emit_succeeded,
        "ai_socketio_emit_succeeded": ai_socketio_emit_succeeded,
    }

@router.post("/start")
async def start_negotiation(request: StartNegotiationRequest):
    """Start a new negotiation for a restock request.

    The agent will retrieve the restock context and formulate an initial proposal.

    Args:
        request: StartNegotiationRequest with conversation_id and restock_request_id

    Returns:
        JSON response with the agent's initial offer
    """
    try:
        _debug_log(
            "[WA DEBUG] /negotiation/start entered: conversation_id=%s restock_request_id=%s",
            request.conversation_id,
            request.restock_request_id,
        )
        # Pass both IDs to the agent
        response = await run_negotiation_agent(
            conversation_id=request.conversation_id,
            restock_request_id=request.restock_request_id
        )
        _debug_log(
            "[WA DEBUG] /negotiation/start AI response ready: conversation_id=%s response_preview=%s",
            request.conversation_id,
            (response or "").strip()[:160],
        )
        await _emit_ai_message(request.conversation_id, response)
        return {
            "conversation_id": request.conversation_id,
            "status": "initial_offer",
            "message": response,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print("🔥 FULL TRACEBACK for negotiation start failure:")
        traceback.print_exc()
        logger.exception(
            "Negotiation start failed for conversation_id=%s",
            request.conversation_id,
        )
        detail = str(e).strip() or f"{type(e).__name__}: {repr(e)}"
        raise HTTPException(status_code=500, detail=f"Negotiation failed: {detail}")

@router.post("/webhook")
async def supplier_reply(request: SupplierReplyRequest):
    """Process a supplier's reply to a negotiation.

    The agent will respond to the supplier's counter-offer or accept the proposal
    if the terms are within the target price band.

    Args:
        request: SupplierReplyRequest with conversation_id and supplier_message

    Returns:
        JSON response with the agent's counter-offer or acceptance
    """
    try:
        return await process_supplier_reply(
            conversation_id=request.conversation_id,
            supplier_message=request.supplier_message,
            file_url=request.file_url,
            file_name=request.file_name,
            file_type=request.file_type,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print("🔥 FULL TRACEBACK for negotiation webhook failure:")
        traceback.print_exc()
        logger.exception(
            "Negotiation webhook failed for conversation_id=%s",
            request.conversation_id,
        )
        detail = str(e).strip() or f"{type(e).__name__}: {repr(e)}"
        raise HTTPException(status_code=500, detail=f"Negotiation response failed: {detail}")
