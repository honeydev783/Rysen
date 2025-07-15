import openai
import os
from typing import Optional

open_client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
async def generate_prayer(context: Optional[str] = None) -> str:
    prompt = f"""
    Compose a heartfelt Catholic prayer in a warm pastoral tone.
    {f"The prayer should focus on the following intention: {context}" if context else "Let it be a general prayer."}
    End with a short act of trust in God.
    """
    response = await open_client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content.strip()


async def generate_bible_study() -> str:
    prompt = """
    Provide a reflection on today’s Gospel reading based on the Catholic liturgical calendar.
    Use a pastoral, encouraging tone. Include one related Scripture verse and a short question for personal reflection.
    """
    response = await open_client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content.strip()


async def run_normal_chat(user_text: str, profile: dict, context: str) -> str:
    prompt = f"""
    Respond to the user with Catholic spiritual guidance in a compassionate tone.
    Consider the following profile and context:
    - Profile: {profile}
    - Chat Context: {context}

    User said: "{user_text}"

    Structure:
    - Begin with empathy and affirmation.
    - Include Scripture, CCC, or saint quote.
    - Suggest one practical step.
    - End with a reflective question.
    """
    response = await open_client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content.strip()