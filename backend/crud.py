from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models import MassReading
from datetime import date, datetime
from fastapi import Depends
from db import get_db
async def get_reading_by_date(date: str, session: AsyncSession):
    # date_obj = datetime.strptime(date, "%Y-%m-%d").date()
    result = await session.execute(select(MassReading).where(MassReading.date == date))
    return result.scalars().first()

async def save_reading(session: AsyncSession, data: dict):
    reading = MassReading(**data)
    session.add(reading)
    await session.commit()