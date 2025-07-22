from fastapi import APIRouter, Depends, BackgroundTasks, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from uuid import uuid4
from datetime import datetime, timedelta
from firebase_admin import auth as firebase_auth
from pydantic import BaseModel
from db import get_db
import models, schemas, utils
import json
from utils import client
from uuid import UUID
from crud import get_reading_by_date, save_reading
import html

router = APIRouter(prefix="/api")


class DailyMassReadingRequest(BaseModel):
    date_str: str


class ScriptureRequest(BaseModel):
    reading_title: str
    scripture_reference: str
    chat_session_id: UUID
    sender: str
    text: str
    date: str


class SaintRequest(BaseModel):
    saint_name: str
    avatar_name: str
    chat_session_id: UUID
    sender: str
    text: str
    date_str: str


class TokenRequest(BaseModel):
    uid: str


class SessionRequest(BaseModel):
    uid: str
    topic: str


class MassReadingResponse(BaseModel):
    date: str
    season: str
    season_week: str
    year: str
    saint: str
    readings: dict


def build_prompt(today: str) -> str:
    return f"""
    Today is {today}.
    You are a Catholic liturgical calendar assistant. Give a JSON response with:
    - date
    - season (like "Ordinary Time")
    - season_week (e.g., "15")
    - year (A, B, or C)
    - saint of the day (only main Roman calendar)
    - readings:
    - first (First Reading)
    - psalm (Responsorial Psalm)
    - second (if applicable)
    - gospel (Gospel Reading)

    Ensure strict JSON format, like:
    {{
    "date": "{today}",
    "season": "Ordinary Time",
    "season_week": "15",
    "year": "C",
    "saint": "Saint of the Day Name",
    "readings": {{
        "first": "...",
        "psalm": "...",
        "second": "...",
        "gospel": "..."
    }}
    }}
    Only return valid JSON, no explanation.
    Do NOT include ```json or ``` in the output.
    """


def clean_reading_text(text: str) -> str:
    if not text:
        return ""
    # Decode HTML entities and replace special hyphens with standard dash
    return html.unescape(text).replace("\u2010", "-").strip()


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
    session = models.ChatSession(
        id=uuid4(), user_id=user_id, topic=topic, created_at=datetime.now()
    )
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


@router.post("/bible/saint")
async def generate_saint_reading(
    request: SaintRequest, db: AsyncSession = Depends(get_db)
):
    encrypted = utils.encrypt_text(request.text)
    user_msg = models.Message(
        id=uuid4(),
        chat_session_id=request.chat_session_id,
        sender=request.sender,
        text=encrypted,
    )
    db.add(user_msg)
    await db.commit()
    key = f"saint:{request.date_str}"
    cached = await utils.get_cache(key)
    try:
        if cached:

            ai_msg = models.Message(
                id=uuid4(),
                chat_session_id=request.chat_session_id,
                sender="ai",
                text=utils.encrypt_text(cached),
            )
            db.add(ai_msg)
            await db.commit()
            return {
                "id": str(ai_msg.id),
                "sender": "ai",
                "text": cached,
                "timestamp": datetime.now().isoformat(),
            }
        else:
            prompt = f"""
            You are a Catholic spiritual companion inside a mobile app. The app provides users with daily educational reflections about a saint.
            When given a saint's name and an avatar name (Pio, Therese, Kim, or Dan), generate a brief, structured response about the saint in the voice of the avatar.

            Use a reverent, educational, and pastoral tone. Do not include personal intentions or casual/slang language.
            Do not impersonate the saint or avatar. Ensure all facts are historically accurate and consistent with Catholic tradition.

            Format:
            1. Start with the saint's name in **bold**.
            2. A 2-sentence overview of who the saint is and why they're significant in **bold**.
            3. 3 sentences about their time period, origin, and historical context in **bold**.
            4. 3–4 sentences about their key works, teachings, and notable quotes in **bold**.
            5. A 3–4 sentence prayer of intercession in **bold**. For Pio and Therese, reference Mary. For Kim and Dan, include patronage or a relevant saint. End with: “Saint [Name], pray for us. Amen.” in **bold**

            Saint: {request.saint_name}
            Avatar: Pio
            """
            response = client.chat.completions.create(
                model="gpt-4-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a faithful Catholic scripture companion.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
                max_tokens=600,
            )

            reading_output = response.choices[0].message.content
            ai_msg = models.Message(
                id=uuid4(),
                chat_session_id=request.chat_session_id,
                sender="ai",
                text=utils.encrypt_text(reading_output),
            )
            db.add(ai_msg)
            await db.commit()
            await utils.set_cache(key, reading_output)
            return {
                "id": str(ai_msg.id),
                "sender": "ai",
                "text": reading_output,
                "timestamp": datetime.now().isoformat(),
            }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate saint reading: {str(e)}"
        )


