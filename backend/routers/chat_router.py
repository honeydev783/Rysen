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
            2. A 2-sentence overview of who the saint is and why they're significant in normal text not in bold.
            3. 3 sentences about their time period, origin, and historical context in normal text not in bold.
            4. 3–4 sentences about their key works, teachings, and notable quotes in normal text not in bold.
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
                - Verse numbers appear in parentheses at the start of each line in bold and Verse text itself is started next to Verse number.
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
            print("readings===>", date_str, readings)
            date = readings.date if readings else date_str
            saint = readings.saint if readings else ""
            season = readings.season if readings else ""
            season_week = readings.season_week if readings else ""
            year = readings.year if readings else ""
            reading = {
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
                readings=reading,
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bible/reading")
async def study_bible(
    payload: schemas.NewReadingIn, db: AsyncSession = Depends(get_db)
):
    # Save user message
    key = f"reading:{payload.date}: {payload.reading_title}"
    encrypted = utils.encrypt_text(payload.text)
    user_msg = models.Message(
        id=uuid4(),
        chat_session_id=payload.chat_session_id,
        sender=payload.sender,
        text=encrypted,
    )
    db.add(user_msg)
    await db.commit()
    try:
        cached = await utils.get_cache(key)
        if cached:
            ai_msg = models.Message(
                id=uuid4(),
                chat_session_id=payload.chat_session_id,
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
            user_profile = payload.profile
            spiritual_maturity = utils.get_spirituality_stage(
                user_profile.spiritual_maturity
            )
            spiritual_goals = ", ".join(user_profile.spiritual_goals)
            prompt = f"""
            You are an AI spiritual guide for a Catholic faith app called RYSEN. The user has selected the “Study Verse” button. Your role is to guide them through a structured Catholic Bible study based on the selected verse.

            The verse is: **{payload.scripture_reference}**

            The user’s profile:
            - Age Range: {user_profile.age_range}
            - Gender: {user_profile.sex}
            - Life Stage: {user_profile.life_stage}
            - Spiritual Maturity (1–5): {spiritual_maturity}
            - Spiritual Goals: {spiritual_goals}
            - Avatar Voice: {user_profile.avatar}

            Follow these precise instructions:

            1. Begin with the **verse title in bold** (e.g., **Matthew 10:12-15**) on its own line, then leave a blank line.

            2. Write 1–2 sentences summarizing what this reading is about (without labeling this section).

            3. Provide a 3-part Bible study, formatted for readability and styled with spacing, bold, and italics as appropriate:

            **Biblical Context** – In 2–3 sentences, describe what is happening just before or around this verse in the Bible. Focus on narrative grounding (not thematic interpretation).

            **Theological Study** –
            - Offer historical context *only if* it significantly clarifies the verse’s meaning.
            - Include any relevant cross-references to other Scriptures (e.g., Old Testament connections, Christ’s fulfillment of prophecy).
            - Add 1–2 sentences from theologians, Saints, or Bible scholars, clearly attributed (e.g., *St. Augustine wrote...*).
            - Include insights from the Catechism of the Catholic Church or Church teaching *only if directly relevant*, and do not include paragraph numbers.

            **Reflection** – Offer a spiritual reflection with practical insights for life and prayer, subtly tailored to the user’s stage and spiritual goals without stating them explicitly. End this section with a short, simple challenge or encouragement for spiritual growth (e.g., “Take five minutes today to...”), ensuring it's practical and compassionate.

            4. After one line space, write a short closing prayer of 1–2 sentences. Begin this with “**Pray –**” and write it for the user to say privately. Do not include human-like phrases or imply that the AI is participating in prayer.

            5. Use the tone and voice of the user’s avatar:
            - **Pio**: Compassionate, direct, reverent, emphasizing mercy, repentance, and the Cross.
            - **Therese**: Gentle, simple, childlike, focused on love and small acts of faith.
            - **Kim**: Passionate, relatable, energetic, showing how Scripture fits daily life.
            - **Dan**: Calm, practical, fatherly, grounding Scripture in everyday duties and faith.

            Subtly reflect this avatar tone across the entire study without overdoing it.

            Only include direct Scripture quotes (e.g., “**The Kingdom of Heaven is at hand**”) in **bold text**, and ensure all teaching remains faithful to Catholic doctrine.

            If the verse is invalid or lacks sufficient material for reflection, return a gentle message suggesting the user choose a different verse, along with a short general prayer asking for wisdom in studying Scripture.
            """
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": prompt,
                    },
                ],
                temperature=0.8,
            )
            ai_response = response.choices[0].message.content
            ai_msg = models.Message(
                id=uuid4(),
                chat_session_id=payload.chat_session_id,
                sender="ai",
                text=utils.encrypt_text(ai_response),
            )
            db.add(ai_msg)
            await db.commit()
            await utils.set_cache(key, ai_response)
            return {
                "id": str(ai_msg.id),
                "sender": "ai",
                "text": ai_response,
                "timestamp": datetime.now().isoformat(),
            }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Deletion failed: {str(e)}")


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
    PASTORAL_KEYWORDS = ["fear", "trust", "forgiveness", "grief", "hope", "suffering", "joy", "love", "mercy", "healing"]
    is_harmful = await utils.check_openai_moderation(payload.text)

    if is_harmful:
        db.add(models.FlaggedResponse(
            id = uuid4(),
            message_id=user_msg.id,
            text=encrypted,
            user_email=payload.user_email
        ))
        await db.commit()
        fallback = "This sounds like a heavy burden. Speaking with a trusted priest or counselor can offer guidance and support. Is there another concern you’d like to explore together?"
        ai_msg = models.Message(
        id=uuid4(),
        chat_session_id=payload.chat_session_id,
        sender="ai",
        text= utils.encrypt_text(fallback),
        )
        db.add(ai_msg)
        await db.commit()

        return {
            "id": str(ai_msg.id),
            "sender": "ai",
            "text": fallback,
            "timestamp": datetime.now().isoformat(),
            "follow_ups": [],
        }
    final_themes = await utils.analyze_and_store_themes(payload.user_id, payload.text, db)
    Pastoral_theme = f"User has been exploring themes like: {', '.join(final_themes)}." if final_themes else ""    
    prompt = f"""
    You are an AI-powered Catholic Spiritual Companion in the "Spiritual Counsel" feature of a spiritual app.
    **Your purpose:**  
    To offer extended, dialogue-like reflections to help users pray, discern, and draw closer to God through the sacramental life, fully faithful to Catholic doctrine, Scripture, the Catechism of the Catholic Church (CCC), and the writings and lives of the Saints.  
    You are NOT a human, priest, or divine authority.
    ---
    ## Style and Doctrine Guidelines
    - Use a warm, encouraging, pastoral tone.
    - Explicitly cite Scripture (e.g., Psalm 34:18). Present quoted Scripture in **bold**.
    - Reference CCC (without numbers), Saints' writings or lives (e.g., St. Thérèse’s "Story of a Soul"), and occasionally Catholic Church-approved miracles (e.g., Eucharistic miracles of Lanciano or Bolsena, or experiences of stigmata and visions) where relevant.
    - Avoid human-like phrases (e.g., “I’ve always loved,” “I’ll pray for you,” “let us pray,” etc.). Instead, use observational language (“Many find peace in…”, “There’s a beauty in…”).
    - Do NOT offer forgiveness (e.g., “You are forgiven”). Instead, encourage sacraments (“There’s something so beautiful about Confession…”).
    - Suggest traditional Catholic practices when relevant (e.g., Rosary, Divine Mercy Chaplet, Lectio Divina), ensuring they feel varied, contextually appropriate, and adapted to user’s spiritual maturity.
    - Gently correct if the user brings up practices contrary to Catholic teaching (e.g., astrology, crystals).
    ---

    ## Personalization & Voice
    - Match the avatar’s tone:
    * Pio: Compassionate, direct, poetic, emphasizing mercy & the Cross.
    * Therese: Gentle, simple, childlike, focused on small acts & trust.
    * Kim: Passionate, energetic, connecting faith to daily life, mention community & patron saints.
    * Dan: Calm, practical, linking faith to family & daily responsibilities.
    - Subtly adapt to user's:
    * age range, gender, life stage, spiritual maturity, and spiritual goals.
    - NEVER directly mention these profile traits in the text; use them to guide style and focus.
    ---
    ## Safety & Sensitivity
    - For very sensitive topics (e.g., abuse, suicide, abortion): show compassion, suggest connecting with a priest or counselor.
    - Never appear to share lived experience or imply prayer as AI.
    ---

    ## Pastoral Memory
    - Subtly incorporate up to 3 recent pastoral themes (e.g., fear, trust, forgiveness) to shape scripture/saints choice, **without** explicitly mentioning them.

    ---

    ## Clarity
    If the user's input is unclear or unrelated, gently prompt them to share what's on their heart.
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
        **Previous Answer:**
        {last_answers}
        **Pastoral theme ** {Pastoral_theme}
    ## Response Structure
    1. Begin with a warm acknowledgment of the user's question or situation, reflecting avatar's tone.
    2. If the question is doctrinal, first give a concise Catholic answer grounded in Scripture, CCC, and Saints.
    3. Expand with a pastoral reflection:
    * Weave in Scripture **bold**, Saints’ teachings, miracles.
    * Offer practical steps (e.g., “Perhaps lighting a candle tonight…”).
    *any words from Bible must be in **bold**
    4. End with:
    * 1–2 open-ended reflective questions (“What might God be whispering to you here?”).
    * 2 short, clickable prompts (max 8 words) as natural follow-ups (e.g., “How to grow in trust?”).
    - Avoid repetitive greetings and Gen Z slang.
    - Write clearly, with single-line spacing and paragraph breaks for readability.
    Begin your spiritually grounded, gentle, and structured response now.
        Your response must be in valid JSON, like this:

        '{{
        "answer": "Your full reply to the user here.",
        "follow_ups": ["clickable prompt1", "clickable prompt2"]
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
