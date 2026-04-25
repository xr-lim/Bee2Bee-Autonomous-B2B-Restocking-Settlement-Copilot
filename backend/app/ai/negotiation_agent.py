from typing import Any

import json

from app.ai.client import create_message, extract_text
from app.ai.tools import (
    NEGOTIATION_SYSTEM_PROMPT,
    get_restock_context,
    update_conversation_state,
    create_final_order,
    record_invoice,
)


async def run_negotiation_agent(conversation_id: str, supplier_message: str | None = None, restock_request_id: str | None = None) -> str:
    """Run the negotiation agent for restock order discussions.

    Args:
        conversation_id: The ID of the conversation to continue or start
        supplier_message: The supplier's message, or None to start the negotiation
        restock_request_id: The exact ID of the restock request (required when starting)

    Returns:
        The agent's response text
    """
    # Prepare the input message
    if supplier_message is None:
        # Starting negotiation - agent should formulate initial proposal
        input_message = f"Start a negotiation for conversation {conversation_id}. Get the context and make an initial proposal."

        # Explicitly give the agent the ID so it doesn't guess
        if restock_request_id:
            input_message += f" Start by fetching the budget context. You MUST use the get_restock_context tool with request_id: {restock_request_id}."

    else:
        # Responding to supplier's message
        input_message = (
            f"Conversation {conversation_id}: {supplier_message} "
            "ALWAYS start by using get_restock_context with conversation_id to get the target prices and product details. "
            "Then evaluate the supplier's offer against our budget constraints."
        )

    tools = [
        {
            "name": "get_restock_context",
            "description": "Get restock context",
            "input_schema": {
                "type": "object",
                "properties": {
                    "request_id": { "type": "string" },
                    "conversation_id": { "type": "string" }
                }
            }
        },
        {
            "name": "update_conversation_state",
            "description": "Update state",
            "input_schema": {
                "type": "object",
                "properties": {
                    "conversation_id": { "type": "string" },
                    "new_state": { "type": "string" },
                    "message": { "type": "string" }
                },
                "required": ["conversation_id", "new_state", "message"]
            }
        },
        {
            "name": "create_final_order",
            "description": "Create order",
            "input_schema": {
                "type": "object",
                "properties": {
                    "restock_request_id": { "type": "string" },
                    "supplier_id": { "type": "string" },
                    "final_price": { "type": "number" },
                    "final_qty": { "type": "integer" }
                },
                "required": ["restock_request_id", "supplier_id", "final_price", "final_qty"]
            }
        },
        {
            "name": "record_invoice",
            "description": "Record invoice",
            "input_schema": {
                "type": "object",
                "properties": {
                    "order_id": { "type": "string" },
                    "amount": { "type": "number" },
                    "invoice_number": { "type": "string" },
                    "file_url": { "type": "string" }
                },
                "required": ["order_id", "amount", "invoice_number", "file_url"]
            }
        }
    ]

    # Initialize conversation messages
    messages = [{"role": "user", "content": input_message}]

    # Tool-calling loop
    max_iterations = 10  # Prevent infinite loops
    iteration = 0
    must_fetch_context = True

    allowed_block_types = {"text", "image", "tool_use", "tool_result"}

    def sanitize_blocks(blocks: Any) -> list[dict[str, Any]]:
        """Ensure blocks strictly match Anthropic Messages API schema.

        The Anthropic Messages API requires that if `content` is a list, every element
        must be a dictionary block of type: text|image|tool_use|tool_result.

        Some gateways may return extra block types (ex: `thinking`) which must not be
        echoed back in subsequent requests.
        """

        if isinstance(blocks, str):
            return [{"type": "text", "text": blocks}]

        if not isinstance(blocks, list):
            return [{"type": "text", "text": json.dumps(blocks, default=str)}]

        sanitized: list[dict[str, Any]] = []
        for block in blocks:
            if isinstance(block, str):
                sanitized.append({"type": "text", "text": block})
                continue

            if block is None:
                sanitized.append({"type": "text", "text": ""})
                continue

            if not isinstance(block, dict):
                sanitized.append({"type": "text", "text": json.dumps(block, default=str)})
                continue

            block_type = block.get("type")
            if block_type in allowed_block_types:
                if block_type == "text":
                    sanitized.append({"type": "text", "text": str(block.get("text", ""))})
                elif block_type == "tool_use":
                    # Require the minimum fields Anthropic expects; otherwise coerce to text.
                    if isinstance(block.get("id"), str) and isinstance(block.get("name"), str):
                        sanitized.append(block)
                    else:
                        sanitized.append({"type": "text", "text": json.dumps(block, default=str)})
                elif block_type == "tool_result":
                    if isinstance(block.get("tool_use_id"), str):
                        sanitized.append(block)
                    else:
                        sanitized.append({"type": "text", "text": json.dumps(block, default=str)})
                else:
                    sanitized.append(block)
                continue

            # Coerce unknown/invalid block types to plain text so we remain schema-compliant.
            fallback_text = block.get("text")
            if not isinstance(fallback_text, str) or not fallback_text.strip():
                fallback_text = json.dumps(block, default=str)
            sanitized.append({"type": "text", "text": str(fallback_text)})

        return sanitized

    def sanitize_messages(messages_in: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Sanitize the full messages array before sending to Anthropic."""

        sanitized_messages: list[dict[str, Any]] = []
        for message in messages_in:
            if not isinstance(message, dict):
                sanitized_messages.append({"role": "user", "content": str(message)})
                continue

            role = message.get("role")
            content = message.get("content")

            if isinstance(content, list):
                sanitized_messages.append({"role": role, "content": sanitize_blocks(content)})
            elif content is None:
                sanitized_messages.append({"role": role, "content": ""})
            else:
                # Keep strings as-is; other primitives get stringified.
                sanitized_messages.append({"role": role, "content": content if isinstance(content, str) else str(content)})

        return sanitized_messages

    while iteration < max_iterations:
        iteration += 1

        system_prompt = (
            f"{NEGOTIATION_SYSTEM_PROMPT}\n\n"
            "Tool-call output rule (strict): When you use a tool, do NOT include any tool call JSON "
            "or tool payloads inside your message string. Only provide your <thinking>...</thinking> "
            "tags (internal reasoning/status) and a natural-language supplier-facing message. "
            "The system handles tool execution separately."
        )

        tool_choice_payload: dict[str, Any]
        if must_fetch_context:
            # Force the model to call get_restock_context first so it always has target min/max.
            tool_choice_payload = {"type": "tool", "name": "get_restock_context"}
        else:
            tool_choice_payload = {"type": "auto"}

        # Create the AI message with tools
        
        response = await create_message(
            system_prompt=system_prompt,
            messages=sanitize_messages(messages),
            tools=tools,
            tool_choice=tool_choice_payload,
        )

        # Check if the response contains tool calls
        content_blocks = response.get("content", [])
        text_response = ""
        tool_calls = []

        content_blocks = sanitize_blocks(content_blocks)

        for block in content_blocks:
            if block.get("type") == "text":
                text_response += block.get("text", "")
            elif block.get("type") == "tool_use":
                tool_calls.append(block)

        # If there are tool calls, execute them and continue the loop
        if tool_calls:
            # Add the AI's message (with tool calls) to conversation
            messages.append({"role": "assistant", "content": content_blocks})

            # Execute each tool call
            tool_results = []
            had_error = False
            for tool_call in tool_calls:
                tool_name = tool_call.get("name")
                tool_input = tool_call.get("input", {}) or {}

                try:
                    if tool_name == "get_restock_context":
                        # If the model forgot to provide args, default to the current conversation_id.
                        if (
                            not isinstance(tool_input, dict)
                            or ("request_id" not in tool_input and "conversation_id" not in tool_input)
                        ):
                            tool_input = {"conversation_id": conversation_id}
                        result = get_restock_context.invoke(tool_input)
                        must_fetch_context = False
                    elif tool_name == "update_conversation_state":
                        result = update_conversation_state.invoke(tool_input)
                    elif tool_name == "create_final_order":
                        result = create_final_order.invoke(tool_input)
                    elif tool_name == "record_invoice":
                        result = record_invoice.invoke(tool_input)
                        # Close the loop once the invoice is recorded.
                        try:
                            update_conversation_state.invoke(
                                {
                                    "conversation_id": conversation_id,
                                    "new_state": "closed",
                                    "message": "Invoice recorded. Negotiation closed.",
                                }
                            )
                        except Exception:
                            # Best-effort; avoid failing the agent response if the state update fails.
                            pass
                    else:
                        result = f"Unknown tool: {tool_name}"

                    tool_results.append({
                        "tool_use_id": tool_call.get("id"),
                        "content": (json.dumps(result, default=str)[:8000] if result is not None else ""),
                        "is_error": False,
                    })

                except Exception as e:
                    had_error = True
                    tool_results.append({
                        "tool_use_id": tool_call.get("id"),
                        "content": f"Error executing {tool_name}: {str(e)}",
                        "is_error": True,
                    })

            # Add tool results to conversation in proper Anthropic format
            tool_result_content = []
            for result in tool_results:
                tool_result_content.append({
                    "type": "tool_result",
                    "tool_use_id": result["tool_use_id"],
                    "content": result["content"],
                    **({"is_error": True} if result["is_error"] else {}),
                })


            messages.append({"role": "user", "content": tool_result_content})

            if had_error:
                return "Agent stopped because a tool execution failed. Check input/output for invalid tool parameters or missing required fields."

            # Continue the loop to get the AI's response to the tool results
            continue

        else:
            # No more tool calls, this is the final response
            return text_response.strip()

    # If we exit the loop due to max iterations, return what we have
    return text_response.strip() if text_response else "Agent reached maximum tool-calling iterations"
