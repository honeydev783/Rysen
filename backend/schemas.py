from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID

class UserProfile(BaseModel):
    name: str
    age_range: str
    sex: str
    life_stage: str
    spiritual_maturity: str
    spiritual_goals: List[str]
    avatar: str
    responseStyle: Optional[str]
    
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
    user_email: str
    user_id: str
    profile: UserProfile

class FeedbackIn(BaseModel):
    message_id: UUID
    reaction: str
    user_email: str

class NewReadingIn(BaseModel):
    chat_session_id: UUID
    reading_title: str
    scripture_reference: str
    sender: str
    text: str
    profile: UserProfile
    date: str
    
    