from __future__ import annotations

import logging
import secrets
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, Header, HTTPException, Request
from sqlalchemy import text

from app.api.v1.routes_negotiation import (
    process_supplier_message_only,
    process_supplier_reply,
)
from app.core.config import TELEGRAM_ENABLED, TELEGRAM_WEBHOOK_SECRET
from app.db.session import SessionLocal
from app.services.telegram_service import download_telegram_file, get_telegram_file


router = APIRouter(prefix="/telegram", tags=["telegram"])
logger = logging.getLogger(__name__)


def _keys(value: Any) -> list[str]:
    if isinstance(value, dict):
        return sorted(str(key) for key in value.keys())
    return []


def _first_present_file_like_field(message: dict[str, Any]) -> str | None:
    for field_name in (
        "document",
        "photo",
        "video",
        "audio",
        "voice",
        "animation",
        "sticker",
        "video_note",
    ):
        value = message.get(field_name)
        if value:
            return field_name
    return None


def _verify_secret(received_secret: str | None) -> None:
    expected_secret = TELEGRAM_WEBHOOK_SECRET
    if not expected_secret:
        raise HTTPException(status_code=403, detail="Telegram webhook secret is not configured.")
    if not received_secret or not secrets.compare_digest(received_secret, expected_secret):
        raise HTTPException(status_code=403, detail="Invalid Telegram webhook secret.")


def _resolve_supplier_by_chat_id(chat_id: str) -> dict[str, Any] | None:
    with SessionLocal() as db:
        return db.execute(
            text(
                """
                SELECT id, name, telegram_chat_id
                FROM suppliers
                WHERE telegram_chat_id = :chat_id
                """
            ),
            {"chat_id": chat_id},
        ).mappings().first()


def _list_supplier_conversations(supplier_id: str) -> list[dict[str, Any]]:
    with SessionLocal() as db:
        return db.execute(
            text(
                """
                SELECT id, supplier_id, state, updated_at, created_at
                FROM conversations
                WHERE supplier_id = :supplier_id
                ORDER BY updated_at DESC, created_at DESC
                """
            ),
            {"supplier_id": supplier_id},
        ).mappings().all()


def _resolve_text_conversation_for_supplier(
    supplier_id: str,
) -> tuple[dict[str, Any] | None, list[str]]:
    allowed_states = [
        "new_input",
        "needs_analysis",
        "waiting_reply",
        "counter_offer",
        "escalated",
        "accepted",
        "closed",
    ]
    conversations = _list_supplier_conversations(supplier_id)
    matching = [row for row in conversations if row.get("state") in allowed_states]

    if len(matching) > 1:
        logger.warning(
            "telegram TODO multiple text conversations for supplier_id=%s; choosing newest conversation_id=%s",
            supplier_id,
            matching[0].get("id"),
        )

    return (matching[0] if matching else None), allowed_states


def _resolve_document_conversation_for_supplier(
    supplier_id: str,
) -> tuple[dict[str, Any] | None, list[str], str | None]:
    allowed_states = ["accepted", "waiting_reply", "counter_offer", "closed"]
    conversations = _list_supplier_conversations(supplier_id)
    matching = [row for row in conversations if row.get("state") in allowed_states]

    priority_groups = [
        ("accepted", [row for row in matching if row.get("state") == "accepted"]),
        ("waiting_reply", [row for row in matching if row.get("state") == "waiting_reply"]),
        ("counter_offer", [row for row in matching if row.get("state") == "counter_offer"]),
    ]

    for state_name, rows in priority_groups:
        if rows:
            if len(rows) > 1:
                logger.warning(
                    "telegram TODO multiple %s conversations for supplier_id=%s; choosing newest conversation_id=%s",
                    state_name,
                    supplier_id,
                    rows[0].get("id"),
                )
            return rows[0], allowed_states, None

    closed_rows = [row for row in matching if row.get("state") == "closed"]
    if closed_rows:
        newest_overall = conversations[0] if conversations else None
        if newest_overall and newest_overall.get("state") == "closed":
            if len(closed_rows) > 1:
                logger.warning(
                    "telegram TODO multiple closed conversations for supplier_id=%s; choosing newest conversation_id=%s",
                    supplier_id,
                    closed_rows[0].get("id"),
                )
            return closed_rows[0], allowed_states, None
        return None, allowed_states, "closed_conversation_not_newest"

    return None, allowed_states, "no_matching_document_state"


