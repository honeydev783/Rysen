from sqlalchemy import Column, String, Text, ForeignKey, Boolean, TIMESTAMP, func, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
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
    chat_session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"))
    sender = Column(String(10))
    text = Column(Text)  # encrypted
    timestamp = Column(TIMESTAMP, server_default=func.now())

class Feedback(Base):
    __tablename__ = "feedback"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"))
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


class MassReading(Base):
    __tablename__ = "mass_readings"

    date = Column(String, primary_key=True)
    saint = Column(String)
    season = Column(String)
    season_week = Column(String)
    year = Column(String)
    first = Column(String)
    gospel = Column(String)
    psalm = Column(String)
    second = Column(String, nullable=True)

class PastoralMemory(Base):
    __tablename__ = "pastoral_memory"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False, unique=True)
    themes = Column(ARRAY(String))  # up to 3 active themes
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())