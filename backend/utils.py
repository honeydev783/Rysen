import os
from cryptography.fernet import Fernet
from openai import OpenAI
from sqlalchemy import text

AES_KEY = os.getenv("AES_SECRET_KEY").encode()
fernet = Fernet(AES_KEY)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

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
