from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.session import get_db
from db.models import Feedback
from schemas.feedback import FeedbackCreate, FeedbackOut
from datetime import datetime

router = APIRouter(prefix="/feedback", tags=["Feedback"])

@router.post("/", response_model=FeedbackOut)
def submit_feedback(payload: FeedbackCreate, db: Session = Depends(get_db)):
    feedback = Feedback(**payload.dict(), created_at=datetime.now())
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback
