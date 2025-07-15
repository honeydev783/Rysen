from sqlalchemy.orm import Session
from db.models.message import Message as ChatMessage

def context_from_db(chat_session_id: int, db: Session) -> str:
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.chat_session_id == chat_session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(3)
        .all()
    )
    context = "\n".join([m.text for m in reversed(messages)])
    return context[:1000]  # limit context length
