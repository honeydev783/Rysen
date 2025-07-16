from fastapi import APIRouter, Depends, BackgroundTasks, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import uuid4
from datetime import datetime, timedelta
from firebase_admin import auth as firebase_auth
from pydantic import BaseModel
from db import get_db
import models, schemas, utils
import json

router = APIRouter(prefix="/api")


class TokenRequest(BaseModel):
    uid: str


# ⚠ stub: get current user_id (from auth/jwt)
def get_user_id(data: TokenRequest):
    return data.uid  # replace with real user id


@router.get("/chat/session/{session_id}")
async def get_session(
    session_id: str, uid: str = Query(...), db: AsyncSession = Depends(get_db)
):
    # Find session owned by user
    q = await db.execute(
        models.ChatSession.__table__.select()
        .where(models.ChatSession.id == session_id)
        .where(models.ChatSession.user_id == uid)
    )
    s = q.fetchone()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    # Fetch messages ordered by timestamp
    m = await db.execute(
        models.Message.__table__.select()
        .where(models.Message.chat_session_id == session_id)
        .order_by(models.Message.timestamp)
    )
    messages = [
        {
            "id": row.id,
            "sender": row.sender,
            "text": utils.decrypt_text(row.text),
            "timestamp": row.timestamp.isoformat(),
        }
        for row in m.fetchall()
    ]

    return {
        "id": s.id,
        "created_at": s.created_at.isoformat(),
        "topic": s.topic,
        "summary": s.summary,
        "messages": messages,
    }


@router.post("/chat/session")
async def create_session(data: TokenRequest, db: AsyncSession = Depends(get_db)):
    user_id = data.uid
    session = models.ChatSession(id=uuid4(), user_id=user_id, created_at=datetime.now())
    db.add(session)
    await db.commit()
    return {"id": session.id, "created_at": session.created_at}


@router.get("/chat/sessions")
async def list_sessions(
    uid: str = Query(...), limit: int = 3, db: AsyncSession = Depends(get_db)
):
    thirty_days_ago = datetime.now() - timedelta(days=30)
    q = await db.execute(
        models.ChatSession.__table__.select()
        .where(models.ChatSession.user_id == uid)
        .where(models.ChatSession.created_at > thirty_days_ago)
        .order_by(models.ChatSession.created_at.desc())
        .limit(limit)
    )
    sessions = []
    for s in q.fetchall():
        m = await db.execute(
            models.Message.__table__.select()
            .where(models.Message.chat_session_id == s.id)
            .order_by(models.Message.timestamp)
        )
        messages = [
            {
                "id": row.id,
                "sender": row.sender,
                "text": utils.decrypt_text(row.text),
                "timestamp": row.timestamp.isoformat(),
            }
            for row in m.fetchall()
        ]
        sessions.append(
            {
                "id": s.id,
                "created_at": s.created_at.isoformat(),
                "topic": s.topic,
                "summary": s.summary,
                "messages": messages,
            }
        )
    return {"sessions": sessions}


# @router.post("/chat/message")
# async def send_message(payload: schemas.NewMessageIn, db: AsyncSession = Depends(get_db)):
#     # user_id = get_user_id()
#     # Save user message
#     encrypted = utils.encrypt_text(payload.text)
#     user_msg = models.Message(id=uuid4(), chat_session_id=payload.chat_session_id,
#                               sender=payload.sender, text=encrypted)
#     db.add(user_msg)
#     await db.commit()
#     # Build prompt: (simplified) get last 3 messages & summarize
#     prompt = f"User said: {payload.text}. Reply warmly & theologically."
#     ai_text = await utils.call_llm(prompt)
#     ai_msg = models.Message(id=uuid4(), chat_session_id=payload.chat_session_id,
#                             sender="ai", text=utils.encrypt_text(ai_text))
#     db.add(ai_msg)
#     await db.commit()
#     # await utils.log_analytics(db, str(user_id), "message_sent", {"session_id": str(payload.chat_session_id)})
#     return {"id": ai_msg.id, "sender": "ai", "text": ai_text, "timestamp": datetime.now().isoformat()}


@router.post("/chat/message")
async def send_message(
    payload: schemas.NewMessageIn, db: AsyncSession = Depends(get_db)
):
    # Save user message
    encrypted = utils.encrypt_text(payload.text)
    user_msg = models.Message(
        id=uuid4(),
        chat_session_id=payload.chat_session_id,
        sender=payload.sender,
        text=encrypted,
    )
    db.add(user_msg)
    await db.commit()

    # Build prompt with request for follow-up questions
    prompt = (
        f"User said: {payload.text}\n"
        "Please reply warmly and theologically. "
        "Then suggest 2-3 short follow-up questions as JSON list.\n"
        "Respond in JSON:\n"
        '{ "answer": "your reply here", "follow_ups": ["q1", "q2"] }'
    )

    ai_response = await utils.call_llm(prompt)

    # You can format AI to return like:
    # "AI answer text here.\nFollow-up questions:\n- question1\n- question2\n- question3"
    try:
        parsed = json.loads(ai_response)
        ai_text = parsed.get("answer", "").strip()
        follow_ups = parsed.get("follow_ups", [])
    except Exception:
        # fallback if parsing fails
        ai_text = ai_response.strip()
        follow_ups = []

    # parts = ai_response.strip().split("Follow-up questions:")
    # ai_text = parts[0].strip()
    # follow_ups = []
    # if len(parts) > 1:
    #     follow_ups = [q.strip("- ").strip() for q in parts[1].split("\n") if q.strip()]

    # Save AI message in DB
    ai_msg = models.Message(
        id=uuid4(),
        chat_session_id=payload.chat_session_id,
        sender="ai",
        text=utils.encrypt_text(ai_text),
    )
    db.add(ai_msg)
    await db.commit()

    return {
        "id": str(ai_msg.id),
        "sender": "ai",
        "text": ai_text,
        "timestamp": datetime.now().isoformat(),
        "follow_ups": follow_ups,
    }


@router.post("/feedback")
async def add_feedback(payload: schemas.FeedbackIn, db: AsyncSession = Depends(get_db)):
    fb = models.Feedback(
        id=uuid4(),
        message_id=payload.message_id,
        user_email=payload.user_email,
        reaction=payload.reaction,
    )
    db.add(fb)
    if payload.reaction == "flag":
        # get message text
        q = await db.execute(
            models.Message.__table__.select().where(
                models.Message.id == payload.message_id
            )
        )
        row = q.fetchone()
        # text = utils.decrypt_text(row.text) if row else ""
        text = row.text if row else ""
        flagged = models.FlaggedResponse(
            id=uuid4(),
            message_id=payload.message_id,
            text=text,
            user_email=payload.user_email,
        )
        db.add(flagged)
    await db.commit()
    return {"success": True}