def _build_public_upload_url(request: Request, filename: str) -> str:
    base_url = str(request.base_url).rstrip("/")
    return f"{base_url}/uploads/{quote(filename)}"


def _document_is_pdf(file_name: str, mime_type: str) -> bool:
    normalized_name = (file_name or "").strip().lower()
    normalized_mime = (mime_type or "").strip().lower()
    return normalized_mime == "application/pdf" or normalized_name.endswith(".pdf")


async def _handle_text_message(
    *,
    conversation_id: str,
    supplier_id: str,
    chat_id: str,
    supplier_message: str,
) -> dict[str, Any]:
    return await process_supplier_reply(
        conversation_id=conversation_id,
        supplier_message=supplier_message,
        source_channel="telegram",
        supplier_id=supplier_id,
        telegram_chat_id=chat_id,
    )


async def _handle_pdf_document(
    *,
    request: Request,
    conversation_id: str,
    supplier_id: str,
    chat_id: str,
    document: dict[str, Any],
    caption: str | None,
) -> dict[str, Any]:
    file_id = str(document.get("file_id") or "").strip()
    file_name = str(document.get("file_name") or f"telegram-{uuid.uuid4().hex}.pdf").strip()
    mime_type = str(document.get("mime_type") or "").strip()
    file_size = document.get("file_size")

    logger.info(
        "telegram_document_metadata conversation_id=%s supplier_id=%s chat_id=%s file_id=%s file_name=%s mime_type=%s file_size=%s",
        conversation_id,
        supplier_id,
        chat_id,
        file_id,
        file_name,
        mime_type,
        file_size,
    )

    if not _document_is_pdf(file_name, mime_type):
        logger.info(
            "telegram inbound skip conversation_id=%s supplier_id=%s chat_id=%s reason=unsupported_document_type mime_type=%s file_name=%s",
            conversation_id,
            supplier_id,
            chat_id,
            mime_type,
            file_name,
        )
        return {"status": "skipped", "reason": "unsupported_document_type"}

    telegram_file = await get_telegram_file(file_id)
    if not telegram_file.get("ok") or not telegram_file.get("file_path"):
        logger.warning(
            "telegram inbound file lookup failed conversation_id=%s supplier_id=%s chat_id=%s file_id=%s status_code=%s body=%s",
            conversation_id,
            supplier_id,
            chat_id,
            file_id,
            telegram_file.get("status_code"),
            telegram_file.get("body"),
        )
        return {"status": "skipped", "reason": "telegram_file_lookup_failed"}

    uploads_dir = Path("uploads")
    uploads_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file_name).suffix or ".pdf"
    stored_name = f"{uuid.uuid4()}{suffix}"
    destination_path = uploads_dir / stored_name

    download_result = await download_telegram_file(
        telegram_file["file_path"],
        str(destination_path),
    )
    if not download_result.get("ok"):
        logger.warning(
            "telegram inbound file download failed conversation_id=%s supplier_id=%s chat_id=%s file_id=%s status_code=%s body=%s",
            conversation_id,
            supplier_id,
            chat_id,
            file_id,
            download_result.get("status_code"),
            download_result.get("body"),
        )
        return {"status": "skipped", "reason": "telegram_file_download_failed"}

    logger.info(
        "telegram inbound pdf downloaded conversation_id=%s supplier_id=%s chat_id=%s file_name=%s local_path=%s",
        conversation_id,
        supplier_id,
        chat_id,
        file_name,
        destination_path,
    )
    public_file_url = _build_public_upload_url(request, stored_name)
    logger.info(
        "telegram inbound public_file_url conversation_id=%s supplier_id=%s chat_id=%s file_url=%s",
        conversation_id,
        supplier_id,
        chat_id,
        public_file_url,
    )
    logger.info(
        "telegram inbound calling_process_supplier_reply conversation_id=%s supplier_id=%s chat_id=%s file_url=%s file_name=%s file_type=pdf",
        conversation_id,
        supplier_id,
        chat_id,
        public_file_url,
        file_name,
    )
    return await process_supplier_reply(
        conversation_id=conversation_id,
        supplier_message=(caption or "").strip() or None,
        file_url=public_file_url,
        file_name=file_name,
        file_type="pdf",
        source_channel="telegram",
        supplier_id=supplier_id,
        telegram_chat_id=chat_id,
    )


