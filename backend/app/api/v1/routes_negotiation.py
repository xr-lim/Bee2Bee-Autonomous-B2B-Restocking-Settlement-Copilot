from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException
import traceback
import logging
import json
import re
import uuid

from app.ai.client import AITemporaryUnavailableError
from app.ai.negotiation_agent import run_negotiation_agent
from app.db.session import SessionLocal
from app.models.message import Message
from app.realtime import sio
from app.core.config import TELEGRAM_ENABLED
from app.services.telegram_service import send_telegram_text
from sqlalchemy.exc import OperationalError
from sqlalchemy import text


router = APIRouter(prefix="/negotiation", tags=["negotiation"])
logger = logging.getLogger(__name__)
_THINKING_TAG_RE = re.compile(r"<thinking>[\s\S]*?</thinking>", re.IGNORECASE)

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
    auto_translate_enabled: bool = Field(
        default=True,
        description="When false, supplier-facing AI replies should be generated in English instead of the supplier preferred language.",
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
    auto_translate_enabled: bool = Field(
        default=True,
        description="When false, supplier-facing AI replies should be generated in English instead of the supplier preferred language.",
    )

class ResumeNegotiationRequest(BaseModel):
    conversation_id: str = Field(
        ...,
        min_length=1,
        description="The paused conversation ID to resume.",
    )
    auto_translate_enabled: bool = Field(
        default=True,
        description="When false, supplier-facing AI replies should be generated in English instead of the supplier preferred language.",
    )


class ManualMessageRequest(BaseModel):
    conversation_id: str = Field(
        ...,
        min_length=1,
        description="The conversation ID to send this manual supplier-facing message to.",
    )
    message: str = Field(
        ...,
        min_length=1,
        description="The already-translated supplier-facing manual message.",
    )
    translated_content: str | None = Field(
        default=None,
        description="Optional English/admin-readable version of the saved message.",
    )


class SupplierMessageOnlyRequest(BaseModel):
    conversation_id: str = Field(
        ...,
        min_length=1,
        description="The conversation ID for this supplier message.",
    )
    supplier_message: str | None = Field(
        default=None,
        description="The supplier message to record without invoking AI.",
    )
    file_url: str | None = Field(default=None)
    file_name: str | None = Field(default=None)
    file_type: str | None = Field(default=None)


def _strip_internal_thinking(content: str) -> str:
    return _THINKING_TAG_RE.sub("", content or "").strip()


def _message_preview(content: str, limit: int = 160) -> str:
    cleaned = " ".join((content or "").split())
    return cleaned[:limit]


def _resolve_supplier_contact_for_conversation(
    conversation_id: str,
) -> tuple[str | None, str | None]:
    with SessionLocal() as db:
        row = db.execute(
            text(
                """
                SELECT c.supplier_id, s.telegram_chat_id
                FROM conversations c
                LEFT JOIN suppliers s ON s.id = c.supplier_id
                WHERE c.id = :conversation_id
                """
            ),
            {"conversation_id": conversation_id},
        ).mappings().first()

    if not row:
        return None, None

    return row.get("supplier_id"), row.get("telegram_chat_id")


def _log_telegram_event(event: str, **fields: object) -> None:
    logger.info(
        "telegram_event=%s details=%s",
        event,
        json.dumps(fields, ensure_ascii=True, default=str),
    )


async def _emit_ai_message(conversation_id: str, content: str) -> None:
    await _persist_and_emit_message(
        conversation_id=conversation_id,
        sender="AI",
        content=content,
        source_channel="ai",
    )

async def _persist_and_emit_message(
    *,
    conversation_id: str,
    sender: str,
    content: str,
    file_url: str | None = None,
    file_name: str | None = None,
    file_type: str | None = None,
    translated_content: str | None = None,
    source_channel: str = "web",
) -> None:
    message_id = str(uuid.uuid4())
    sender_type = _conversation_sender_type(sender)
    message_type = _conversation_message_type(
        source_channel=source_channel,
        file_type=file_type,
        file_url=file_url,
    )
    msg_data = {
        "id": message_id,
        "room_id": conversation_id,
        "sender": sender,
        "content": content or "",
        "file_url": file_url,
        "file_name": file_name,
        "file_type": file_type,
        "translated_content": translated_content,
        "source_channel": source_channel,
        "sender_type": sender_type,
        "message_type": message_type,
    }

    logger.info(
        "message_persist_start conversation_id=%s sender=%s has_file=%s file_name=%s file_type=%s",
        conversation_id,
        sender,
        bool(file_url),
        file_name,
        file_type,
    )

    # Persist with a short-lived fresh session; retry once on dropped connections.
    for attempt in range(2):
        try:
            with SessionLocal() as db:
                db.add(
                    Message(
                        id=message_id,
                        room_id=conversation_id,
                        sender=sender,
                        content=content or "",
                        file_url=file_url,
                        file_name=file_name,
                        file_type=file_type,
                    )
                )
                db.execute(
                    text(
                        """
                        INSERT INTO conversation_messages (
                            id,
                            conversation_id,
                            sender_type,
                            message_type,
                            content,
                            translated_content,
                            attachment_url
                        )
                        VALUES (
                            :id,
                            :conversation_id,
                            :sender_type,
                            :message_type,
                            :content,
                            :translated_content,
                            :attachment_url
                        )
                        ON CONFLICT (id) DO NOTHING
                        """
                    ),
                    {
                        "id": message_id,
                        "conversation_id": conversation_id,
                        "sender_type": sender_type,
                        "message_type": message_type,
                        "content": content or _attachment_fallback_content(
                            file_name=file_name,
                            file_type=file_type,
                        ),
                        "translated_content": translated_content,
                        "attachment_url": file_url,
                    },
                )
                db.execute(
                    text(
                        """
                        UPDATE conversations
                        SET latest_message = :latest_message,
                            updated_at = now()
                        WHERE id = :conversation_id
                        """
                    ),
                    {
                        "conversation_id": conversation_id,
                        "latest_message": content
                        or _attachment_fallback_content(
                            file_name=file_name,
                            file_type=file_type,
                        ),
                    },
                )
                db.commit()
            break
        except OperationalError:
            if attempt == 1:
                raise

    if sio is not None:
        logger.info(
            "socketio_emit_triggered event=receive_message room_id=%s sender=%s has_file=%s file_name=%s file_type=%s",
            conversation_id,
            sender,
            bool(file_url),
            file_name,
            file_type,
        )
        await sio.emit("receive_message", msg_data, room=conversation_id)
    else:
        logger.info(
            "socketio_emit_skipped room_id=%s sender=%s reason=sio_unavailable",
            conversation_id,
            sender,
        )


def _conversation_sender_type(sender: str) -> str:
    normalized = (sender or "").strip().lower()
    if "supplier" in normalized:
        return "supplier"
    if "system" in normalized:
        return "system"
    if "merchant" in normalized or "admin" in normalized:
        return "merchant"
    return "ai"


def _conversation_message_type(
    *,
    source_channel: str,
    file_type: str | None,
    file_url: str | None,
) -> str:
    normalized_file_type = (file_type or "").strip().lower()
    normalized_channel = (source_channel or "").strip().lower()

    if file_url:
        if "pdf" in normalized_file_type:
            return "pdf"
        if "image" in normalized_file_type:
            return "image"
        if "voice" in normalized_file_type or "audio" in normalized_file_type:
            return "voice_note"

    if normalized_channel in {"telegram", "whatsapp", "wechat", "email"}:
        return normalized_channel
    return "text"


def _attachment_fallback_content(
    *,
    file_name: str | None,
    file_type: str | None,
) -> str:
    normalized_file_type = (file_type or "").strip().lower()
    if file_name:
        return f"Uploaded {file_name}"
    if "pdf" in normalized_file_type:
        return "Uploaded a document"
    if "image" in normalized_file_type:
        return "Uploaded an image"
    return "Uploaded an attachment"


async def _maybe_send_ai_message_to_telegram(
    *,
    conversation_id: str,
    content: str,
    supplier_id: str | None = None,
    telegram_chat_id: str | None = None,
) -> None:
    clean_content = _strip_internal_thinking(content)
    resolved_supplier_id = supplier_id
    resolved_chat_id = telegram_chat_id

    if resolved_supplier_id is None or resolved_chat_id is None:
        resolved_supplier_id, resolved_chat_id = _resolve_supplier_contact_for_conversation(
            conversation_id
        )

    preview = _message_preview(clean_content)
    _log_telegram_event(
        "outbound_check",
        telegram_enabled=TELEGRAM_ENABLED,
        conversation_id=conversation_id,
        supplier_id=resolved_supplier_id,
        telegram_chat_id=resolved_chat_id,
        message_preview=preview,
    )

    if not TELEGRAM_ENABLED:
        _log_telegram_event(
            "outbound_skip",
            telegram_enabled=TELEGRAM_ENABLED,
            conversation_id=conversation_id,
            supplier_id=resolved_supplier_id,
            telegram_chat_id=resolved_chat_id,
            skip_reason="telegram_disabled",
            message_preview=preview,
        )
        return

    if not clean_content:
        _log_telegram_event(
            "outbound_skip",
            telegram_enabled=TELEGRAM_ENABLED,
            conversation_id=conversation_id,
            supplier_id=resolved_supplier_id,
            telegram_chat_id=resolved_chat_id,
            skip_reason="empty_clean_message",
            message_preview=preview,
        )
        return

    if not resolved_supplier_id:
        _log_telegram_event(
            "outbound_skip",
            telegram_enabled=TELEGRAM_ENABLED,
            conversation_id=conversation_id,
            supplier_id=resolved_supplier_id,
            telegram_chat_id=resolved_chat_id,
            skip_reason="missing_supplier_id",
            message_preview=preview,
        )
        return

    if not resolved_chat_id:
        _log_telegram_event(
            "outbound_skip",
            telegram_enabled=TELEGRAM_ENABLED,
            conversation_id=conversation_id,
            supplier_id=resolved_supplier_id,
            telegram_chat_id=resolved_chat_id,
            skip_reason="missing_telegram_chat_id",
            message_preview=preview,
        )
        return

    result = await send_telegram_text(resolved_chat_id, clean_content)
    if result.get("ok"):
        _log_telegram_event(
            "outbound_sent",
            telegram_enabled=TELEGRAM_ENABLED,
            conversation_id=conversation_id,
            supplier_id=resolved_supplier_id,
            telegram_chat_id=resolved_chat_id,
            message_preview=preview,
            telegram_status_code=result.get("status_code"),
        )
        return

    _log_telegram_event(
        "outbound_failed",
        telegram_enabled=TELEGRAM_ENABLED,
        conversation_id=conversation_id,
        supplier_id=resolved_supplier_id,
        telegram_chat_id=resolved_chat_id,
        message_preview=preview,
        telegram_status_code=result.get("status_code"),
        failure_response_body=result.get("body"),
        error=result.get("error"),
    )


async def _deliver_ai_message(
    *,
    conversation_id: str,
    content: str,
    supplier_id: str | None = None,
    telegram_chat_id: str | None = None,
) -> None:
    await _emit_ai_message(conversation_id, content)
    try:
        await _maybe_send_ai_message_to_telegram(
            conversation_id=conversation_id,
            content=content,
            supplier_id=supplier_id,
            telegram_chat_id=telegram_chat_id,
        )
    except Exception:
        logger.exception(
            "Telegram delivery helper failed for conversation_id=%s",
            conversation_id,
        )


async def _deliver_manual_message(
    *,
    conversation_id: str,
    content: str,
    translated_content: str | None = None,
) -> None:
    await _persist_and_emit_message(
        conversation_id=conversation_id,
        sender="Merchant",
        content=content,
        translated_content=translated_content,
        source_channel="web",
    )
    try:
        await _maybe_send_ai_message_to_telegram(
            conversation_id=conversation_id,
            content=content,
        )
    except Exception:
        logger.exception(
            "Telegram manual delivery helper failed for conversation_id=%s",
            conversation_id,
        )


async def process_supplier_reply(
    *,
    conversation_id: str,
    supplier_message: str | None = None,
    file_url: str | None = None,
    file_name: str | None = None,
    file_type: str | None = None,
    auto_translate_enabled: bool = True,
    source_channel: str = "web",
    supplier_id: str | None = None,
    telegram_chat_id: str | None = None,
) -> dict[str, str]:
    supplier_message = (supplier_message or "").strip()
    if not supplier_message and not file_url:
        raise HTTPException(
            status_code=400,
            detail="A supplier message or uploaded file is required.",
        )

    logger.info(
        "process_supplier_reply source_channel=%s conversation_id=%s supplier_id=%s telegram_chat_id=%s has_text=%s file_url=%s file_name=%s file_type=%s",
        source_channel,
        conversation_id,
        supplier_id,
        telegram_chat_id,
        bool(supplier_message),
        file_url,
        file_name,
        file_type,
    )

    await _persist_and_emit_message(
        conversation_id=conversation_id,
        sender="Supplier",
        content=supplier_message,
        file_url=file_url,
        file_name=file_name,
        file_type=file_type,
        source_channel=source_channel,
    )
    response = await run_negotiation_agent(
        conversation_id,
        supplier_message or None,
        file_url=file_url,
        file_name=file_name,
        file_type=file_type,
        auto_translate_enabled=auto_translate_enabled,
    )
    await _deliver_ai_message(
        conversation_id=conversation_id,
        content=response,
        supplier_id=supplier_id,
        telegram_chat_id=telegram_chat_id,
    )
    return {
        "conversation_id": conversation_id,
        "status": "response",
        "message": response,
    }


async def process_supplier_message_only(
    *,
    conversation_id: str,
    supplier_message: str | None = None,
    file_url: str | None = None,
    file_name: str | None = None,
    file_type: str | None = None,
    source_channel: str = "web",
) -> dict[str, str]:
    supplier_message = (supplier_message or "").strip()
    if not supplier_message and not file_url:
        raise HTTPException(
            status_code=400,
            detail="A supplier message or uploaded file is required.",
        )

    await _persist_and_emit_message(
        conversation_id=conversation_id,
        sender="Supplier",
        content=supplier_message,
        file_url=file_url,
        file_name=file_name,
        file_type=file_type,
        source_channel=source_channel,
    )
    return {
        "conversation_id": conversation_id,
        "status": "recorded",
        "message": supplier_message,
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
        # Pass both IDs to the agent
        response = await run_negotiation_agent(
            conversation_id=request.conversation_id,
            restock_request_id=request.restock_request_id,
            auto_translate_enabled=request.auto_translate_enabled,
        )
        await _deliver_ai_message(
            conversation_id=request.conversation_id,
            content=response,
        )
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

@router.post("/resume")
async def resume_negotiation(request: ResumeNegotiationRequest):
    """Resume a paused negotiation from the latest saved conversation context."""
    try:
        response = await run_negotiation_agent(
            conversation_id=request.conversation_id,
            auto_translate_enabled=request.auto_translate_enabled,
            resume_existing=True,
        )
        await _deliver_ai_message(
            conversation_id=request.conversation_id,
            content=response,
        )
        return {
            "conversation_id": request.conversation_id,
            "status": "resumed",
            "message": response,
        }
    except AITemporaryUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print("🔥 FULL TRACEBACK for negotiation resume failure:")
        traceback.print_exc()
        logger.exception(
            "Negotiation resume failed for conversation_id=%s",
            request.conversation_id,
        )
        detail = str(e).strip() or f"{type(e).__name__}: {repr(e)}"
        raise HTTPException(status_code=500, detail=f"Negotiation resume failed: {detail}")


@router.post("/manual-message")
async def manual_message(request: ManualMessageRequest):
    """Send an admin-authored supplier-facing message without invoking AI."""
    try:
        message = request.message.strip()
        if not message:
            raise HTTPException(status_code=400, detail="Manual message is required.")

        await _deliver_manual_message(
            conversation_id=request.conversation_id,
            content=message,
            translated_content=request.translated_content,
        )
        return {
            "conversation_id": request.conversation_id,
            "status": "sent",
            "message": message,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        print("🔥 FULL TRACEBACK for manual message failure:")
        traceback.print_exc()
        logger.exception(
            "Manual message failed for conversation_id=%s",
            request.conversation_id,
        )
        detail = str(e).strip() or f"{type(e).__name__}: {repr(e)}"
        raise HTTPException(status_code=500, detail=f"Manual message failed: {detail}")


@router.post("/supplier-message-only")
async def supplier_message_only(request: SupplierMessageOnlyRequest):
    """Record a supplier message without invoking AI, used during manual takeover."""
    try:
        return await process_supplier_message_only(
            conversation_id=request.conversation_id,
            supplier_message=request.supplier_message,
            file_url=request.file_url,
            file_name=request.file_name,
            file_type=request.file_type,
            source_channel="web",
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print("🔥 FULL TRACEBACK for supplier message-only failure:")
        traceback.print_exc()
        logger.exception(
            "Supplier message-only failed for conversation_id=%s",
            request.conversation_id,
        )
        detail = str(e).strip() or f"{type(e).__name__}: {repr(e)}"
        raise HTTPException(status_code=500, detail=f"Supplier message failed: {detail}")


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
            auto_translate_enabled=request.auto_translate_enabled,
            source_channel="web",
        )
    except AITemporaryUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
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
