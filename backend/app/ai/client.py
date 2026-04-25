from __future__ import annotations

import json
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


def _messages_endpoint() -> str:
    return f"{ANTHROPIC_BASE_URL.rstrip('/')}/v1/messages"


def is_ai_configured() -> bool:
    return bool(ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY)


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

    # LLM responses can take a while (especially with tool loops). Use a long
    # read timeout, and retry once on transient timeouts.
    timeout_seconds = max(float(AI_TIMEOUT_SECONDS), 900.0)
    timeout = httpx.Timeout(connect=10.0, read=timeout_seconds, write=60.0, pool=10.0)

    logger = logging.getLogger(__name__)
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                if attempt == 0:
                    print("OUTGOING LLM PAYLOAD:", json.dumps(payload, indent=2, default=str))
                response = await client.post(
                    _messages_endpoint(), headers=headers, json=payload
                )
                try:
                    response.raise_for_status()
                    data = response.json()
                    
                    # Log token usage if provided by the gateway
                    usage = data.get("usage", {})
                    if usage:
                        print(f"[DEBUG] Token Usage: {json.dumps(usage)}")
                        
                    return data
                except httpx.HTTPStatusError as exc:
                    # Log the gateway's validation/error body for visibility (Ilmu/Anthropic often
                    # returns helpful JSON here, but sometimes it's plain text).
                    logger.error(
                        "LLM API returned non-2xx: %s %s\nResponse body:\n%s",
                        exc.response.status_code,
                        str(exc.request.url),
                        exc.response.text,
                    )
                    raise

                return response.json()
        except (httpx.ReadTimeout, httpx.ConnectTimeout) as exc:
            logger.warning(
                "LLM request timeout (attempt %s/2): %s",
                attempt + 1,
                repr(exc),
            )
            if attempt == 1:
                raise


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
