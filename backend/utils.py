import os
from fastapi import Depends
from cryptography.fernet import Fernet
from openai import OpenAI
from sqlalchemy import text
import requests
import json
from datetime import datetime, date, timezone, timedelta
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from db import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import asc
from crud import get_reading_by_date, save_reading
import httpx, bs4
from fastapi_cache import FastAPICache
from db import AsyncSessionLocal
import json
import html
from zoneinfo import ZoneInfo
from models import PastoralMemory
AES_KEY = os.getenv("AES_SECRET_KEY").encode()
fernet = Fernet(AES_KEY)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

avatarOption = [
    {
        "name": "Pio",
        "description": "Intense compassion, focus on suffering and confession",
    },
    {
        "name": "Thérèse",
        "description": "Contemplative, mystical, focused on prayer and interior life.",
    },
    {
        "name": "Dan",
        "description": "Practical, family-focused, relatable 40-something father",
    },
    {
        "name": "Kim",
        "description": "Energetic, community-driven, youthful enthusiasm",
    },
]


def clean_reading_text(text: str) -> str:
    if not text:
        return ""
    # Decode HTML entities and replace special hyphens with standard dash
    return html.unescape(text).replace("\u2010", "-").strip()


def get_avatar_name(name: str) -> str:
    for avatar in avatarOption:
        if avatar["name"].lower() == name.lower():
            return avatar["description"]
    return ""


def get_spirituality_stage(spiritual_maturity: float) -> str:
    if spiritual_maturity < 1.8:
        return "Exploring"
    elif spiritual_maturity > 2.5:
        return "Mature"
    else:
        return "Growing"


def encrypt_text(plain: str) -> str:
    return fernet.encrypt(plain.encode()).decode()


def decrypt_text(cipher: str) -> str:
    return fernet.decrypt(cipher.encode()).decode()


async def call_llm(prompt: str) -> str:
    response = client.chat.completions.create(
        model="gpt-4o", messages=[{"role": "system", "content": prompt}]
    )
    return response.choices[0].message.content.strip()


async def log_analytics(db, user_id: str, event: str, data: dict):
    # await db.execute(
    #     "INSERT INTO analytics_events (user_id, event_type, data) VALUES (:uid, :evt, :d)",
    #     {"uid": user_id, "evt": event, "d": data}
    # )
    await db.execute(
        text(
            "INSERT INTO analytics_events (user_id, event_type, data) VALUES (:uid, :evt, :d)"
        ),
        {"uid": user_id, "evt": event, "d": data},
    )


