from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import httpx

from app.core.config import (
    TELEGRAM_API_BASE_URL,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_ENABLED,
)


logger = logging.getLogger(__name__)
_TIMEOUT = httpx.Timeout(15.0, connect=10.0)


def _result(
    *,
    ok: bool,
    action: str,
    status_code: int | None = None,
    body: Any = None,
    error: str | None = None,
    **extra: Any,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "ok": ok,
        "action": action,
        "status_code": status_code,
        "body": body,
        "error": error,
    }
    result.update(extra)
    return result


def _disabled_result(action: str, reason: str) -> dict[str, Any]:
    return _result(ok=False, action=action, error=reason)


def _bot_api_url(path: str) -> str:
    base = TELEGRAM_API_BASE_URL.rstrip("/")
    return f"{base}/bot{TELEGRAM_BOT_TOKEN}/{path.lstrip('/')}"


def _file_api_url(file_path: str) -> str:
    base = TELEGRAM_API_BASE_URL.rstrip("/")
    return f"{base}/file/bot{TELEGRAM_BOT_TOKEN}/{file_path.lstrip('/')}"


async def send_telegram_text(chat_id: str, message: str) -> dict[str, Any]:
    action = "send_telegram_text"
    if not TELEGRAM_ENABLED:
        return _disabled_result(action, "telegram_disabled")
    if not TELEGRAM_BOT_TOKEN:
        return _disabled_result(action, "missing_bot_token")
    if not chat_id:
        return _disabled_result(action, "missing_chat_id")

    payload = {"chat_id": chat_id, "text": message}

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(_bot_api_url("sendMessage"), json=payload)
        body = response.json()
    except httpx.TimeoutException as exc:
        logger.warning("telegram action=sendMessage chat_id=%s error=timeout", chat_id)
        return _result(ok=False, action=action, error=f"timeout: {exc}")
    except httpx.HTTPError as exc:
        logger.warning("telegram action=sendMessage chat_id=%s error=http_error", chat_id)
        return _result(ok=False, action=action, error=f"http_error: {exc}")
    except ValueError:
        body = response.text

    if response.is_success and isinstance(body, dict) and body.get("ok") is True:
        return _result(ok=True, action=action, status_code=response.status_code, body=body)

    return _result(
        ok=False,
        action=action,
        status_code=response.status_code,
        body=body,
        error="telegram_api_error",
    )


async def get_telegram_file(file_id: str) -> dict[str, Any]:
    action = "get_telegram_file"
    if not TELEGRAM_ENABLED:
        return _disabled_result(action, "telegram_disabled")
    if not TELEGRAM_BOT_TOKEN:
        return _disabled_result(action, "missing_bot_token")
    if not file_id:
        return _disabled_result(action, "missing_file_id")

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.get(_bot_api_url("getFile"), params={"file_id": file_id})
        body = response.json()
    except httpx.TimeoutException as exc:
        logger.warning("telegram action=getFile file_id=%s error=timeout", file_id)
        return _result(ok=False, action=action, error=f"timeout: {exc}")
    except httpx.HTTPError as exc:
        logger.warning("telegram action=getFile file_id=%s error=http_error", file_id)
        return _result(ok=False, action=action, error=f"http_error: {exc}")
    except ValueError:
        body = response.text

    file_path = None
    if isinstance(body, dict):
        file_path = ((body.get("result") or {}) if isinstance(body.get("result"), dict) else {}).get("file_path")

    if response.is_success and isinstance(body, dict) and body.get("ok") is True and file_path:
        return _result(
            ok=True,
            action=action,
            status_code=response.status_code,
            body=body,
            file_path=file_path,
        )

    logger.warning(
        "telegram action=getFile file_id=%s status_code=%s body=%s",
        file_id,
        response.status_code,
        body,
    )
    return _result(
        ok=False,
        action=action,
        status_code=response.status_code,
        body=body,
        error="telegram_api_error",
    )


async def download_telegram_file(file_path: str, destination_path: str) -> dict[str, Any]:
    action = "download_telegram_file"
    if not TELEGRAM_ENABLED:
        return _disabled_result(action, "telegram_disabled")
    if not TELEGRAM_BOT_TOKEN:
        return _disabled_result(action, "missing_bot_token")
    if not file_path:
        return _disabled_result(action, "missing_file_path")

    destination = Path(destination_path)
    destination.parent.mkdir(parents=True, exist_ok=True)

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.get(_file_api_url(file_path))
        response.raise_for_status()
        destination.write_bytes(response.content)
    except httpx.TimeoutException as exc:
        logger.warning("telegram action=downloadFile path=%s error=timeout", file_path)
        return _result(ok=False, action=action, error=f"timeout: {exc}")
    except httpx.HTTPError as exc:
        body: Any
        try:
            body = exc.response.text if exc.response is not None else None
        except Exception:
            body = None
        logger.warning("telegram action=downloadFile path=%s error=http_error", file_path)
        return _result(
            ok=False,
            action=action,
            status_code=exc.response.status_code if exc.response is not None else None,
            body=body,
            error=f"http_error: {exc}",
        )
    except OSError as exc:
        logger.warning("telegram action=downloadFile path=%s error=os_error", file_path)
        return _result(ok=False, action=action, error=f"os_error: {exc}")

    return _result(
        ok=True,
        action=action,
        status_code=response.status_code,
        body={"saved_to": str(destination)},
        destination_path=str(destination),
    )
