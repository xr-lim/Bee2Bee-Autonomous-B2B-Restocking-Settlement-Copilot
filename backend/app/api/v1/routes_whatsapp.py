import logging

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy import text

from app.api.v1.routes_negotiation import process_supplier_reply
from app.core.config import WHATSAPP_VERIFY_TOKEN
from app.db.session import SessionLocal
from app.services.whatsapp_service import normalize_phone_number


router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])
logger = logging.getLogger(__name__)


def _debug_log(message: str, *args: object) -> None:
    logger.warning(message, *args)
    try:
        print(message % args if args else message)
    except Exception:
        print(message)


def _find_supplier_by_whatsapp_number(phone_number: str) -> dict[str, str] | None:
    normalized_target = normalize_phone_number(phone_number)
    if not normalized_target:
        return None

    try:
        with SessionLocal() as db:
            rows = db.execute(
                text(
                    """
                    select id, name, whatsapp_number
                    from suppliers
                    where whatsapp_number is not null
                    """
                )
            ).mappings().all()
    except Exception:
        logger.exception("Unable to query suppliers by WhatsApp number")
        return None

    for row in rows:
        supplier_number = normalize_phone_number(row.get("whatsapp_number"))
        if supplier_number == normalized_target:
            return {
                "id": row["id"],
                "name": row["name"],
                "whatsapp_number": row["whatsapp_number"],
            }

    return None


def _find_active_conversation_for_supplier(supplier_id: str) -> dict[str, str] | None:
    with SessionLocal() as db:
        # TODO: add explicit conversation disambiguation once suppliers can have
        # multiple active negotiations across channels at the same time.
        row = db.execute(
            text(
                """
                select id, state
                from conversations
                where supplier_id = :supplier_id
                  and state in (
                    'new_input',
                    'needs_analysis',
                    'counter_offer',
                    'waiting_reply',
                    'accepted'
                  )
                order by updated_at desc nulls last, created_at desc nulls last
                limit 1
                """
            ),
            {
                "supplier_id": supplier_id,
            },
        ).mappings().first()

    if not row:
        return None

    return {
        "id": row["id"],
        "state": row["state"],
    }


def _extract_whatsapp_messages(payload: dict) -> list[dict]:
    parsed_messages: list[dict] = []

    for entry in payload.get("entry", []):
        if not isinstance(entry, dict):
            continue
        for change in entry.get("changes", []):
            if not isinstance(change, dict):
                continue
            value = change.get("value")
            if not isinstance(value, dict):
                continue
            for message in value.get("messages", []):
                if isinstance(message, dict):
                    parsed_messages.append(message)

    return parsed_messages


def _payload_summary(payload: dict) -> tuple[str, int, int, bool]:
    payload_kind = type(payload).__name__
    entries = payload.get("entry", [])
    if not isinstance(entries, list):
        return payload_kind, 0, 0, False

    entry_count = len(entries)
    change_count = 0
    has_messages_field = False

    for entry in entries:
        if not isinstance(entry, dict):
            continue
        changes = entry.get("changes", [])
        if not isinstance(changes, list):
            continue
        change_count += len(changes)
        for change in changes:
            if not isinstance(change, dict):
                continue
            value = change.get("value")
            if isinstance(value, dict) and "messages" in value:
                has_messages_field = True

    return payload_kind, entry_count, change_count, has_messages_field


@router.get("/webhook")
async def verify_whatsapp_webhook(
    hub_mode: str | None = Query(default=None, alias="hub.mode"),
    hub_verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(default=None, alias="hub.challenge"),
):
    if (
        hub_mode == "subscribe"
        and hub_verify_token
        and hub_verify_token == WHATSAPP_VERIFY_TOKEN
    ):
        return PlainTextResponse(hub_challenge or "")

    raise HTTPException(status_code=403, detail="Webhook verification failed.")


@router.post("/webhook")
async def receive_whatsapp_webhook(request: Request):
    _debug_log("[WA WEBHOOK] POST /api/v1/whatsapp/webhook received")
    raw_payload = await request.json()
    payload = raw_payload if isinstance(raw_payload, dict) else {}
    payload_kind, entry_count, change_count, has_messages_field = _payload_summary(payload)
    _debug_log(
        "[WA WEBHOOK] payload summary: kind=%s entry_count=%s change_count=%s has_value_messages=%s",
        payload_kind,
        entry_count,
        change_count,
        has_messages_field,
    )
    messages = _extract_whatsapp_messages(payload)
    if not messages:
        _debug_log(
            "[WA WEBHOOK] skipped: reason=%s entry_count=%s change_count=%s has_value_messages=%s",
            "no_messages_in_payload",
            entry_count,
            change_count,
            has_messages_field,
        )

    processed_messages: list[dict[str, str]] = []
    ignored_messages: list[dict[str, str]] = []

    for message in messages:
        message_type = message.get("type")
        sender_phone = message.get("from")
        external_message_id = message.get("id")
        normalized_sender_phone = normalize_phone_number(str(sender_phone or ""))
        text_payload = message.get("text")
        body = text_payload.get("body") if isinstance(text_payload, dict) else None
        message_preview = str(body or "").strip()[:160]

        _debug_log(
            "[WA WEBHOOK] message parsed: message_id=%s sender_phone=%s normalized_sender_phone=%s message_type=%s text_preview=%s",
            external_message_id or "",
            sender_phone or "",
            normalized_sender_phone,
            message_type or "",
            message_preview,
        )

        if message_type != "text":
            _debug_log(
                "[WA WEBHOOK] skipped: reason=%s message_id=%s sender_phone=%s normalized_sender_phone=%s message_type=%s",
                "unsupported_message_type",
                external_message_id or "",
                sender_phone or "",
                normalized_sender_phone,
                message_type or "",
            )
            ignored_messages.append(
                {
                    "from": str(sender_phone or ""),
                    "message_id": str(external_message_id or ""),
                    "reason": f"unsupported_type:{message_type}",
                }
            )
            continue

        if not body or not str(body).strip():
            _debug_log(
                "[WA WEBHOOK] skipped: reason=%s message_id=%s sender_phone=%s normalized_sender_phone=%s",
                "no_messages_in_payload",
                external_message_id or "",
                sender_phone or "",
                normalized_sender_phone,
            )
            ignored_messages.append(
                {
                    "from": str(sender_phone or ""),
                    "message_id": str(external_message_id or ""),
                    "reason": "empty_text_body",
                }
            )
            continue

        supplier = _find_supplier_by_whatsapp_number(str(sender_phone or ""))
        if not supplier:
            _debug_log(
                "[WA WEBHOOK] skipped: reason=%s message_id=%s sender_phone=%s normalized_sender_phone=%s matched_supplier_id=%s",
                "supplier_not_found",
                external_message_id or "",
                sender_phone or "",
                normalized_sender_phone,
                None,
            )
            ignored_messages.append(
                {
                    "from": str(sender_phone or ""),
                    "message_id": str(external_message_id or ""),
                    "reason": "supplier_not_found",
                }
            )
            continue

        _debug_log(
            "[WA WEBHOOK] supplier matched: message_id=%s sender_phone=%s normalized_sender_phone=%s matched_supplier_id=%s",
            external_message_id or "",
            sender_phone or "",
            normalized_sender_phone,
            supplier["id"],
        )

        conversation = _find_active_conversation_for_supplier(supplier["id"])
        if not conversation:
            _debug_log(
                "[WA WEBHOOK] skipped: reason=%s message_id=%s matched_supplier_id=%s matched_conversation_id=%s",
                "active_conversation_not_found",
                external_message_id or "",
                supplier["id"],
                None,
            )
            ignored_messages.append(
                {
                    "from": str(sender_phone or ""),
                    "message_id": str(external_message_id or ""),
                    "reason": "active_conversation_not_found",
                }
            )
            continue

        _debug_log(
            "[WA WEBHOOK] conversation matched: message_id=%s matched_supplier_id=%s matched_conversation_id=%s",
            external_message_id or "",
            supplier["id"],
            conversation["id"],
        )
        _debug_log(
            "[WA WEBHOOK] process_supplier_reply called: message_id=%s matched_supplier_id=%s matched_conversation_id=%s",
            external_message_id or "",
            supplier["id"],
            conversation["id"],
        )
        result = await process_supplier_reply(
            conversation_id=conversation["id"],
            supplier_message=str(body).strip(),
            source_channel="whatsapp",
            external_message_id=str(external_message_id or ""),
        )
        _debug_log(
            "[WA WEBHOOK] process_supplier_reply completed: message_id=%s matched_supplier_id=%s matched_conversation_id=%s supplier_socketio_emit_succeeded=%s ai_socketio_emit_succeeded=%s",
            external_message_id or "",
            supplier["id"],
            conversation["id"],
            result.get("supplier_socketio_emit_succeeded"),
            result.get("ai_socketio_emit_succeeded"),
        )
        processed_messages.append(
            {
                "conversation_id": conversation["id"],
                "supplier_id": supplier["id"],
                "message_id": str(external_message_id or ""),
            }
        )

    return {
        "status": "ok",
        "processed_count": len(processed_messages),
        "ignored_count": len(ignored_messages),
        "processed_messages": processed_messages,
        "ignored_messages": ignored_messages,
    }