async def fetch_daily_data(db: AsyncSession = Depends(get_db)):
    today = datetime.now(ZoneInfo("Pacific/Kiritimati")).date()
    print(f"Fetching daily data for {str(today)}", datetime.now(ZoneInfo("Pacific/Kiritimati")))
    key = f"mass:{today}"
    cached = await get_cache(key)
    print(f"Cached data for {key}: {cached}")
    async with AsyncSessionLocal() as session:
        existing = await get_reading_by_date(str(today), session)
        if existing:
            return
        today_str = today.strftime("%Y-%m-%d")
        url_str = today.strftime("%Y%m%d")
        print("today str in kiritimati===>", url_str)
        url = f"https://universalis.com/{url_str}/jsonpmass.htm"
        try:
            response = requests.get(url)
            response.raise_for_status()

            # Remove JSONP callback wrapper
            text = response.text.strip()
            if text.startswith("universalisCallback(") and text.endswith(");"):
                raw_json = text[len("universalisCallback(") : -2]
                # print(f"Raw JSONP response: {raw_json}")
            else:
                raise RuntimeError("Unexpected Universalis response format")

            data = json.loads(raw_json)
            season = data.get("season", "")
            season_week = data.get("season_week", "") or data.get("week", "")
            first_reading = clean_reading_text(
                data.get("Mass_R1", {}).get("source", "")
            )
            gospel_reading = clean_reading_text(
                data.get("Mass_G", {}).get("source", "")
            )
            psalm_reading = clean_reading_text(
                data.get("Mass_Ps", {}).get("source", "")
            )
            second_reading = clean_reading_text(
                data.get("Mass_R2", {}).get("source", "")
            )

        except Exception as e:
            raise RuntimeError(f"Failed to fetch Mass readings: {e}")
        saint_name = fetch_todays_saint()
        # Scrape data
        # Parse your data
        today_str1 = today.strftime("%Y/%m/%d")
        try:
            url = f"http://calapi.inadiutorium.cz/api/v0/en/calendars/general-en/{today_str1}"
            response = requests.get(url)
            response.raise_for_status()

            data = response.json()
            season = data.get("season", "")
            season_week = data.get("season_week", "")
        except Exception as e:
            raise RuntimeError(f"Failed to fetch calendar data: {e}")
        year = get_liturgical_year_letter(today)
        # date_obj = datetime.strptime(today_str, "%Y-%m-%d").date()
        data = {
            "date": today_str,
            "saint": saint_name,
            "season": season,
            "season_week": str(season_week),
            "year": year,
            "first": first_reading,
            "gospel": gospel_reading,
            "psalm": psalm_reading,
            "second": second_reading,
        }
        print("daily readings==>", data)
        await save_reading(session, data)
        key = f"mass:{today}"
        await set_cache(key, data)
        await set_reading_data(today_str, "First Reading", first_reading)
        await set_reading_data(today_str, "Second Reading", second_reading)
        await set_reading_data(today_str, "Responsorial Psalm", psalm_reading)
        await set_reading_data(today_str, "Gospel Reading", gospel_reading)
        await set_saint_data(today_str, saint_name)
        # await FastAPICache.set(key, data, expire=60 * 60 * 48)  # Cache for 24 hours


def fetch_todays_saint():
    url = "https://www.catholic.org/saints/sofd.php"
    base_url = "https://www.catholic.org"

    response = requests.get(url, timeout=10)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    container = soup.find("div", id="saintsSofd")
    if not container:
        raise RuntimeError("Saint of the Day section not found")

    # Extract name
    name_tag = container.find("h3")
    saint_name = name_tag.get_text(strip=True) if name_tag else None
    return saint_name


def get_first_sunday_of_advent(year):
    # Advent starts on the 4th Sunday before Christmas
    christmas = date(year, 12, 25)
    weekday = christmas.weekday()  # Monday=0, Sunday=6
    days_to_sunday = (weekday + 1) % 7
    last_sunday_before_christmas = christmas - timedelta(days=days_to_sunday)
    first_sunday_of_advent = last_sunday_before_christmas - timedelta(weeks=3)
    return first_sunday_of_advent


def get_liturgical_year_letter(today=None):
    if today is None:
        today = datetime.now(timezone.utc).date()

    year = today.year
    first_advent = get_first_sunday_of_advent(year)

    if today < first_advent:
        # before Advent → still in previous liturgical cycle
        liturgical_year = year - 1
    else:
        liturgical_year = year

    # Calculate cycle: Year A starts in 2016, so:
    cycle_index = (liturgical_year - 2016) % 3
    return ["A", "B", "C"][cycle_index]


