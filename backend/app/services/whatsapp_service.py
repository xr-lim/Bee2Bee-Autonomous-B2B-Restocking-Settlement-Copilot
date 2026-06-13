import logging
import re
from typing import Any

import httpx

from app.core.config import (
    WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_ENABLED,
    WHATSAPP_GRAPH_API_VERSION,
    WHATSAPP_PHONE_NUMBER_ID,
)


logger = logging.getLogger(__name__)


def _debug_log(message: str, *args: Any) -> None:
    logger.warning(message, *args)
    try:
        print(message % args if args else message)
    except Exception:
        print(message)


def normalize_phone_number(phone: str | None) -> str:
    digits_only = re.sub(r"\D+", "", phone or "")
    if digits_only.startswith("00"):
        return digits_only[2:]
    return digits_only


def _build_whatsapp_api_url() -> str:
    return (
        f"https://graph.facebook.com/"
        f"{WHATSAPP_GRAPH_API_VERSION}/{WHATSAPP_PHONE_NUMBER_ID}/messages"
    )


async def send_whatsapp_text(to_phone: str, message: str) -> dict[str, Any]:
    normalized_to = normalize_phone_number(to_phone)
    body = (message or "").strip()
    api_url = _build_whatsapp_api_url()

    if not WHATSAPP_ENABLED:
        return {
            "success": False,
            "skipped": True,
            "error": "WhatsApp integration is disabled.",
            "skip_reason": "whatsapp_disabled",
            "to_phone": normalized_to,
            "api_url": api_url,
        }

    if not normalized_to:
        return {
            "success": False,
            "skipped": True,
            "error": "Supplier WhatsApp number is missing or invalid.",
            "skip_reason": "missing_or_invalid_supplier_number",
            "to_phone": normalized_to,
            "api_url": api_url,
        }

    if not body:
        return {
            "success": False,
            "skipped": True,
            "error": "WhatsApp message body is empty.",
            "skip_reason": "empty_message_body",
            "to_phone": normalized_to,
            "api_url": api_url,
        }

    if not WHATSAPP_ACCESS_TOKEN or not WHATSAPP_PHONE_NUMBER_ID:
        _debug_log(
            "WhatsApp send skipped because credentials are incomplete. "
            "WHATSAPP_ENABLED is true but token or phone number ID is missing."
        )
        return {
            "success": False,
            "skipped": True,
            "error": "WhatsApp credentials are not fully configured.",
            "skip_reason": "missing_whatsapp_credentials",
            "to_phone": normalized_to,
            "api_url": api_url,
        }

    payload = {
        "messaging_product": "whatsapp",
        "to": normalized_to,
        "type": "text",
        "text": {
            "body": body,
        },
    }
    headers = {
        "Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }

    try:
        _debug_log(
            "WhatsApp API debug: enabled=%s graph_api_version=%s api_url=%s to_phone=%s message_preview=%s",
            WHATSAPP_ENABLED,
            WHATSAPP_GRAPH_API_VERSION,
            api_url,
            normalized_to,
            body[:160],
        )
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(api_url, headers=headers, json=payload)
            if response.content:
                try:
                    data = response.json()
                except ValueError:
                    data = {
                        "raw_response": response.text,
                    }
            else:
                data = {}

        if response.is_success:
            messages = data.get("messages") if isinstance(data, dict) else None
            message_id = None
            if isinstance(messages, list) and messages:
                first_message = messages[0]
                if isinstance(first_message, dict):
                    message_id = first_message.get("id")

            return {
                "success": True,
                "status_code": response.status_code,
                "to_phone": normalized_to,
                "message_id": message_id,
                "response_data": data,
                "api_url": api_url,
            }

        _debug_log(
            "WhatsApp API failed: status_code=%s api_url=%s response_body=%s",
            response.status_code,
            api_url,
            data,
        )
        return {
            "success": False,
            "status_code": response.status_code,
            "to_phone": normalized_to,
            "error": data,
            "api_url": api_url,
        }
    except httpx.HTTPError as exc:
        logger.exception("WhatsApp send request failed for %s", normalized_to)
        try:
            print(f"WhatsApp send request failed for {normalized_to}: {exc}")
        except Exception:
            pass
        return {
            "success": False,
            "to_phone": normalized_to,
            "error": str(exc),
            "api_url": api_url,
        }
