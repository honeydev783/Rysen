from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.session import get_db
from db.models import ChatSession, Message, User
from schemas.chat import ChatSessionCreate, ChatSessionOut, MessageCreate, MessageOut, MessageIn
from uuid import UUID
from datetime import datetime
from typing import List
from services.chat_logic import generate_prayer, generate_bible_study, run_normal_chat
from services.context import context_from_db

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("/session", response_model=ChatSessionOut)
def create_chat_session(payload: ChatSessionCreate, db: Session = Depends(get_db)):
    session = ChatSession(**payload.dict(), created_at=datetime.now())
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


# @router.post("/message", response_model=MessageOut)
# def post_message(payload: MessageCreate, db: Session = Depends(get_db)):
#     message = Message(**payload.dict())
#     db.add(message)
#     db.commit()
#     db.refresh(message)
#     return message
@router.post("/message", response_model=MessageOut)
async def post_message(payload: MessageCreate, db: Session = Depends(get_db)):
    # Save user message
    user_msg = Message(
        chat_session_id=payload.chat_session_id,
        sender=payload.sender,
        text=payload.text,
        is_voice=payload.is_voice,
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # Fetch context from recent messages
    context = context_from_db(payload.chat_session_id, db)

    # Get user profile for personalization
    chat_session = db.query(ChatSession).filter(ChatSession.id == payload.chat_session_id).first()
    if not chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    user = db.query(User).filter(User.id == chat_session.user_id).first()
    profile = {
        "email": user.email,
        "name": user.name,
        "avatar": user.avatar
    }

    # Generate AI response
    if payload.trigger == "prayer":
        ai_text = await generate_prayer(context)
    elif payload.trigger == "bible_study":
        ai_text = await generate_bible_study()
    else:
        ai_text = await run_normal_chat(payload.text, profile, context)

    # Save AI message
    ai_msg = Message(
        chat_session_id=payload.chat_session_id,
        sender="ai",
        text=ai_text
    )
    db.add(ai_msg)
    db.commit()
    db.refresh(ai_msg)

    return ai_msg

@router.get("/sessions/{user_id}", response_model=List[ChatSessionOut])
def get_user_chat_sessions(user_id: UUID, db: Session = Depends(get_db)):
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == user_id)
        .order_by(ChatSession.created_at.desc())
        .limit(3)
        .all()
    )
    return sessions

@router.get("/sessions/{user_id}/summaries", response_model=List[str])
def get_recent_summaries(user_id: UUID, db: Session = Depends(get_db)):
    sessions = (
        db.query(ChatSession.summary)
        .filter(ChatSession.user_id == user_id)
        .order_by(ChatSession.created_at.desc())
        .limit(3)
        .all()
    )
    return [s.summary for s in sessions]