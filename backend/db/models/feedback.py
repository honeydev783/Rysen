from sqlalchemy import Column, ForeignKey, String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from db.base import Base

class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id"), nullable=False)
    user_email = Column(String)
    
    reaction = Column(String)  # "heart", "copy", "share", "flag"
    text_feedback = Column(Text, nullable=True)  # Optional written feedback
    created_at = Column(DateTime(timezone=True), server_default=func.now())
