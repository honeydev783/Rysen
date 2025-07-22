import aioredis
import os
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

redis = aioredis.from_url(REDIS_URL, decode_responses=True)

CACHE_EXPIRE = 60 * 60 * 24  # 24 hours

async def get_cached_reading(date: str):
    return await redis.hgetall(f"mass:{date}")

async def cache_reading(date: str, reading: dict):
    await redis.hset(f"mass:{date}", mapping=reading)
    await redis.expire(f"mass:{date}", CACHE_EXPIRE)