async def set_reading_data(date_str: str, reading_title: str, scripture_reference: str):

    try:
        prompt = f"""
        You are a Catholic spiritual companion inside the Bible Study Tab of a Catholic app.
        Your task is to produce a Scripture reading output that follows these requirements:

        - Use the ESV Catholic Edition (preferred). If unavailable, use NABRE or RSV‑CE.
        - Maintain a reverent, faithful-to-doctrine tone, without additional commentary.
        - Format the output exactly as:
        1. Reading title in ALL CAPS (e.g., “FIRST READING” or “GOSPEL”) — use: {reading_title}.
        2. Scripture reference — use: {scripture_reference}.
        3. A one-sentence overview briefly summarizing what the passage contains.
        4. The full text of the passage, formatted so that:
            - Each verse starts on a new line.
            - Verse numbers appear in parentheses at the start of each line.
            - Verse text itself is in bold (use actual font styling, not markdown asterisks).
        - Do NOT include commentary, footnotes, headings, or cross-references.
        - Keep formatting faithful to the translation’s style.

        Now, produce only the Scripture reading output in this format using these inputs:
        - reading_title: "{reading_title}"
        - scripture_reference: "{scripture_reference}"
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
        key = f"{date_str}:{reading_title}"
        await set_cache(key, reading_output)

    except Exception as e:
        raise RuntimeError(f"Failed to fetch first reading data: {e}")

async def set_saint_data(date_str: str, saint_name: str):
    try:
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

        Saint: {saint_name}
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
        key = f"saint:{date_str}"
        await set_cache(key, reading_output)

    except Exception as e:
        raise RuntimeError(f"Failed to fetch saint data: {e}")

async def set_cache(key: str, value: str, expire: int = 60 * 60 * 48):
    """
    Manually set a cache value.
    """
    backend = FastAPICache.get_backend()
    json_data = json.dumps(value)

    await backend.set(key, json_data, expire=expire)


async def get_cache(key: str):
    """
    Manually get a cache value.
    """
    backend = FastAPICache.get_backend()
    cached = await backend.get(key)
    if cached is not None:
        return json.loads(cached)
    return None


async def check_openai_moderation(text: str) -> bool:
    response = client.moderations.create(
        model="omni-moderation-latest",
        input=text
    )
    return response.results[0].flagged

async def analyze_and_store_themes(user_id: str, text: str, db: AsyncSession):
    PASTORAL_KEYWORDS = ["fear", "trust", "forgiveness", "grief", "hope", "suffering", "joy", "love", "mercy", "healing"]
    prompt = (
        f"From this text, extract up to 2 pastoral themes relevant to Catholic spirituality. "
        f"Choose only from this list: {', '.join(PASTORAL_KEYWORDS)}. "
        f"Return them as a comma-separated list, e.g., 'fear, trust'.\n"
        f"Text: '{text}'"
    )
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are an assistant that extracts spiritual themes."},
            {"role": "user", "content": prompt}
        ]
    )
    raw = response.choices[0].message.content.lower()
    extracted = [t.strip() for t in raw.split(",") if t.strip() in PASTORAL_KEYWORDS]
    print("extracted theme===>", extracted)
    if not extracted:
        return []

    # Load existing themes
    # result = await db.execute(
    #     select(PastoralMemory).where(PastoralMemory.user_id == user_id).order_by(asc(PastoralMemory.updated_at))
    # )
    # existing = result.scalars().all()
    # print("existing===>", existing)
    # # Add new ones
    # for theme in extracted:
    #     if not any(t.theme == theme for t in existing):
    #         db.add(PastoralMemory(user_id=user_id, theme=theme))
    # await db.commit()

    # # Re-fetch
    # result = await db.execute(
    #     select(PastoralMemory).where(PastoralMemory.user_id == user_id).order_by(asc(PastoralMemory.updated_at))
    # )
    # updated = result.scalars().all()

    # # Keep only latest 3
    # if len(updated) > 3:
    #     to_delete = updated[:len(updated)-3]
    #     for theme_obj in to_delete:
    #         await db.delete(theme_obj)
    #     await db.commit()

    # return [t.theme for t in updated[-3:]]
    # Fetch existing PastoralMemory row for the user
    result = await db.execute(
        select(PastoralMemory).where(PastoralMemory.user_id == user_id)
    )
    existing = result.scalars().first()

    if existing:
        # Merge extracted themes into existing ones
        merged = existing.themes or []
        for theme in extracted:
            if theme not in merged:
                merged.append(theme)
        # Keep only latest 3
        merged = merged[-3:]
        existing.themes = merged
        existing.updated_at = datetime.now()
    else:
        # No record yet: create new row with extracted themes (up to 3)
        merged = extracted[:3]
        new_row = PastoralMemory(user_id=user_id, themes=merged)
        db.add(new_row)

    await db.commit()

    return merged

