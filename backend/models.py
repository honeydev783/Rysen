from sqlalchemy import Column, String, Text, ForeignKey, Boolean, TIMESTAMP, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
import uuid

Base = declarative_base()

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False)
    topic = Column(Text)
    summary = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())

class Message(Base):
    __tablename__ = "messages"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id"))
    sender = Column(String(10))
    text = Column(Text)  # encrypted
    timestamp = Column(TIMESTAMP, server_default=func.now())

class Feedback(Base):
    __tablename__ = "feedback"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id"))
    user_email = Column(Text)
    reaction = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())

class FlaggedResponse(Base):
    __tablename__ = "flagged_responses"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True))
    text = Column(Text)
    user_email = Column(Text)
    reviewed = Column(Boolean, default=False)
    review_notes = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())
