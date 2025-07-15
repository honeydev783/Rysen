from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from datetime import datetime

class FeedbackCreate(BaseModel):
    message_id: UUID
    reaction: str  # heart, copy, share, flag
    user_email: Optional[str]
    text_feedback: Optional[str] = None

class FeedbackOut(FeedbackCreate):
    id: UUID
    created_at: datetime

    class Config:
        orm_mode = True
