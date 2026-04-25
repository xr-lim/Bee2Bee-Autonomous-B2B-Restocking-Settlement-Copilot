from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import (
    AI_MAX_TOKENS,
    AI_TEMPERATURE,
    AI_TIMEOUT_SECONDS,
    ANTHROPIC_API_KEY,
    ANTHROPIC_AUTH_TOKEN,
    ANTHROPIC_BASE_URL,
    ANTHROPIC_MODEL,
    ANTHROPIC_VERSION,
)


logger = logging.getLogger(__name__)


def _messages_endpoint() -> str:
    return f"{ANTHROPIC_BASE_URL.rstrip('/')}/v1/messages"


def is_ai_configured() -> bool:
    return bool(ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY)


def masked_ai_secret() -> str:
    secret = ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY
    if not secret:
        return "missing"
    if len(secret) <= 8:
        return "*" * len(secret)
    return f"{secret[:4]}...{secret[-4:]}"


def _auth_headers() -> dict[str, str]:
    if ANTHROPIC_AUTH_TOKEN:
        return {"Authorization": f"Bearer {ANTHROPIC_AUTH_TOKEN}"}
    if ANTHROPIC_API_KEY:
        return {"x-api-key": ANTHROPIC_API_KEY}
    raise RuntimeError(
        "AI model is not configured. Set ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY in backend/.env."
    )


async def create_message(
    *,
    prompt: str | None = None,
    system_prompt: str | None = None,
    messages: list[dict[str, Any]] | None = None,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    tools: list[dict[str, Any]] | None = None,
    tool_choice: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload_messages = messages
    if payload_messages is None:
        if prompt is None:
            raise ValueError("Provide either prompt or messages when creating an AI message.")
        payload_messages = [{"role": "user", "content": prompt}]

    headers = {
        "content-type": "application/json",
        "anthropic-version": ANTHROPIC_VERSION,
        **_auth_headers(),
    }
    payload = {
        "model": model or ANTHROPIC_MODEL,
        "max_tokens": max_tokens or AI_MAX_TOKENS,
        "temperature": AI_TEMPERATURE if temperature is None else temperature,
        "messages": payload_messages,
    }
    if system_prompt is not None:
        payload["system"] = system_prompt
    if tools:
        payload["tools"] = tools
    if tool_choice:
        payload["tool_choice"] = tool_choice

    logger.info(
        "Calling AI gateway endpoint=%s model=%s configured=%s key=%s",
        _messages_endpoint(),
        payload["model"],
        is_ai_configured(),
        masked_ai_secret(),
    )

    async with httpx.AsyncClient(timeout=AI_TIMEOUT_SECONDS) as client:
        response = await client.post(_messages_endpoint(), headers=headers, json=payload)
        response.raise_for_status()
        return response.json()


def messages_endpoint() -> str:
    return _messages_endpoint()


def extract_text(message_response: dict[str, Any]) -> str:
    blocks = message_response.get("content", [])
    text_parts = [
        block.get("text", "").strip()
        for block in blocks
        if isinstance(block, dict) and block.get("type") == "text"
    ]
    return "\n\n".join(part for part in text_parts if part).strip()
