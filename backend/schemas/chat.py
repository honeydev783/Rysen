from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class MessageBase(BaseModel):
    sender: str  # 'user' or 'ai'
    text: str
    is_voice: Optional[bool] = False

class MessageCreate(MessageBase):
    chat_session_id: UUID

class MessageIn(BaseModel):
    chat_session_id: UUID
    sender: str  # 'user' or 'ai'
    text: str
    trigger: Optional[str] = None  # 'prayer', 'bible_study', or None

class MessageOut(MessageBase):
    id: UUID
    timestamp: datetime

    class Config:
        orm_mode = True


class ChatSessionCreate(BaseModel):
    topic: Optional[str] = None
    summary: Optional[str] = None

class ChatSessionOut(BaseModel):
    id: UUID
    topic: Optional[str]
    summary: Optional[str]
    created_at: datetime
    messages: List[MessageOut]

    class Config:
        orm_mode = True
