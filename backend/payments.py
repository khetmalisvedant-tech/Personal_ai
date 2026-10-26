"""
payments.py
───────────
Stripe integration:
  POST /payments/create-checkout   — creates a Stripe Checkout session (pro upgrade)
  POST /payments/webhook           — Stripe webhook (marks user as pro on payment)
  GET  /payments/status            — returns current user plan + usage for the day
"""

import os
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from auth     import get_current_user
from database import get_db, get_or_create_user, get_usage_today, FREE_DAILY_LIMIT

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET  = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRO_PRICE_ID    = os.environ.get("STRIPE_PRO_PRICE_ID", "")   # price_xxx from Stripe dashboard
FRONTEND_URL           = os.environ.get("FRONTEND_URL", "http://localhost:5173")

router = APIRouter(prefix="/payments")


# ── Create checkout session ────────────────────────────────────────────────────

@router.post("/create-checkout")
async def create_checkout(
    user_payload = Depends(get_current_user),
    db: Session  = Depends(get_db),
):
    clerk_id = user_payload["sub"]
    email    = user_payload.get("email", "")
    user     = get_or_create_user(db, clerk_id, email)

    if user.plan == "pro":
        return {"message": "Already on Pro plan"}

    # Retrieve or create a Stripe customer
    if not user.stripe_customer_id:
        customer = stripe.Customer.create(email=email, metadata={"clerk_id": clerk_id})
        user.stripe_customer_id = customer.id
        db.commit()

    session = stripe.checkout.Session.create(
        customer        = user.stripe_customer_id,
        payment_method_types=["card"],
        line_items=[{"price": STRIPE_PRO_PRICE_ID, "quantity": 1}],
        mode            = "subscription",
        success_url     = f"{FRONTEND_URL}?upgraded=1",
        cancel_url      = f"{FRONTEND_URL}?upgraded=0",
        metadata        = {"clerk_id": clerk_id},
    )
    return {"checkout_url": session.url}


# ── Stripe webhook ─────────────────────────────────────────────────────────────

@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload   = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")

    if event["type"] == "checkout.session.completed":
        session  = event["data"]["object"]
        clerk_id = session.get("metadata", {}).get("clerk_id")
        sub_id   = session.get("subscription")
        if clerk_id:
            user = get_or_create_user(db, clerk_id)
            user.plan          = "pro"
            user.stripe_sub_id = sub_id
            db.commit()

    elif event["type"] in ("customer.subscription.deleted", "customer.subscription.paused"):
        sub      = event["data"]["object"]
        sub_id   = sub["id"]
        from database import User
        user = db.query(User).filter(User.stripe_sub_id == sub_id).first()
        if user:
            user.plan = "free"
            db.commit()

    return {"status": "ok"}


# ── User status (plan + usage) ─────────────────────────────────────────────────

@router.get("/status")
async def payment_status(
    user_payload = Depends(get_current_user),
    db: Session  = Depends(get_db),
):
    clerk_id  = user_payload["sub"]
    email     = user_payload.get("email", "")
    user      = get_or_create_user(db, clerk_id, email)
    used_today = get_usage_today(db, clerk_id)

    return {
        "plan":            user.plan,
        "used_today":      used_today,
        "daily_limit":     FREE_DAILY_LIMIT if user.plan == "free" else None,
        "requests_left":   max(0, FREE_DAILY_LIMIT - used_today) if user.plan == "free" else None,
    }