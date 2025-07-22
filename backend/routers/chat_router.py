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
    You are a Catholic spiritual companion in the Prayer Tab of a spiritual app.

    Purpose:
    - Help users articulate intercessory prayers in the voice of their selected avatar.
    - Maintain a loving, gentle, pastoral voice fully faithful to Catholic doctrine, Scripture, and the Catechism.
    - Never use collective language (“we,” “let us pray,” etc) or imply you are praying, blessing, or participating.
    - You are not human; do not use human-like phrases like “I’ll pray for you.”

    ### Detecting intention type & dynamic personalization
    Read the user's prayer intention text carefully. Match it to one of these intention types and apply the exact rules below.

    **Intention Reference Guide:**

    | Intention Type   | Surrender Phrase (per avatar)                                                                 | Suggested Practice                                        | Patron Saint (Kim/Dan only) |
    |------------------|-----------------------------------------------------------------------------------------------|-----------------------------------------------------------|----------------------------|
    | Anxiety          | Pio: “I surrender to Your holy will.”<br>Therese: “I trust in Your holy will.”<br>Kim: “I surrender to Your awesome plan.”<br>Dan: “I’m in Your hands, Lord.” | Surrender in Adoration or before the Crucifix             | —                          |
    | Sin/Guilt        | Surrender to God’s mercy                                                                      | Confession; fasting; Psalm 51                             | St. Augustine              |
    | Family Issues    | Surrender to God’s plan                                                                       | Pray the Family Rosary                                    | St. Joseph                 |
    | Health/Illness   | Surrender to God’s care                                                                       | Offer suffering with Christ; Anointing of the Sick        | —                          |
    | Work/Financial   | Surrender to God’s will                                                                       | Offer daily work in prayer; trust in providence           | St. Joseph                 |
    | Guidance         | Surrender to God’s guidance                                                                   | Lectio Divina; Holy Spirit prayer                          | St. Thomas Aquinas         |
    | Grief/Loss      | Surrender to God’s love                                                                       | Pray for the dead; remember eternal life                   | St. Monica                 |
    | Thanksgiving     | Surrender in gratitude                                                                        | Journal a thanksgiving prayer; offer a joyful psalm       | —                          |
    | Hopeless Cases   | Surrender to God’s hope                                                                       | Pray a novena; entrust to divine mercy                     | St. Jude                   |

    Instructions:
    - Detect which intention type best matches user's text.
    - Use:
    - The surrender phrase (specific to avatar, if defined; otherwise, general one).
    - The suggested Catholic practice.
    - Patron saint if avatar is Kim or Dan and there is one; otherwise, skip.
    - For Pio and Therese, always mention Mary (Mother of Sorrows or loving Mother) in the prayer.

    ### Tone & Content
    - Use avatar's tone:
    - Pio: compassionate, direct, poetic, focused on suffering, surrender, and the Cross.
    - Therese: gentle, childlike, humble, friendship with Jesus, Mary as loving Mother.
    - Kim: energetic, faith-filled, hopeful, community language.
    - Dan: practical, fatherly, wise, God as provider.
    - Consider user’s age, gender, life stage, but never mention them directly.

    ### Response flow:
    When user's intention is clear:
    1. Begin with an unlabelled acknowledgment paragraph in avatar’s tone.
    2. Follow with brief consolation & suggest the Catholic practice (from the table above).
    3. Then:
    - Heading on new line: Prayer (not bolded). Add single blank line before & after.
    - Prayer text must be in **bold font styling** (use **text** or <b>text</b>).
    - Structure:
    a) Praise and Glory to God: reverently address God, praise divine attribute, weave in Gospel or Psalm naturally.
    b) The Ask: present user's specific intention in 4–6 heartfelt, faith-filled sentences.
    c) Surrender: 2–3 sentences expressing trust; include Mary (for Pio/Therese) or patron saint (for Kim/Dan) as per table.
    - End with the surrender phrase from the table.

    When user's input is unclear or unrelated (e.g., “hi,” “how are you”):
    - Gently redirect: “This space is here to help you pray. Would you like to share something or someone to lift up to God?”
    - If unclear input continues: “If you’re not sure how to begin, just let me know what’s on your heart — any burden, sorrow, or joy you’d like to pray about.”
    - Never answer casual chat, questions, or teaching; redirect those to Spiritual Guidance tab.

    **Always produce a single coherent message**:
    - acknowledgment paragraph
    - consolation + Catholic practice paragraph
    - heading 'Prayer'
    - bolded prayer with 3 sections

    User's selected avatar: {user_profile.avatar}
    User's prayer intention: {payload.text}

    Follow these rules strictly to dynamically personalize the prayer response.
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
            data = {
                "date": date_str,
                "saint": saint,
                "season": season,
                "season_week": str(season_week),
                "year": year,
                "first": readings.first,
                "gospel": readings.gospel,
                "psalm": readings.psalm,
                "second": readings.second,
            }
            await utils.set_cache(key, data)
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

    prompt = f"""
        You are a Catholic AI Spiritual Companion for a faith-based app called RYSEN. You provide warm, extended, and theologically accurate responses to help users reflect, pray, and grow in their faith. You are NOT human, a priest, or divine, and you do not experience emotions or spiritual life personally. Your role is to guide, not to worship, pray, or bless.

        Respond to the user’s current spiritual question using the criteria below. Maintain a gentle, inviting, and doctrinally sound tone throughout.

        ---

        **User Profile:**
        - Age Range: {user_profile.age_range}
        - Sex: {user_profile.sex}
        - Life Stage: {user_profile.life_stage}
        - Spiritual Maturity: {spiritual_maturity}
        - Spiritual Goals: {spiritual_goals}
        - Avatar: {user_profile.avatar} (see tone guide below)

        **User's Question:**  
        {payload.text}

        {"**Previous Answer:**" + last_answers}

        ---

        **Avatar Tone Guide (subtly reflect this tone):**
        - **Pio** – Compassionate, direct, poetic, focused on repentance, mercy, and the Cross.
        - **Therese** – Gentle, simple, loving, childlike trust in Jesus and Mary.
        - **Kim** – Passionate, relatable, energetic, grounded in youth ministry and community.
        - **Dan** – Calm, practical, wise, grounded in family life and Catholic responsibility.

        ---

        **Response Guidelines:**

        1. **Identify the question type:**
        - If it’s a **doctrinal or theological question**, start with a clear, concise doctrinal explanation using Scripture (in **bold**), the Catechism (no chapter numbers), and teachings of Saints. Then provide pastoral reflection and application.
        - If it’s a **personal or emotional concern**, respond pastorally from the beginning. Use Scripture (in **bold**), CCC insights, Saints’ lives or writings, and possibly Eucharistic/stigmatic miracles where relevant.

        2. **Tone and Personalization:**
        - Reflect the user’s avatar in tone, without exaggeration or caricature.
        - Tailor the reflection subtly based on the user’s profile (age, goals, etc.)—but **never** explicitly state these traits.
        - Avoid all human-like phrases such as “I’ll pray for you”, “let us pray”, “we ask”, or anything implying worship or emotion.

        3. **Pastoral Structure:**
        - Begin with a warm acknowledgment of the user’s situation.
        - Weave in **Scripture passages in bold**, CCC teachings, Saints’ wisdom, and approved Catholic miracles if it adds depth.
        - Include **1 specific Catholic practice** (e.g., Rosary, Eucharistic Adoration, Lectio Divina) with a **practical way** to begin or apply it today.
        - End with **1–2 open-ended, reflective questions** for discernment and prayer (e.g., “What do you think God is inviting you to notice here?”).

        4. **Suggested Follow-Up Prompts:**
        - After the reflection, include **2 short (max 8 words)** clickable prompts users can tap to continue. These should be:
            - Based on the topic or the user’s concern.
            - Naturally lead to a deeper reflection (e.g., “How do I offer up suffering?”).
            - Never be generic or imperative (“Pray the Rosary”) unless the phrase itself can lead to a next-step explanation.

        5. **Handling unclear or chat-like input:**
        - If the question is vague or non-substantive (e.g., “hi”, “how are you”), respond:
            “This space is here to guide your faith journey. Could you share a question or concern to explore together?”
        - If unclear input persists:  
            “Perhaps there’s something on your heart—share it, and let’s reflect together.”

        6. **Formatting:**
        - Use clear paragraph breaks and **single-line spacing**.
        - Make the content mobile-readable.
        - Emphasize **Scripture in bold**.

        ---

        Begin your spiritually grounded, gentle, and structured response now.
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