@router.post("/bible/scripture")
async def generate_scripture_reading_api(
    request: ScriptureRequest, db: AsyncSession = Depends(get_db)
):
    encrypted = utils.encrypt_text(request.text)
    user_msg = models.Message(
        id=uuid4(),
        chat_session_id=request.chat_session_id,
        sender=request.sender,
        text=encrypted,
    )
    db.add(user_msg)
    await db.commit()
    key = f"{request.date}:{request.reading_title}"
    cached = await utils.get_cache(key)
    try:
        if cached:
            print(f"Returning cached reading for {key} =======>", cached)
            ai_msg = models.Message(
                id=uuid4(),
                chat_session_id=request.chat_session_id,
                sender="ai",
                text=utils.encrypt_text(cached),
            )
            db.add(ai_msg)
            await db.commit()
            return {
                "id": str(ai_msg.id),
                "sender": "ai",
                "text": cached,
                "timestamp": datetime.now().isoformat(),
            }
        else:
            prompt = f"""
            You are a Catholic spiritual companion inside the Bible Study Tab of a Catholic app.
            Your task is to produce a Scripture reading output that follows these requirements:

            - Use the ESV Catholic Edition (preferred). If unavailable, use NABRE or RSV‑CE.
            - Maintain a reverent, faithful-to-doctrine tone, without additional commentary.
            - Format the output exactly as:
            1. Reading title in ALL CAPS (e.g., “FIRST READING” or “GOSPEL”) — use: {request.reading_title}.
            2. Scripture reference — use: {request.scripture_reference}.
            3. A one-sentence overview briefly summarizing what the passage contains.
            4. The full text of the passage, formatted so that:
                - Each verse starts on a new line.
                - Verse numbers appear in parentheses at the start of each line.
                - Verse text itself is in bold (use actual font styling, not markdown asterisks).
            - Do NOT include commentary, footnotes, headings, or cross-references.
            - Keep formatting faithful to the translation’s style.

            Now, produce only the Scripture reading output in this format using these inputs:
            - reading_title: "{request.reading_title}"
            - scripture_reference: "{request.scripture_reference}"
            """
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a faithful Catholic scripture companion.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.5,
            )

            reading_output = response.choices[0].message.content

            ai_msg = models.Message(
                id=uuid4(),
                chat_session_id=request.chat_session_id,
                sender="ai",
                text=utils.encrypt_text(reading_output),
            )
            db.add(ai_msg)
            await db.commit()
            await utils.set_cache(key, reading_output)
            return {
                "id": str(ai_msg.id),
                "sender": "ai",
                "text": reading_output,
                "timestamp": datetime.now().isoformat(),
            }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate reading: {str(e)}"
        )


@router.get("/mass-readings", response_model=MassReadingResponse)
async def get_mass_readings(
    date_str: str = Query(..., description="Date in YYYY-MM-DD format"),
    db: AsyncSession = Depends(get_db),
):
    # today = datetime.now().strftime("%Y-%m-%d")
    print("Fetching Mass readings for date:=======>", date_str)
    key = f"mass:{date_str}"
    try:
        cached = await utils.get_cache(key)
        if cached:
            date = cached.get("date", date_str)
            saint = cached.get("saint", "")
            season = cached.get("season", "")
            season_week = cached.get("season_week", "")
            year = cached.get("year", "")
            readings = {
                "first": clean_reading_text(cached.get("first", "")),
                "psalm": clean_reading_text(cached.get("psalm", "")),
                "second": clean_reading_text(cached.get("second", "")),
                "gospel": clean_reading_text(cached.get("gospel", "")),
            }
            print(f"Returning cached acted Mass readings for {date} =======>")
            return MassReadingResponse(
                date=date,
                saint=saint,
                season=season,
                season_week=season_week,
                year=year,
                readings=readings,
            )

        else:
            readings = await get_reading_by_date(date_str, db)
            date = readings.date if readings else date_str
            saint = readings.saint if readings else ""
            season = readings.season if readings else ""
            season_week = readings.season_week if readings else ""
            year = readings.year if readings else ""
            readings = {
                "first": clean_reading_text(readings.first) if readings else "",
                "psalm": clean_reading_text(readings.psalm) if readings else "",
                "second": clean_reading_text(readings.second) if readings else "",
                "gospel": clean_reading_text(readings.gospel) if readings else "",
            }

            return MassReadingResponse(
                date=date,
                saint=saint,
                season=season,
                season_week=season_week,
                year=year,
                readings=readings,
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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


@router.delete("/chat-sessions/user/{user_id}")
async def delete_user_data(user_id: str, db: AsyncSession = Depends(get_db)):
    try:
        # Get all ChatSession IDs for user
        result = await db.execute(
            select(models.ChatSession.id).where(models.ChatSession.user_id == user_id)
        )
        chat_session_ids = [row[0] for row in result.all()]

        if not chat_session_ids:
            return {
                "status": "success",
                "detail": "No chat sessions found for this user.",
            }

        # Get all Message IDs in those chat sessions
        result = await db.execute(
            select(models.Message.id).where(
                models.Message.chat_session_id.in_(chat_session_ids)
            )
        )
        message_ids = [row[0] for row in result.all()]

        # Delete Feedback
        if message_ids:
            await db.execute(
                delete(models.Feedback).where(
                    models.Feedback.message_id.in_(message_ids)
                )
            )

            # Delete FlaggedResponse
            await db.execute(
                delete(models.FlaggedResponse).where(
                    models.FlaggedResponse.message_id.in_(message_ids)
                )
            )

            # Delete Messages
            await db.execute(
                delete(models.Message).where(models.Message.id.in_(message_ids))
            )

        # Delete ChatSessions
        await db.execute(
            delete(models.ChatSession).where(
                models.ChatSession.id.in_(chat_session_ids)
            )
        )

        await db.commit()

        return {"status": "success", "detail": f"Deleted data for user_id={user_id}"}

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Deletion failed: {str(e)}")
