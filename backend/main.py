from fastapi import FastAPI, Depends, HTTPException, status, Header
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore
from firebase_admin import auth as firebase_auth
import stripe
import os
from routers import chat_router
import models
from db import engine
# from routers import chat  # Make sure the import path is correct
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
import json
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from fastapi_cache.decorator import cache
from sqlalchemy.ext.asyncio import AsyncSession
from crud import get_reading_by_date, save_reading
import asyncio
from utils import fetch_daily_data
from fastapi_cache.backends.redis import RedisBackend
import redis.asyncio as redis
from datetime import timezone
from redis import asyncio as aioredis
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from zoneinfo import ZoneInfo

scheduler = AsyncIOScheduler(timezone=ZoneInfo("Pacific/Kiritimati"))  # Set to Kiritimati time zone

# Initialize Firebase
cred = credentials.Certificate("ryenapp.json")  # Replace with your service account key
firebase_admin.initialize_app(cred)
db = firestore.client()
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load data on startup
    
    scheduler.add_job(fetch_daily_data, "interval", seconds=60)
    # scheduler.add_job(fetch_daily_data, "cron", hour=0, minute=1)
    scheduler.start()
    # Startup: create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)

    # Init Redis cache
    redis = aioredis.from_url("redis://redis:6379", encoding="utf8", decode_responses=True)
    FastAPICache.init(RedisBackend(redis), prefix="fastapi-cache")
    # redis_backend = RedisBackend(redis.from_url("redis://localhost"))
    # FastAPICache.init(redis_backend)

    yield
    scheduler.shutdown()

app = FastAPI(title="RYSEN Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL")

predefined_recurring_prices = {
    1000: "price_1RitNKGoeD61SKCcnsd0ciBQ",  # $10/month
    2000: "price_1RitMrGoeD61SKCcO6WwE2l0",  # $20/month
    5000: "price_1RitKlGoeD61SKCcTryUIHCY",  # $50/month
    10000: "price_1RitJiGoeD61SKCc9DCKqfzo", # $100/month
    25000: "price_1RitIxGoeD61SKCcDc3xN74U", # $250/month
}

class DonationRequest(BaseModel):
    amount: int
    recurring: bool
    success_url: str
    cancel_url: str

class TokenRequest(BaseModel):
    id_token: str


class AuthRequest(BaseModel):
    uid: str  # Firebase UID
    email: str
# Onboarding data model
class OnboardingData(BaseModel):
    name: str
    ageRange: str
    sex: str
    lifeStage: str
    spiritualMaturity: float  # 1–3
    spiritualGoals: List[str]
    avatar: str  # key from avatarOptions

def verify_firebase_token(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")

    id_token = authorization.split(" ")[1]
    try:
        decoded_token = firebase_auth.verify_id_token(id_token)
        return decoded_token["uid"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    


app.include_router(chat_router.router)    
@app.post("/auth/signup")
async def signup(data: TokenRequest):
    try:
        decoded_token = firebase_auth.verify_id_token(data.id_token)
        uid = decoded_token["uid"]
        email = decoded_token.get("email", "")
        name = decoded_token.get("name", "")
        user_ref = db.collection("users").document(uid)
        user_doc = user_ref.get()

        if user_doc.exists:
            raise HTTPException(
                status_code=400, detail="User already exists. Use /signin instead."
            )

        user_data = {
            "uid": uid,
            "name": name,
            "email": email,
            "login_count": 1,
            "onboarded": False,
            "created_at": datetime.utcnow(),
        }

        user_ref.set(user_data)

        return {
            "message": "Signup successful",
            "uid": uid,
            "name": name,
            "email": email,
            "login_count": 1,
            "onboarded": False,
        }

    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token or error: {e}")


@app.post("/auth/signin")
async def signin(data: TokenRequest):
    try:
        decoded_token = firebase_auth.verify_id_token(data.id_token)
        uid = decoded_token["uid"]
        email = decoded_token.get("email", "")
        name = decoded_token.get("name", "")
        print("decoded_token==>", decoded_token, uid, email)
        user_ref = db.collection("users").document(uid)
        user_doc = user_ref.get()

        if not user_doc.exists:
            user_data = {
                "uid": uid,
                "name": name,
                "email": email,
                "login_count": 1,
                "onboarded": False,
                "created_at": datetime.utcnow(),
            }

            user_ref.set(user_data)
            return {
                "message": "Signin successful",
                "uid": uid,
                "name": name,
                "email": email,
                "login_count": 1,
                "onboarded": user_data.get("onboarded", False),
            }

        user_data = user_doc.to_dict()
        login_count = user_data.get("login_count", 0) + 1
        name = user_data.get("name", "")
        user_ref.update({"login_count": login_count, "last_login": datetime.utcnow()})
        uid = user_data.get("uid", "")
        return {
            "message": "Signin successful",
            "uid": uid,
            "name": name,
            "email": email,
            "login_count": login_count,
            "onboarded": user_data.get("onboarded", False),
        }

    except Exception as e:
        print("auth error", str(e))
        raise HTTPException(status_code=401, detail=f"Invalid token or error: {e}")

@app.post("/onboarding")
def save_onboarding(data: OnboardingData, uid: str = Depends(verify_firebase_token)):
    user_ref = db.collection("users").document(uid)

    user_ref.set({
        "name": data.name,
        "age_range": data.ageRange,
        "sex": data.sex,
        "life_stage": data.lifeStage,
        "spiritual_maturity": data.spiritualMaturity,
        "spiritual_goals": data.spiritualGoals,
        "avatar": data.avatar,
        "onboarded": True,
    }, merge=True)

    return {"message": "Onboarding saved successfully"}

@app.post("/donate")
def create_donation_session(data: DonationRequest):
    try:
        print("entered here", data.amount)
        if data.recurring:
            if data.amount in predefined_recurring_prices:
                # Use pre-created Stripe price
                price_id = predefined_recurring_prices[data.amount]
                line_items = [{"price": price_id, "quantity": 1}]
            else:
                # Dynamically create price if custom recurring
                product = stripe.Product.create(name="Custom Rysen Monthly Support")
                price = stripe.Price.create(
                    unit_amount=data.amount,
                    currency="usd",
                    recurring={"interval": "month"},
                    product=product.id,
                )
                line_items = [{"price": price.id, "quantity": 1}]
        else:
            # One-time donation
            line_items = [
                {
                    "price_data": {
                        "currency": "usd",
                        "unit_amount": data.amount,
                        "product_data": {
                            "name": "Support Rysen",
                        },
                    },
                    "quantity": 1,
                }
            ]
        print("works before creating session", line_items)
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="subscription" if data.recurring else "payment",
            line_items=line_items,
            success_url=data.success_url,
            cancel_url=data.cancel_url,
        )
        return {"url": session.url}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/user/{uid}")
def get_user(uid: str):
    user_ref = db.collection("users").document(uid)
    doc = user_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    return doc.to_dict()
