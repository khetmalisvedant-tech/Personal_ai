"""
database.py
───────────
User + usage tracking.
Uses SQLite locally, Postgres on Render (set DATABASE_URL env var).

Tables:
  users        — clerk_id, email, plan (free | pro), stripe_customer_id
  usage_log    — per-user daily request counts
"""

import os
from datetime import date
from sqlalchemy import (
    create_engine, Column, String, Integer, Date,
    Boolean, DateTime, func, UniqueConstraint
)
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./tutor.db")

# Render gives Postgres URLs starting with "postgres://" — SQLAlchemy needs "postgresql://"
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


# ── Models ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    clerk_id           = Column(String, primary_key=True, index=True)
    email              = Column(String, unique=True, index=True, nullable=True)
    plan               = Column(String, default="free")          # "free" | "pro"
    stripe_customer_id = Column(String, nullable=True)
    stripe_sub_id      = Column(String, nullable=True)
    created_at         = Column(DateTime, server_default=func.now())


class UsageLog(Base):
    __tablename__ = "usage_log"
    __table_args__ = (UniqueConstraint("clerk_id", "log_date", name="uq_user_date"),)

    id         = Column(Integer, primary_key=True, autoincrement=True)
    clerk_id   = Column(String, index=True, nullable=False)
    log_date   = Column(Date, default=date.today)
    ask_count  = Column(Integer, default=0)


# ── Helpers ────────────────────────────────────────────────────────────────────

FREE_DAILY_LIMIT = 10


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_or_create_user(db, clerk_id: str, email: str = None) -> User:
    user = db.query(User).filter(User.clerk_id == clerk_id).first()
    if not user:
        user = User(clerk_id=clerk_id, email=email, plan="free")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def get_usage_today(db, clerk_id: str) -> int:
    today = date.today()
    row = db.query(UsageLog).filter(
        UsageLog.clerk_id == clerk_id,
        UsageLog.log_date == today,
    ).first()
    return row.ask_count if row else 0


def increment_usage(db, clerk_id: str):
    today = date.today()
    row = db.query(UsageLog).filter(
        UsageLog.clerk_id == clerk_id,
        UsageLog.log_date == today,
    ).first()
    if row:
        row.ask_count += 1
    else:
        row = UsageLog(clerk_id=clerk_id, log_date=today, ask_count=1)
        db.add(row)
    db.commit()


def is_within_limit(db, user: User) -> bool:
    if user.plan == "pro":
        return True
    return get_usage_today(db, user.clerk_id) < FREE_DAILY_LIMIT


def create_tables():
    Base.metadata.create_all(bind=engine)