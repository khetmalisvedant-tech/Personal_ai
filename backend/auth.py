"""
auth.py
───────
Verifies Clerk JWTs sent from the frontend in the Authorization header.

Usage in a route:
    from auth import get_current_user
    @router.post("/ask")
    async def ask(data: ..., user=Depends(get_current_user), db=Depends(get_db)):
        ...
"""

import os
import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt                           # pip install pyjwt[cryptography]
from jwt import PyJWKClient

CLERK_PUBLISHABLE_KEY = os.environ.get("CLERK_PUBLISHABLE_KEY", "")
CLERK_SECRET_KEY      = os.environ.get("CLERK_SECRET_KEY", "")

# Clerk's JWKS endpoint — used to verify tokens without storing secrets
# Format: https://<your-clerk-frontend-api>/.well-known/jwks.json
CLERK_JWKS_URL = os.environ.get(
    "CLERK_JWKS_URL",
    "https://your-clerk-domain.clerk.accounts.dev/.well-known/jwks.json"
)

bearer_scheme = HTTPBearer(auto_error=False)

_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(CLERK_JWKS_URL)
    return _jwks_client


def verify_clerk_token(token: str) -> dict:
    """Decode and verify a Clerk JWT. Returns the payload dict."""
    try:
        client  = _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_exp": True},
        )
        return payload
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    """
    FastAPI dependency — extracts and verifies the Bearer token.
    Returns the Clerk payload (sub = clerk_id, email, etc.).
    Raises 401 if missing or invalid.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
        )
    return verify_clerk_token(credentials.credentials)


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict | None:
    """
    Same as get_current_user but returns None instead of raising,
    useful for endpoints that work for both guests and logged-in users.
    """
    if credentials is None:
        return None
    try:
        return verify_clerk_token(credentials.credentials)
    except HTTPException:
        return None