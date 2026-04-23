from sqlalchemy import Column, String, Integer, DateTime
from app.db.base import Base
import uuid
from datetime import datetime, timezone

class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    room_id = Column(String, index=True, nullable=False)
    sender = Column(String, nullable=False)
    content = Column(String, nullable=True) # Content can be empty if it's just a file upload
    file_url = Column(String, nullable=True)
    file_name = Column(String, nullable=True)
    file_type = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
