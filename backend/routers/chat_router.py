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

class SessionRequest(BaseModel):
    uid: str
    topic: str
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
        .limit(3)
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
async def create_session(data: SessionRequest, db: AsyncSession = Depends(get_db)):
    user_id = data.uid
    topic = data.topic if data.topic else "chat"
    session = models.ChatSession(id=uuid4(), user_id=user_id, topic=topic, created_at=datetime.now())
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
        .where(models.ChatSession.topic == "chat")
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
@router.post("/prayer/message")
async def send_intention(
    payload: schemas.NewMessageIn, db: AsyncSession = Depends(get_db)
):
    encrypted = utils.encrypt_text(payload.text)
    user_msg = models.Message(
        id=uuid4(),
        chat_session_id=payload.chat_session_id,
        sender=payload.sender,
        text=encrypted,
    )
    db.add(user_msg)
    await db.commit()
    user_profile = payload.profile
    prompt = f"""
    You are a Catholic spiritual companion inside the Prayer Tab of a spiritual app.
    Your purpose is to help users articulate intercessory prayers in a loving, gentle, pastoral tone, fully faithful to Catholic doctrine, Scripture, and the Catechism.

    You will receive two inputs:
    - avatar (one of: “Pio”, “Therese”, “Kim”, or “Dan”) – determines the tone, surrender phrase, and spiritual focus.
    - user_query – the user’s prayer intention or message.

    Response logic:
    1. If user_query is clear and related to a prayer intention:
    - Start with a warm, natural acknowledgment in the chosen avatar’s tone. Do not label this section.
    - Continue with 1–2 lines of consolation or pastoral advice, naturally including one Catholic practice (e.g., Adoration, Confession, Family Rosary, offering suffering, Anointing of the Sick, offering daily work, Lectio Divina, praying for the dead, journaling thanksgiving, novena, divine mercy).
    - Then write the prayer:
        - Add the heading 'Prayer' on a new line (plain text).
        - Write the prayer itself in bold text (use actual font styling).
        - Structure:
            - Praise & glory to God: name a divine attribute and naturally weave in a Gospel or Psalm line.
            - The ask: humbly present the user’s intention in 4–6 heartfelt sentences.
            - Surrender: conclude in 2–3 sentences with trust; mention Mary (for Pio/Therese) or a relevant patron saint (for Kim/Dan).
        - End with the avatar’s surrender phrase:
            - Pio: “I surrender to Your holy will.”
            - Therese: “I trust in Your holy will.”
            - Kim: “I surrender to Your awesome plan.”
            - Dan: “I’m in Your hands, Lord.”
    - Keep prayer 7–10 sentences, with blank lines between sections.

    2. If user_query is unclear, casual, or off-topic:
    - Gently redirect:
        - First: “This space is here to help you pray. Would you like to share something or someone to lift up to God?”
        - If unclear input continues: “If you're not sure how to begin, just let me know what’s on your heart — any burden, sorrow, or joy you’d like to pray about.”
    - Do not answer questions, chat, or teach theology; redirect such topics to the Spiritual Guidance tab.

    Always stay faithful to Catholic teaching, using the chosen avatar's tone:
    - Pio: mystical, reverent, poetic; focus on the Cross, suffering, Mary as Mother of Sorrows.
    - Therese: childlike, tender, humble; “Little Way,” Jesus as gentle friend, Mary as loving Mother.
    - Kim: upbeat, joyful, faith-filled; encouragement, community, patron saints.
    - Dan: grounded, direct, reassuring; practical wisdom, God as provider, patron saints.
    Prayer must be end with Amen.
    Now, given avatar='{user_profile.avatar}' and user_query='{payload.text}', generate your response.
    """
    ai_response = await utils.call_llm(prompt)
    print("prayer response===>", ai_response)
    ai_msg = models.Message(
        id=uuid4(),
        chat_session_id=payload.chat_session_id,
        sender="ai",
        text=utils.encrypt_text(ai_response),
    )
    db.add(ai_msg)
    await db.commit()

    return {
        "id": str(ai_msg.id),
        "sender": "ai",
        "text": ai_response,
        "timestamp": datetime.now().isoformat(),
    }    
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
    user_profile = payload.profile
    avatar_description = utils.get_avatar_name(user_profile.avatar)
    spiritual_maturity = utils.get_spirituality_stage(user_profile.spiritual_maturity)
    spiritual_goals = ", ".join(user_profile.spiritual_goals)
    
    m = await db.execute(
        models.Message.__table__.select()
        .where(models.Message.chat_session_id == payload.chat_session_id)
        .where(models.Message.sender == "ai")
        .order_by(models.Message.timestamp)
        .limit(1)
    )
    last_answers = " ".join([utils.decrypt_text(row.text) for row in m.fetchall()])
    # Build prompt with request for follow-up questions
    # prompt = (
    #     f"Reflect the voice, style, and spirituality of the selected Avatar:"
    #     "{user_profile.avatar} : {avatar_description}\n"
    #     "Tone: Pastoral, hopeful, non-judgmental, and conversational—like a close friend guiding someone toward Christ."
    #     "Use Catholic sources naturally: the Bible, Catechism of the Catholic Church (CCC), writings of the Saints, and approved Church miracles. Reference verses or teachings when relevant"
    #     "Personalize deeply using the spiritual profile of user and conversation history:"
    #     "User Profile: Age: {user_profile.age_range} Sex: {user_profile.sex} Stage of Life: {user_profile.life_stage} Spiritual Maturity: {spiritual_maturity} Spiritual Goals: {spiritual_goals}"
    #     "Your last answer was: {last_answers}\n"
    #     "User asked: {payload.text}\n"
    #     "Then suggest 2-3 short follow-up questions as JSON list.\n"
    #     "Respond in JSON:\n"
    #     '{ "answer": "your reply here", "follow_ups": ["q1", "q2"] }'
    # )
    prompt = f"""
    Reflect the voice, style, and spirituality of the selected Avatar:
    {user_profile.avatar} - {avatar_description}

    Tone: Pastoral, hopeful, non-judgmental, and conversational—like a close friend guiding someone toward Christ.

    Use Catholic sources naturally: the Bible, Catechism of the Catholic Church (CCC), writings of the Saints, and approved Church miracles. Reference verses or teachings when relevant.

    Personalize deeply using the spiritual profile of the user and their conversation history:

    User Profile:
    - Age: {user_profile.age_range}
    - Sex: {user_profile.sex}
    - Stage of Life: {user_profile.life_stage}
    - Spiritual Maturity: {spiritual_maturity}
    - Spiritual Goals: {spiritual_goals}

    Previous AI reply: {last_answers}
    User message: "{payload.text}"

    Your response must be in valid JSON, like this:

    '{{
    "answer": "Your full reply to the user here.",
    "follow_ups": ["First follow-up question?", "Second?", "Optional third?"]
    }}'

    Respond only with valid raw JSON, without markdown formatting or code blocks.
    Do NOT include ```json or ``` in the output.
    """

    print("Prompt for AI:", prompt)
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
