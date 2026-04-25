from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.core.config import (
    AI_MAX_TOKENS,
    AI_PROVIDER,
    AI_TEMPERATURE,
    AI_TIMEOUT_SECONDS,
    ANTHROPIC_API_KEY,
    ANTHROPIC_AUTH_TOKEN,
    ANTHROPIC_BASE_URL,
    ANTHROPIC_MODEL,
    ANTHROPIC_VERSION,
    GEMINI_API_KEY,
    GEMINI_BASE_URL,
    GEMINI_MODEL,
)


logger = logging.getLogger(__name__)

def _messages_endpoint() -> str:
    if AI_PROVIDER == "gemini":
        return f"{GEMINI_BASE_URL.rstrip('/')}/chat/completions"
    return f"{ANTHROPIC_BASE_URL.rstrip('/')}/v1/messages"


def is_ai_configured() -> bool:
    if AI_PROVIDER == "gemini":
        return bool(GEMINI_API_KEY)
    return bool(ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY)


def masked_ai_secret() -> str:
    secret = GEMINI_API_KEY if AI_PROVIDER == "gemini" else (ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY)
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


def _anthropic_text_from_blocks(blocks: Any) -> str:
    if isinstance(blocks, str):
        return blocks
    if not isinstance(blocks, list):
        return json.dumps(blocks, default=str)

    text_parts: list[str] = []
    for block in blocks:
        if isinstance(block, str):
            text_parts.append(block)
            continue
        if not isinstance(block, dict):
            text_parts.append(json.dumps(block, default=str))
            continue

        if block.get("type") == "text":
            text_parts.append(str(block.get("text", "")))

    return "\n\n".join(part for part in text_parts if part).strip()


def _anthropic_messages_to_openai_messages(
    *,
    system_prompt: str | None,
    messages: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    openai_messages: list[dict[str, Any]] = []

    if system_prompt:
        openai_messages.append({"role": "system", "content": system_prompt})

    for message in messages:
        role = str(message.get("role", "user"))
        content = message.get("content")

        if isinstance(content, list):
            if role == "assistant":
                assistant_content = _anthropic_text_from_blocks(content)
                tool_calls: list[dict[str, Any]] = []

                for block in content:
                    if not isinstance(block, dict) or block.get("type") != "tool_use":
                        continue

                    tool_input = block.get("input", {})
                    try:
                        serialized_arguments = json.dumps(tool_input, default=str)
                    except Exception:
                        serialized_arguments = json.dumps({"raw_input": str(tool_input)})

                    tool_calls.append(
                        {
                            "id": str(block.get("id", "")),
                            "type": "function",
                            "function": {
                                "name": str(block.get("name", "")),
                                "arguments": serialized_arguments,
                            },
                        }
                    )

                assistant_message: dict[str, Any] = {
                    "role": "assistant",
                    "content": assistant_content or None,
                }
                if tool_calls:
                    assistant_message["tool_calls"] = tool_calls
                openai_messages.append(assistant_message)
                continue

            if role == "user" and all(
                isinstance(block, dict) and block.get("type") == "tool_result"
                for block in content
            ):
                for block in content:
                    block_content = block.get("content", "")
                    if not isinstance(block_content, str):
                        block_content = json.dumps(block_content, default=str)
                    openai_messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": str(block.get("tool_use_id", "")),
                            "content": block_content,
                        }
                    )
                continue

            openai_messages.append(
                {
                    "role": role,
                    "content": _anthropic_text_from_blocks(content),
                }
            )
            continue

        if content is None:
            openai_messages.append({"role": role, "content": ""})
            continue

        openai_messages.append(
            {
                "role": role,
                "content": content if isinstance(content, str) else str(content),
            }
        )

    return openai_messages


def _anthropic_tools_to_openai_tools(
    tools: list[dict[str, Any]] | None,
) -> list[dict[str, Any]] | None:
    if not tools:
        return None

    openai_tools: list[dict[str, Any]] = []
    for tool in tools:
        openai_tools.append(
            {
                "type": "function",
                "function": {
                    "name": str(tool.get("name", "")),
                    "description": str(tool.get("description", "")),
                    "parameters": tool.get("input_schema", {"type": "object", "properties": {}}),
                },
            }
        )
    return openai_tools


def _anthropic_tool_choice_to_openai(
    tool_choice: dict[str, Any] | None,
) -> str | dict[str, Any] | None:
    if not tool_choice:
        return None

    choice_type = str(tool_choice.get("type", "")).strip().lower()
    if choice_type == "auto":
        return "auto"
    if choice_type in {"any", "required"}:
        return "required"
    if choice_type == "tool":
        tool_name = tool_choice.get("name")
        if isinstance(tool_name, str) and tool_name.strip():
            return {
                "type": "function",
                "function": {"name": tool_name.strip()},
            }
    return None


def _openai_finish_reason_to_anthropic(finish_reason: str | None) -> str | None:
    if finish_reason == "tool_calls":
        return "tool_use"
    if finish_reason == "length":
        return "max_tokens"
    if finish_reason in {"stop", "content_filter"}:
        return "end_turn"
    return finish_reason


