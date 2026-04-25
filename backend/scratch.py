import asyncio
import json
from app.ai.client import create_message

async def main():
    try:
        response = await create_message(prompt="Hello")
        print("Hello Response:", response.get("content", [{"text": "NO TEXT"}])[0].get("text"))
    except Exception as e:
        print("Hello failed:", e)

    # Now let's try to mimic the tool payload
    payload = {
      "model": "ilmu-glm-5.1",
      "max_tokens": 5000,
      "temperature": 0.2,
      "messages": [
        {
          "role": "user",
          "content": "Conversation conv-1004: test"
        },
        {
          "role": "assistant",
          "content": [
            {
              "type": "tool_use",
              "id": "call_123",
              "name": "get_restock_context",
              "input": {
                "conversation_id": "conv-1004"
              }
            }
          ]
        },
        {
          "role": "user",
          "content": [
            {
              "type": "tool_result",
              "tool_use_id": "call_123",
              "content": "{\"foo\": \"bar\"}"
            }
          ]
        }
      ],
      "tools": [
        {
          "name": "get_restock_context",
          "description": "test",
          "input_schema": {
            "type": "object",
            "properties": {
                "conversation_id": {"type": "string"}
            }
          }
        }
      ]
    }
    
    try:
        res = await create_message(
            messages=payload["messages"],
            tools=payload["tools"]
        )
        print("Tool response:", res)
    except Exception as e:
        print("Tool payload failed:", e)

asyncio.run(main())
