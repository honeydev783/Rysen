import os
from cryptography.fernet import Fernet
from openai import OpenAI
from sqlalchemy import text

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
        model="gpt-4o",
        messages=[{"role": "system", "content": prompt}]
    )
    return response.choices[0].message.content.strip()

async def log_analytics(db, user_id: str, event: str, data: dict):
    # await db.execute(
    #     "INSERT INTO analytics_events (user_id, event_type, data) VALUES (:uid, :evt, :d)",
    #     {"uid": user_id, "evt": event, "d": data}
    # )
    await db.execute(
        text("INSERT INTO analytics_events (user_id, event_type, data) VALUES (:uid, :evt, :d)"),
        {"uid": user_id, "evt": event, "d": data}
    )
