from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID

class MessageOut(BaseModel):
    id: UUID
    sender: str
    text: str
    timestamp: str

class ChatSessionOut(BaseModel):
    id: UUID
    topic: Optional[str]
    summary: Optional[str]
    created_at: str
    messages: List[MessageOut]

class NewMessageIn(BaseModel):
    chat_session_id: UUID
    sender: str
    text: str

class FeedbackIn(BaseModel):
    message_id: UUID
    reaction: str
    user_email: str