def _openai_response_to_anthropic_shape(response: Any) -> dict[str, Any]:
    choice = response.choices[0]
    message = choice.message

    content_blocks: list[dict[str, Any]] = []
    if isinstance(message.content, str) and message.content.strip():
        content_blocks.append({"type": "text", "text": message.content})

    for tool_call in message.tool_calls or []:
        raw_arguments = tool_call.function.arguments or "{}"
        try:
            parsed_arguments = json.loads(raw_arguments)
        except json.JSONDecodeError:
            parsed_arguments = {"raw_arguments": raw_arguments}

        content_blocks.append(
            {
                "type": "tool_use",
                "id": tool_call.id,
                "name": tool_call.function.name,
                "input": parsed_arguments,
            }
        )

    return {
        "id": getattr(response, "id", None),
        "model": getattr(response, "model", None),
        "role": "assistant",
        "content": content_blocks,
        "stop_reason": _openai_finish_reason_to_anthropic(choice.finish_reason),
    }


async def _create_message_gemini(
    *,
    system_prompt: str | None,
    messages: list[dict[str, Any]],
    model: str | None,
    temperature: float | None,
    max_tokens: int | None,
    tools: list[dict[str, Any]] | None,
    tool_choice: dict[str, Any] | None,
) -> dict[str, Any]:
    try:
        from openai import AsyncOpenAI
    except ImportError as exc:
        raise RuntimeError(
            "Gemini support requires the `openai` Python package. Install it before testing AI_PROVIDER=gemini."
        ) from exc

    openai_messages = _anthropic_messages_to_openai_messages(
        system_prompt=system_prompt,
        messages=messages,
    )
    openai_tools = _anthropic_tools_to_openai_tools(tools)
    openai_tool_choice = _anthropic_tool_choice_to_openai(tool_choice)

    payload: dict[str, Any] = {
        "model": model or GEMINI_MODEL,
        "messages": openai_messages,
        "max_tokens": max_tokens or AI_MAX_TOKENS,
        "temperature": AI_TEMPERATURE if temperature is None else temperature,
    }
    if openai_tools:
        payload["tools"] = openai_tools
    if openai_tool_choice is not None:
        payload["tool_choice"] = openai_tool_choice

    timeout_seconds = float(AI_TIMEOUT_SECONDS)

    for attempt in range(2):
        try:
            client = AsyncOpenAI(
                api_key=GEMINI_API_KEY,
                base_url=GEMINI_BASE_URL,
                timeout=timeout_seconds,
            )
            if attempt == 0:
                print("OUTGOING LLM PAYLOAD:", json.dumps(payload, indent=2, default=str))

            response = await client.chat.completions.create(**payload)
            return _openai_response_to_anthropic_shape(response)
        except Exception as exc:
            status_code = getattr(exc, "status_code", None)
            response_body = getattr(exc, "response", None)
            if status_code is not None:
                logger.error(
                    "Gemini OpenAI-compatible API returned non-2xx: %s %s\nResponse body:\n%s",
                    status_code,
                    _messages_endpoint(),
                    getattr(response_body, "text", ""),
                )
                raise

            error_name = type(exc).__name__
            if error_name in {"APITimeoutError", "TimeoutError"}:
                logger.warning(
                    "Gemini request timeout (attempt %s/2): %s",
                    attempt + 1,
                    repr(exc),
                )
                if attempt == 1:
                    raise
                continue
            raise


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

    if AI_PROVIDER == "gemini":
        return await _create_message_gemini(
            system_prompt=system_prompt,
            messages=payload_messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            tools=tools,
            tool_choice=tool_choice,
        )

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

    timeout_seconds = max(float(AI_TIMEOUT_SECONDS), 900.0)
    timeout = httpx.Timeout(connect=10.0, read=timeout_seconds, write=60.0, pool=10.0)

    logger.info(
        "Calling AI gateway endpoint=%s model=%s provider=%s configured=%s key=%s",
        _messages_endpoint(),
        payload["model"],
        AI_PROVIDER,
        is_ai_configured(),
        masked_ai_secret(),
    )
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                if attempt == 0:
                    print("OUTGOING LLM PAYLOAD:", json.dumps(payload, indent=2, default=str))
                response = await client.post(_messages_endpoint(), headers=headers, json=payload)
                try:
                    response.raise_for_status()
                except httpx.HTTPStatusError as exc:
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


def extract_ai_text(message_response: dict[str, Any]) -> str:
    output_text = message_response.get("output_text")
    if isinstance(output_text, str):
        return output_text.strip()

    if isinstance(message_response.get("choices"), list):
        choices = message_response.get("choices") or []
        if choices:
            message = choices[0].get("message", {})
            content = message.get("content")
            if isinstance(content, str):
                return content.strip()
            if isinstance(content, list):
                text_parts = []
                for block in content:
                    if isinstance(block, dict):
                        if block.get("type") == "text" and isinstance(block.get("text"), str):
                            text_parts.append(block["text"].strip())
                        elif isinstance(block.get("content"), str):
                            text_parts.append(block["content"].strip())
                return "\n\n".join(part for part in text_parts if part).strip()

    return extract_text(message_response)
