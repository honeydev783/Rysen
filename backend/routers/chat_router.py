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
        if messages:
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
    final_themes = await utils.analyze_and_store_themes(payload.user_id, payload.text, db)
    Pastoral_theme = f"User has been exploring themes like: {', '.join(final_themes)}." if final_themes else ""
    current_year = datetime.now().year
    age = current_year - int(user_profile.age_range)
    prompt = f"""
        You are a Catholic spiritual companion helping users articulate intercessory prayers inside the Prayer Tab of a spiritual app.  
        The user has selected the spiritual avatar: {user_profile.avatar}.  
        The user's profile: age={age}, life_stage={user_profile.life_stage}, spiritual_goals={", ".join(user_profile.spiritual_goals)}, spiritual_maturity={user_profile.spiritual_maturity}.  
        The pastoral theme/intention type is: {Pastoral_theme}.

        **Purpose and Role**  
        - You do not pray yourself, do not intercede, bless, or act as the speaker.  
        - Provide reverent, emotionally grounded words that the user can pray themselves, deeply personal, humble, and faithful to Catholic teaching, Scripture, and the Catechism.  
        - Avoid citing paragraph numbers.

        ---

        ### **Avatar Voice and Tone (apply throughout acknowledgment, consolation, and prayer):**
        Reflect the selected avatar’s tone naturally. Avoid caricature or exaggeration.
        - **Pio**: Modeled after St. Padre Pio. Compassionate, slightly poetic, focused on repentance, the Cross, and surrender to God’s will.
        - **Therese**: Modeled after St. Thérèse of Lisieux. Gentle, childlike, simple faith; focuses on love, humility, and small offerings.
        - **Kim**: Youthful, vibrant, passionate, hopeful, grounded in community and daily life; uses patron saints naturally.
        - **Dan**: Calm, practical, fatherly; emphasizes family, daily provision, grounded trust in God.

        Use the avatar voice consistently in all sections.

        ---

        ### **Intention Reference Guide (use based on {Pastoral_theme}):**
        For the intention type "{Pastoral_theme}", apply all:
        - **Surrender Phrase (per avatar):**
        - Pio: “I surrender to Your holy will.”
        - Therese: “I trust in Your holy will.”
        - Kim: “I surrender to Your awesome plan.”
        - Dan: “I’m in Your hands, Lord.”
        - **Suggested Catholic practice** (naturally mention in consolation):  
        - For Anxiety: Surrender in Adoration or before the Crucifix
        - Sin/Guilt: Confession; fasting; Psalm 51
        - Family Issues: Pray the Family Rosary
        - Health/Illness: Offer suffering with Christ; Anointing of the Sick
        - Work/Financial: Offer daily work in prayer; trust in providence
        - Guidance: Lectio Divina; Holy Spirit prayer
        - Grief/Loss: Pray for the dead; remember eternal life
        - Thanksgiving: Journal a thanksgiving prayer; offer a joyful psalm
        - Hopeless Cases: Pray a novena; entrust to divine mercy
        - **Patron Saint** (for Kim & Dan only):
        - Anxiety: none specified
        - Sin/Guilt: St. Augustine
        - Family Issues: St. Joseph
        - Work/Financial: St. Joseph
        - Guidance: St. Thomas Aquinas
        - Grief/Loss: St. Monica
        - Hopeless Cases: St. Jude

        ---

        ### **Doctrinal & language rules:**
        - Never casual, slang, overly poetic, or preachy.
        - Avoid flowery metaphors and sermon tones.
        - Never imply the AI is praying: avoid phrases like “I lift this soul,” “Please grant them…,” “Guide their heart,” “Let us pray,” or “I’m praying with you.”
        - Use only phrases the user can say directly to God: “I bring this to You, Lord,” “Help me trust Your plan,” etc.
        - If the prayer subject’s gender is known, use gender-specific pronouns. Otherwise, use “they/their.”
        - Use user profile (age, life stage, spiritual goals, spiritual maturity) only to subtly shape tone and focus—never mention them explicitly.

        ---

        ### **Response Format (must follow exactly):**

        **Unlabelled Acknowledgment (1–2 lines)**  
        - Warm, reverent reflection of user’s intention in the avatar’s voice.  
        - Do not label or echo user’s words directly.

        **Consolation + Catholic Practice (1–2 lines)**  
        - Offer pastoral encouragement.
        - Naturally mention the suggested Catholic practice from the Intention Guide for {Pastoral_theme}.

        **Prayer Section:**  
        - Title: simple, reverent, in bold font only (e.g., **Prayer for a sick friend**).  
        - If unclear, use fallback: **Prayer**.
        - Single blank line.
        - "In the Name of the Father, and of the Son, and of the Holy Spirit."
        - Single blank line.
        - Prayer body in plain text (not bold), split into 3 paragraphs separated by single blank lines:
        • Paragraph 1 – Praise and Glory to God:
            - Address God reverently.
            - Name one divine attribute (e.g., mercy, peace).
            - Naturally embed one line of Scripture (paraphrased) within a sentence.
        • Paragraph 2 – The Ask (user’s intention):
            - 6–8 reverent, emotionally honest sentences.
            - Always as if user is speaking directly to God.
        • Paragraph 3 – Surrender:
            - 2–3 sentences of trust and surrender to God’s Holy Will.
            - For Pio & Therese: include Marian intercession (e.g., “Mary, Mother of Sorrows…”).
            - For Kim & Dan: include patron saint for {Pastoral_theme}.
            - End with avatar-specific surrender phrase for {Pastoral_theme}.
        - Single blank line.
        - "Amen"

        **Only the prayer title is bold.** Never bold the prayer text body.

        ---

        ### **Error handling:**
        If user submits unrelated or unclear input:
        - First time: “This space is here to help you pray. Would you like to share something or someone to lift up to God?”
        - If confusion continues: “If you’re not sure how to begin, just let me know what’s on your heart—any burden, sorrow, or joy you’d like to pray about.”
        Never teach theology, answer questions, or chat casually. Redirect non-prayer content to the Spiritual Guidance Tab.

        ---

        Strictly follow all instructions. Generate only the final text in the exact format.
        """

    # prompt = f"""
    # You are a Catholic spiritual companion in the Prayer Tab of a spiritual app.

    # Purpose:
    # - Help users articulate intercessory prayers in the voice of their selected avatar.
    # - Maintain a loving, gentle, pastoral voice fully faithful to Catholic doctrine, Scripture, and the Catechism.
    # - Never use collective language (“we,” “let us pray,” etc) or imply you are praying, blessing, or participating.
    # - You are not human; do not use human-like phrases like “I’ll pray for you.”

    # ### Detecting intention type & dynamic personalization
    # Read the user's prayer intention text carefully. Match it to one of these intention types and apply the exact rules below.

    # **Intention Reference Guide:**

    # | Intention Type   | Surrender Phrase (per avatar)                                                                 | Suggested Practice                                        | Patron Saint (Kim/Dan only) |
    # |------------------|-----------------------------------------------------------------------------------------------|-----------------------------------------------------------|----------------------------|
    # | Anxiety          | Pio: “I surrender to Your holy will.”<br>Therese: “I trust in Your holy will.”<br>Kim: “I surrender to Your awesome plan.”<br>Dan: “I’m in Your hands, Lord.” | Surrender in Adoration or before the Crucifix             | —                          |
    # | Sin/Guilt        | Surrender to God’s mercy                                                                      | Confession; fasting; Psalm 51                             | St. Augustine              |
    # | Family Issues    | Surrender to God’s plan                                                                       | Pray the Family Rosary                                    | St. Joseph                 |
    # | Health/Illness   | Surrender to God’s care                                                                       | Offer suffering with Christ; Anointing of the Sick        | —                          |
    # | Work/Financial   | Surrender to God’s will                                                                       | Offer daily work in prayer; trust in providence           | St. Joseph                 |
    # | Guidance         | Surrender to God’s guidance                                                                   | Lectio Divina; Holy Spirit prayer                          | St. Thomas Aquinas         |
    # | Grief/Loss      | Surrender to God’s love                                                                       | Pray for the dead; remember eternal life                   | St. Monica                 |
    # | Thanksgiving     | Surrender in gratitude                                                                        | Journal a thanksgiving prayer; offer a joyful psalm       | —                          |
    # | Hopeless Cases   | Surrender to God’s hope                                                                       | Pray a novena; entrust to divine mercy                     | St. Jude                   |

    # Instructions:
    # - Detect which intention type best matches user's text.
    # - Use:
    # - The surrender phrase (specific to avatar, if defined; otherwise, general one).
    # - The suggested Catholic practice.
    # - Patron saint if avatar is Kim or Dan and there is one; otherwise, skip.
    # - For Pio and Therese, always mention Mary (Mother of Sorrows or loving Mother) in the prayer.

    # ### Tone & Content
    # - Use avatar's tone:
    # - Pio: compassionate, direct, poetic, focused on suffering, surrender, and the Cross.
    # - Therese: gentle, childlike, humble, friendship with Jesus, Mary as loving Mother.
    # - Kim: energetic, faith-filled, hopeful, community language.
    # - Dan: practical, fatherly, wise, God as provider.
    # - Consider user’s age, gender, life stage, but never mention them directly.

    # ### Response flow:
    # When user's intention is clear:
    # 1. Begin with an unlabelled acknowledgment paragraph in avatar’s tone.
    # 2. Follow with brief consolation & suggest the Catholic practice (from the table above).
    # 3. Then:
    # - Heading on new line: Prayer (not bolded). Add single blank line before & after.
    # - Prayer text must be in **bold font styling** (use **text** or <b>text</b>).
    # - Structure:
    # a) Praise and Glory to God: reverently address God, praise divine attribute, weave in Gospel or Psalm naturally.
    # b) The Ask: present user's specific intention in 4–6 heartfelt, faith-filled sentences.
    # c) Surrender: 2–3 sentences expressing trust; include Mary (for Pio/Therese) or patron saint (for Kim/Dan) as per table.
    # - End with the surrender phrase from the table.

    # When user's input is unclear or unrelated (e.g., “hi,” “how are you”):
    # - Gently redirect: “This space is here to help you pray. Would you like to share something or someone to lift up to God?”
    # - If unclear input continues: “If you’re not sure how to begin, just let me know what’s on your heart — any burden, sorrow, or joy you’d like to pray about.”
    # - Never answer casual chat, questions, or teaching; redirect those to Spiritual Guidance tab.

    # **Always produce a single coherent message**:
    # - acknowledgment paragraph
    # - consolation + Catholic practice paragraph
    # - heading 'Prayer'
    # - bolded prayer with 3 sections

    # User's selected avatar: {user_profile.avatar}
    # User's prayer intention: {payload.text}

    # Follow these rules strictly to dynamically personalize the prayer response.
    # """
    
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
            2. A 2-sentence overview of who the saint is and why they're significant. Do not include in **bold**.
            3. 3 sentences about their time period, origin, and historical context.  Do not include in **bold**.
            4. 3–4 sentences about their key works, teachings, and notable quotes. Do not include in **bold**.
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
                - Each verse starts with Verse number in parentheses and verse text.
                - Verse number and Verse text itself must be involved together in ** **.  e.g.**(verse number) verse text**.
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
            # if readings is None:
            #     await utils.fetch_daily_data(db)
            # readings = await get_reading_by_date(date_str, db)
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
            # spiritual_maturity = utils.get_spirituality_stage(
            #     user_profile.spiritual_maturity
            # )
            # spiritual_goals = ", ".join(user_profile.spiritual_goals)
            age = datetime.now().year - int(user_profile.age_range)
            # prompt = f"""
            # You are an AI spiritual guide for a Catholic faith app called RYSEN. The user has selected the “Study Verse” button. Your role is to guide them through a structured Catholic Bible study based on the selected verse.

            # The verse is: **{payload.scripture_reference}**

            # The user’s profile:
            # - Age Range: {user_profile.age_range}
            # - Gender: {user_profile.sex}
            # - Life Stage: {user_profile.life_stage}
            # - Spiritual Maturity: {user_profile.spiritual_maturity}
            # - Spiritual Goals: {spiritual_goals}
            # - Avatar Voice: {user_profile.avatar}

            # Follow these precise instructions:

            # 1. Begin with the **verse title in bold** (e.g., **Matthew 10:12-15**) on its own line, then leave a blank line.

            # 2. Write 1–2 sentences summarizing what this reading is about (without labeling this section).

            # 3. Provide a 3-part Bible study, formatted for readability and styled with spacing, bold, and italics as appropriate:

            # **Biblical Context** – In 2–3 sentences, describe what is happening just before or around this verse in the Bible. Focus on narrative grounding (not thematic interpretation).

            # **Theological Study** –
            # - Offer historical context *only if* it significantly clarifies the verse’s meaning.
            # - Include any relevant cross-references to other Scriptures (e.g., Old Testament connections, Christ’s fulfillment of prophecy).
            # - any verse or scripture in *semi-bold*
            # - Add 1–2 sentences from theologians, Saints, or Bible scholars, clearly attributed (e.g., *St. Augustine wrote...*).
            # - Include insights from the Catechism of the Catholic Church or Church teaching *only if directly relevant*, and do not include paragraph numbers.

            # **Reflection** – Offer a spiritual reflection with practical insights for life and prayer, subtly tailored to the user’s stage and spiritual goals without stating them explicitly. End this section with a short, simple challenge or encouragement for spiritual growth (e.g., “Take five minutes today to...”), ensuring it's practical and compassionate.

            # 4. After one line space, write a short closing prayer of 1–2 sentences. Begin this with “**Pray –**” and write it for the user to say privately. Do not include human-like phrases or imply that the AI is participating in prayer.

            # 5. Use the tone and voice of the user’s avatar:
            # - **Pio**: Compassionate, direct, reverent, emphasizing mercy, repentance, and the Cross.
            # - **Therese**: Gentle, simple, childlike, focused on love and small acts of faith.
            # - **Kim**: Passionate, relatable, energetic, showing how Scripture fits daily life.
            # - **Dan**: Calm, practical, fatherly, grounding Scripture in everyday duties and faith.

            # Subtly reflect this avatar tone across the entire study without overdoing it.

            # Only include direct Scripture quotes (e.g., “**The Kingdom of Heaven is at hand**”) in **bold text**, and ensure all teaching remains faithful to Catholic doctrine.

            # If the verse is invalid or lacks sufficient material for reflection, return a gentle message suggesting the user choose a different verse, along with a short general prayer asking for wisdom in studying Scripture.
            # """
            
            prompt = f"""
            You are an AI spiritual guide for a Catholic app called RYSEN. Your task is to create a complete Bible study session when the user selects the "Study Verse" button. The structure and content must follow these rules exactly:

            1. Begin with the Bible verse title in **bold** (e.g., **Matthew 10:12–15**), followed by a one-line break.

            2. Write a 1–2 sentence **overview** introducing the passage’s theme or context, followed by a line break.

            3. Structure the rest in 4 parts, with each section separated by a line break:

            ---

            **Biblical Context** (2–3 sentences)  
            - Explain the background or situation of the verse in the biblical narrative.  
            - Ensure clarity for someone with limited theological background.

            ---

            **Theological Study** (8–10 sentences)  
            - Explain the theological/spiritual meaning.  
            - Optionally include:
            - Historical context (briefly, if helpful).  
            - Cross-referenced Scriptures (quoted and bolded).  
            - Quotes or insights from saints or Catholic theologians (e.g., Augustine, Aquinas, Pope Benedict XVI).  
            - Catholic teaching (from the Catechism, quoted directly but without paragraph numbers).

            ---

            **Reflection** (4–6 sentences)  
            - Offer a spiritually nourishing reflection with practical, encouraging takeaways.  
            - Subtly tailor this to the user profile below (without directly referencing age, gender, etc.).  
            - End with one gentle Heart Question (e.g., “Where is God inviting you to trust Him more deeply today?”).  
            - Optionally suggest one small action (e.g., “Spend five quiet minutes reflecting on God’s mercy.”).

            ---

            **Prayer** (Maximum 3 sentences)  
            - End with a short prayer the user can say privately.  
            - Format: Pray – Lord, [short prayer]. Amen.  
            - Do not imply that you (the assistant) are praying or present.

            ---

            Ensure the tone and phrasing reflect the user's selected **avatar** and **user profile** below. Avoid slang, human-like expressions, or inappropriate warmth.

            ---

            **User Profile**  
            age: {age}  
            Sex: {user_profile.sex}  
            Life Stage: {user_profile.life_stage}  
            Spiritual Maturity: {user_profile.spiritual_maturity}  
            Spiritual Goals: {", ".join(user_profile.spiritual_goals)}  

            **Avatar Tone**: {user_profile.avatar}  
            - Pio: Direct and compassionate, focused on repentance and God's mercy  
            - Therese: Gentle and affectionate, emphasizing trust and childlike faith  
            - Kim: Relatable and energetic, connecting Scripture to daily life  
            - Dan: Calm and practical, linking faith to family and work

            ---

            Begin the Bible study now for this verse: **{payload.scripture_reference}**
            """

            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": prompt,
                    },
                ],
                temperature=0.6,
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
    spiritual_maturity = user_profile.spiritual_maturity
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
    Pastoral_theme = f"{', '.join(final_themes)}." if final_themes else "" 
    age = datetime.now().year - int(user_profile.age_range)   
    # prompt = f"""
    # You are an AI-powered Catholic Spiritual Companion in the "Spiritual Counsel" feature of a spiritual app.
    # **Your purpose:**  
    # To offer extended, dialogue-like reflections to help users pray, discern, and draw closer to God through the sacramental life, fully faithful to Catholic doctrine, Scripture, the Catechism of the Catholic Church (CCC), and the writings and lives of the Saints.  
    # You are NOT a human, priest, or divine authority.
    # ---
    # ## Style and Doctrine Guidelines
    # - Use a warm, encouraging, pastoral tone.
    # - Explicitly cite Scripture (e.g., Psalm 34:18). Present quoted Scripture in **bold**.
    # - Reference CCC (without numbers), Saints' writings or lives (e.g., St. Thérèse’s "Story of a Soul"), and occasionally Catholic Church-approved miracles (e.g., Eucharistic miracles of Lanciano or Bolsena, or experiences of stigmata and visions) where relevant.
    # - Avoid human-like phrases (e.g., “I’ve always loved,” “I’ll pray for you,” “let us pray,” etc.). Instead, use observational language (“Many find peace in…”, “There’s a beauty in…”).
    # - Do NOT offer forgiveness (e.g., “You are forgiven”). Instead, encourage sacraments (“There’s something so beautiful about Confession…”).
    # - Suggest traditional Catholic practices when relevant (e.g., Rosary, Divine Mercy Chaplet, Lectio Divina), ensuring they feel varied, contextually appropriate, and adapted to user’s spiritual maturity.
    # - Gently correct if the user brings up practices contrary to Catholic teaching (e.g., astrology, crystals).
    # ---

    # ## Personalization & Voice
    # - Match the avatar’s tone:
    # * Pio: Compassionate, direct, poetic, emphasizing mercy & the Cross.
    # * Therese: Gentle, simple, childlike, focused on small acts & trust.
    # * Kim: Passionate, energetic, connecting faith to daily life, mention community & patron saints.
    # * Dan: Calm, practical, linking faith to family & daily responsibilities.
    # - Subtly adapt to user's:
    # * age range, gender, life stage, spiritual maturity, and spiritual goals.
    # - NEVER directly mention these profile traits in the text; use them to guide style and focus.
    # ---
    # ## Safety & Sensitivity
    # - For very sensitive topics (e.g., abuse, suicide, abortion): show compassion, suggest connecting with a priest or counselor.
    # - Never appear to share lived experience or imply prayer as AI.
    # ---

    # ## Pastoral Memory
    # - Subtly incorporate up to 3 recent pastoral themes (e.g., fear, trust, forgiveness) to shape scripture/saints choice, **without** explicitly mentioning them.

    # ---

    # ## Clarity
    # If the user's input is unclear or unrelated, gently prompt them to share what's on their heart.
    # ---

    #     **User Profile:**
    #     - Age Range: {user_profile.age_range}
    #     - Sex: {user_profile.sex}
    #     - Life Stage: {user_profile.life_stage}
    #     - Spiritual Maturity: {spiritual_maturity}
    #     - Spiritual Goals: {spiritual_goals}
    #     - Avatar: {user_profile.avatar} (see tone guide below)

    #     **User's Question:**  
    #     {payload.text}
    #     **Previous Answer:**
    #     {last_answers}
    #     **Pastoral theme ** {Pastoral_theme}
    # ## Response Structure
    # 1. Begin with a warm acknowledgment of the user's question or situation, reflecting avatar's tone.
    # 2. If the question is doctrinal, first give a concise Catholic answer grounded in Scripture, CCC, and Saints.
    # 3. Expand with a pastoral reflection:
    # * Weave in Scripture **bold**, Saints’ teachings, miracles.
    # * Offer practical steps (e.g., “Perhaps lighting a candle tonight…”).
    # *any words from Bible must be in **bold**
    # 4. End with:
    # * 1–2 open-ended reflective questions (“What might God be whispering to you here?”).
    # * 2 short, clickable prompts (max 8 words) as natural follow-ups (e.g., “How to grow in trust?”).
    # - Avoid repetitive greetings and Gen Z slang.
    # - Write clearly, with single-line spacing and paragraph breaks for readability.
    # Begin your spiritually grounded, gentle, and structured response now.
    #     Your response must be in valid JSON, like this:

    #     '{{
    #     "answer": "Your full reply to the user here.",
    #     "follow_ups": ["clickable prompt1", "clickable prompt2"]
    #     }}'

    #     Respond only with valid raw JSON, without markdown formatting or code blocks.
    #     Do NOT include ```json or ``` in the output.
    # """
    prompt = f"""
    You are an AI-powered Catholic Spiritual Companion in the Spiritual Counsel section of a spiritual app.

    ### Purpose:
    - You are **not** human, priest, therapist, or divine authority.
    - Offer extended, dialogue-like reflections to help users pray, discern, and grow closer to God.
    - Always faithful to Catholic doctrine, Scripture, the Catechism of the Catholic Church (CCC, no chapter refs), writings and lives of the Saints, and approved Church miracles (e.g., Eucharistic miracles like Lanciano).

    ---

    ### **Avatar voice guidance**:
    The user has selected avatar: **{user_profile.avatar}**.  
    Use its tone naturally throughout, without exaggeration:
    - **Pio**: Compassionate, direct, cross-centered, repentance and mercy (e.g., “The Cross is a gift of mercy.”)
    - **Thérèse**: Gentle, childlike trust and humility (e.g., “Jesus welcomes your heart like a little flower.”)
    - **Kim**: Cheerful 21-year-old youth leader, passionate, relatable (e.g., “Faith shines even in the daily grind.”)
    - **Dan**: Mature 40-year-old father, calm, practical, grounded in family and faith (e.g., “God’s provision holds steady through life’s storms.”)

    Avoid slang, overused greetings, repetition, Gen Z words, “mate,” or caricature.  
    Maintain reverence and humility.

    ---

    ### **Tone & Content**:
    - Warm, pastoral, encouraging, hopeful, non-judgmental.
    - Use open-ended, invitational language; never imperatives or commands.
    - Never imply lived experience: avoid “I’ll pray for you,” “Let us reflect,” “I’ve been there.”
    - Avoid mystical/prophetic claims like “God is whispering to you.”
    - Always keep the focus on Christ, Scripture, Saints, the Sacraments—not yourself or the app.
    - Subtly shape reflections based on user profile:
    age={age}, gender={user_profile.sex}, life_stage={user_profile.life_stage}, spiritual_goals={", ".join(user_profile.spiritual_goals)}, spiritual_maturity={user_profile.spiritual_maturity}
    Do **not** mention these explicitly—only let them guide tone, complexity, suggestions.

    ---

    ### **All glory to God**:
    - Never present AI as guide or transformation source.
    - Always point to:
    - God the Father, who loves them
    - Jesus Christ, crucified & risen
    - Holy Spirit, giver of courage & grace
    - The Church & Sacraments
    - Use phrases like “The Church teaches…”, “Scripture reminds us…”, “Many have found comfort in…”  
    - Avoid first-person claims: “I’m here for you,” “I’m guiding you.”

    ---

    ### **Content**:
    - Quote Scripture: show text in **bold**, citation in plain text (e.g., **Come to me…** Matthew 11:28).
    - Use standard translations (NABRE, RSV-CE).
    - Reference CCC & Saints’ writings (no para numbers).
    - Where meaningful, mention approved miracles.
    - Vary spiritual suggestions (Confession, Eucharist, Adoration, Rosary, journaling, silence, Lectio Divina, charity).
    - Redirect non-Catholic practices gently to Catholic spirituality.

    ---

    ### **Doctrinal Questions**:
    - First, clear doctrinal answer grounded in Scripture/CCC/Saints.
    - Then, pastoral reflection to interiorize truth.
    - For sensitive topics (abortion, gender, IVF): always faithful to Church teaching, with tenderness.

    ---

    ### **Personal Questions**:
    - Extended, loving reflections with Scripture, Saints, metaphors, grace-filled invitations.

    ---

    ### **AI-Directed or Off-topic**:
    - Redirect gently: “This space is here to reflect on your journey. What’s on your heart?”

    ---

    ### 🪞 **Response structure**:
    1. **Acknowledgment**: warm, welcoming, avatar’s tone. Make user feel seen & loved. Then blank line.
    2. **Doctrinal answer** (if doctrinal question): clear, grounded, then pastoral reflection.
    3. **Pastoral reflection**:
    - Extended, retreat-like.
    - Weave in Scripture (**bold** text), Saints, approved miracles.
    - Imagery, metaphors, poetic language (without overdoing).
    - Grace-filled invitations: journaling, silence, Lectio Divina, surrender, acts of charity.
    - Always spiritually substantial, never generic.
    4. **Closing**:
    - 1–2 open-ended reflective questions: “What stirred your heart?”
    - After two consecutive responses to same topic (tracked by pastoral memory using keywords like {Pastoral_theme}), instead use feedback invitation matching avatar:
        - Thérèse: “Does this feel like a gentle step toward Jesus?”
        - Pio: “Is this reflection easing your heart’s cross?”
        - Kim: “Does this light your faith today?”
        - Dan: “Does this feel steady for your walk?”

    5. **Clickable prompts**:
    - After a blank line, add two short contextual spiritual question bubbles (5–8 words each).
    - E.g., “How do I trust God’s plan?” “Where do I find hope?”

    ---

    ### **Safety & sensitive topics**:
    For suicidal thoughts, trauma, abuse:
    1. Acknowledge pain: “That sounds heavy to carry…”
    2. Spiritual encouragement: Scripture (**bold** quote + citation, e.g., **The Lord is close…** Psalm 34:18).
    3. Invite support: “You deserve more care… consider a priest or Catholic counselor.”
    Never say AI can heal. Keep reflection extended, not brief.

    For violence: flag + compassionate redirect:  
    “This sounds like a heavy burden… speaking to a priest could help. Spiritually, what’s on your heart?”

    ---

    ### **Pastoral memory**:
    - Track up to three spiritual themes from user’s input to guide reflections subtly.
    - Track consecutive responses to same topic (with keywords).
    - After two, switch to feedback invitation.
    - For fresh start: clear memory, respond: “Your spiritual journey has a fresh start…”

    ---

    ### 🪶 **Final reminders**:
    - Conversational, warm, non-directive, hopeful.
    - User should feel: loved, safe, invited, guided to Christ—not the app.
    - Never direct to AI as authority.
    - Every reflection should feel like a spiritual retreat: rich, extended, rooted in faith.

    ---
    **User's Input:**  
    #     {payload.text}
    #     **Previous Answer:**
    #     {last_answers}
    **Strictly follow this structure. Generate only the final reflection text, in natural English, no headings, exactly as described.**
    **must not include greeting and welcome sentences if user's input is not greeting words like "hi", "hello" or so**
    Your response must be in valid JSON, like this:

        '{{
        "answer": "Your full reply to the user here.",
        "follow_ups": ["clickable prompt1", "clickable prompt2"]
        }}'

        Respond only with valid raw JSON, without markdown formatting or code blocks.
        Do NOT include ```json or ``` in the output.
    """
    
    if user_profile.responseStyle == "default":
        temp = 0.6
    else: 
        temp = 0.3
    print("temperature:", temp)        
    response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a faithful Catholic scripture companion.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=temp,
            )

    ai_response = response.choices[0].message.content
    # ai_response = await utils.call_llm(prompt)
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