@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(
        default=None,
        alias="X-Telegram-Bot-Api-Secret-Token",
    ),
):
    print("Telegram webhook received")
    payload = await request.json()
    print(
        "top-level update keys=",
        _keys(payload),
        "update_id=",
        payload.get("update_id"),
        "message exists=",
        isinstance(payload.get("message"), dict),
        "edited_message exists=",
        isinstance(payload.get("edited_message"), dict),
        "channel_post exists=",
        isinstance(payload.get("channel_post"), dict),
        "callback_query exists=",
        isinstance(payload.get("callback_query"), dict),
    )

    message = payload.get("message")
    if isinstance(message, dict):
        chat = message.get("chat") or {}
        chat_id = str(chat.get("id") or "").strip()
        document = message.get("document")
        print(
            "message keys=",
            _keys(message),
            "chat_id=",
            chat_id,
            "text exists=",
            bool(str(message.get("text") or "").strip()),
            "document exists=",
            isinstance(document, dict),
            "photo exists=",
            bool(message.get("photo")),
            "video exists=",
            bool(message.get("video")),
            "caption exists=",
            bool(str(message.get("caption") or "").strip()),
        )

        if isinstance(document, dict):
            print(
                "document metadata chat_id=",
                chat_id,
                "file_id=",
                document.get("file_id"),
                "file_unique_id=",
                document.get("file_unique_id"),
                "file_name=",
                document.get("file_name"),
                "mime_type=",
                document.get("mime_type"),
                "file_size=",
                document.get("file_size"),
            )
        else:
            file_like_field = _first_present_file_like_field(message)
            if file_like_field:
                print("file-like field present chat_id=", chat_id, "field_name=", file_like_field)

    _verify_secret(x_telegram_bot_api_secret_token)

    if not TELEGRAM_ENABLED:
        print("skip reason=telegram_disabled")
        logger.info("telegram inbound skip reason=telegram_disabled")
        return {"status": "skipped", "reason": "telegram_disabled"}

    if not isinstance(message, dict):
        print(
            "skip reason=unsupported_update_type",
            "top_level_keys=",
            _keys(payload),
            "update_id=",
            payload.get("update_id"),
        )
        logger.info(
            "telegram inbound skip reason=unsupported_update_type payload_shape top_level_keys=%s update_id=%s",
            _keys(payload),
            payload.get("update_id"),
        )
        return {"status": "skipped", "reason": "unsupported_update_type"}

    chat = message.get("chat") or {}
    chat_id = str(chat.get("id") or "").strip()
    document = message.get("document")
    logger.info(
        "telegram webhook parsed chat_id=%s has_text=%s has_document=%s",
        chat_id,
        bool(str(message.get("text") or "").strip()),
        isinstance(document, dict),
    )
    if not chat_id:
        print("skip reason=missing_chat_id")
        logger.info("telegram inbound skip reason=missing_chat_id")
        return {"status": "skipped", "reason": "missing_chat_id"}

    supplier = _resolve_supplier_by_chat_id(chat_id)
    if not supplier:
        print("skip reason=supplier_not_found", "chat_id=", chat_id)
        logger.warning("telegram inbound skip chat_id=%s reason=supplier_not_found", chat_id)
        return {"status": "skipped", "reason": "supplier_not_found"}
    logger.info(
        "telegram webhook supplier_matched chat_id=%s supplier_id=%s",
        chat_id,
        supplier["id"],
    )

    text_message = str(message.get("text") or "").strip()
    caption = str(message.get("caption") or "").strip() or None
    incoming_message_type = (
        "document" if isinstance(document, dict) else "text" if text_message else "other"
    )

    if isinstance(document, dict):
        conversation, allowed_states, skip_reason = _resolve_document_conversation_for_supplier(
            str(supplier["id"])
        )
    elif text_message:
        conversation, allowed_states = _resolve_text_conversation_for_supplier(
            str(supplier["id"])
        )
        skip_reason = None
    else:
        conversation = None
        allowed_states = []
        skip_reason = None

    logger.info(
        "telegram conversation_match_attempt message_type=%s allowed_states=%s supplier_id=%s",
        incoming_message_type,
        allowed_states,
        supplier["id"],
    )
    print(
        "incoming message type=",
        incoming_message_type,
        "allowed states used=",
        allowed_states,
        "supplier_id=",
        supplier["id"],
    )

    if not conversation:
        final_skip_reason = (
            skip_reason
            if incoming_message_type == "document" and skip_reason
            else "no_active_conversation"
        )
        print(
            "skip reason=",
            final_skip_reason,
            "supplier_id=",
            supplier["id"],
            "chat_id=",
            chat_id,
            "message_type=",
            incoming_message_type,
            "allowed_states=",
            allowed_states,
        )
        logger.warning(
            "telegram inbound skip supplier_id=%s chat_id=%s message_type=%s allowed_states=%s reason=%s",
            supplier["id"],
            chat_id,
            incoming_message_type,
            allowed_states,
            final_skip_reason,
        )
        return {"status": "skipped", "reason": final_skip_reason}

    conversation_id = str(conversation["id"])
    supplier_id = str(supplier["id"])
    logger.info(
        "telegram webhook conversation_matched supplier_id=%s chat_id=%s message_type=%s conversation_id=%s conversation_state=%s",
        supplier_id,
        chat_id,
        incoming_message_type,
        conversation_id,
        conversation.get("state"),
    )
    print(
        "matched conversation_id=",
        conversation_id,
        "matched conversation_state=",
        conversation.get("state"),
    )

    if text_message:
        if conversation.get("state") == "escalated":
            return await process_supplier_message_only(
                conversation_id=conversation_id,
                supplier_message=text_message,
                source_channel="telegram",
            )

        return await _handle_text_message(
            conversation_id=conversation_id,
            supplier_id=supplier_id,
            chat_id=chat_id,
            supplier_message=text_message,
        )

    if isinstance(document, dict):
        return await _handle_pdf_document(
            request=request,
            conversation_id=conversation_id,
            supplier_id=supplier_id,
            chat_id=chat_id,
            document=document,
            caption=caption,
        )

    file_like_field = _first_present_file_like_field(message)
    print(
        "skip reason=unsupported_message_content",
        "conversation_id=",
        conversation_id,
        "supplier_id=",
        supplier_id,
        "chat_id=",
        chat_id,
        "message_keys=",
        _keys(message),
        "file_like_field=",
        file_like_field,
    )
    logger.info(
        "telegram inbound skip conversation_id=%s supplier_id=%s chat_id=%s reason=unsupported_message_content message_keys=%s file_like_field=%s",
        conversation_id,
        supplier_id,
        chat_id,
        _keys(message),
        file_like_field,
    )
    return {"status": "skipped", "reason": "unsupported_message_content"}
