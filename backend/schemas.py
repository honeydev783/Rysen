from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID

class UserProfile(BaseModel):
    name: str
    age_range: str
    sex: str
    life_stage: str
    spiritual_maturity: float
    spiritual_goals: List[str]
    avatar: str
    
    
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
    profile: UserProfile

class FeedbackIn(BaseModel):
    message_id: UUID
    reaction: str
    user_email: str
