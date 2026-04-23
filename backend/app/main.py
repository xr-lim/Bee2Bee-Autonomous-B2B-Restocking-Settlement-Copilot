import logging
from fastapi import FastAPI, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import socketio
import shutil
import os
import uuid
from datetime import datetime, timezone
from app.db.session import SessionLocal
from app.models.message import Message

from app.api.v1.api import api_router

logging.basicConfig(level=logging.INFO, filename="app.log", filemode="a", format='%(asctime)s - %(message)s')

# Socket.IO setup
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

app = FastAPI(
    title="B2B Restocking Copilot API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

# Ensure uploads directory exists
if not os.path.exists("uploads"):
    os.makedirs("uploads")

# Mount uploads directory for static file serving
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.post("/api/v1/chat/upload")
async def upload_file(file: UploadFile = File(...)):
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join("uploads", unique_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {
        "file_url": f"http://localhost:8000/uploads/{unique_filename}",
        "file_name": file.filename,
        "file_type": file.content_type
    }

@app.post("/api/v1/chat/broadcast")
async def broadcast_message(request: Request):
    """
    Broadcast messages to clients.
    """
    data = await request.json()
    room_id = data.get("room_id")
    await sio.emit("receive_message", data, room=room_id)
    return {"status": "broadcasted"}

@app.get("/")
def root():
    return {"message": "API is running 🚀"}

# --- Socket.IO Event Handlers ---

@sio.event
async def connect(sid, environ):
    logging.info(f"Socket connected: {sid}")

@sio.event
async def join_room_event(sid, data):
    room_id = data.get("room_id")
    role = data.get("role")
    sio.enter_room(sid, room_id)
    logging.info(f"Socket {sid} ({role}) joined room {room_id}")
    
    # Send chat history to the newly connected client from the database
    with SessionLocal() as db:
        messages = db.query(Message).filter(Message.room_id == room_id).order_by(Message.created_at).all()
        for msg in messages:
            msg_data = {
                "room_id": msg.room_id,
                "sender": msg.sender,
                "content": msg.content or "",
                "file_url": msg.file_url,
                "file_name": msg.file_name,
                "file_type": msg.file_type
            }
            await sio.emit("receive_message", msg_data, to=sid)

@sio.event
async def send_message(sid, data):
    room_id = data.get("room_id")
    sender = data.get("sender")
    content = data.get("content")
    file_url = data.get("file_url")
    file_name = data.get("file_name")
    file_type = data.get("file_type")
    
    logging.info(f"send_message from {sid} to room {room_id}: {data}")
    
    # Save the message to DB
    with SessionLocal() as db:
        db_message = Message(
            room_id=room_id,
            sender=sender,
            content=content,
            file_url=file_url,
            file_name=file_name,
            file_type=file_type
        )
        db.add(db_message)
        db.commit()
    
    await sio.emit("receive_message", data, skip_sid=sid)

@sio.event
async def disconnect(sid):
    logging.info(f"Socket disconnected: {sid}")

# Wrap FastAPI with Socket.IO ASGI App
socket_app = socketio.ASGIApp(sio, app)

