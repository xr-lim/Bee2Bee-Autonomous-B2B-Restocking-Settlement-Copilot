from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException
import traceback
import logging

from app.ai.negotiation_agent import run_negotiation_agent
from app.db.session import SessionLocal
from app.models.message import Message
from app.realtime import sio
from sqlalchemy.exc import OperationalError


router = APIRouter(prefix="/negotiation", tags=["negotiation"])
logger = logging.getLogger(__name__)

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

class SupplierReplyRequest(BaseModel):
    conversation_id: str = Field(
        ...,
        min_length=1,
        description="The conversation ID for this supplier reply.",
    )
    supplier_message: str = Field(
        ...,
        min_length=1,
        description="The supplier's message or counter-offer.",
    )

async def _emit_ai_message(conversation_id: str, content: str) -> None:
    await _persist_and_emit_message(
        conversation_id=conversation_id,
        sender="AI",
        content=content,
    )

async def _persist_and_emit_message(
    *,
    conversation_id: str,
    sender: str,
    content: str,
    file_url: str | None = None,
    file_name: str | None = None,
    file_type: str | None = None,
) -> None:
    msg_data = {
        "room_id": conversation_id,
        "sender": sender,
        "content": content or "",
        "file_url": file_url,
        "file_name": file_name,
        "file_type": file_type,
    }

    # Persist with a short-lived fresh session; retry once on dropped connections.
    for attempt in range(2):
        try:
            with SessionLocal() as db:
                db.add(
                    Message(
                        room_id=conversation_id,
                        sender=sender,
                        content=content or "",
                        file_url=file_url,
                        file_name=file_name,
                        file_type=file_type,
                    )
                )
                db.commit()
            break
        except OperationalError:
            if attempt == 1:
                raise

    if sio is not None:
        await sio.emit("receive_message", msg_data, room=conversation_id)

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
            restock_request_id=request.restock_request_id
        )
        await _emit_ai_message(request.conversation_id, response)
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
        # Persist + emit the supplier message immediately (fresh session), then run the agent.
        await _persist_and_emit_message(
            conversation_id=request.conversation_id,
            sender="Supplier",
            content=request.supplier_message,
        )
        response = await run_negotiation_agent(request.conversation_id, request.supplier_message)
        await _emit_ai_message(request.conversation_id, response)
        return {
            "conversation_id": request.conversation_id,
            "status": "response",
            "message": response,
        }
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
