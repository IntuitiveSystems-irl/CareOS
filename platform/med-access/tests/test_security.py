"""Unit tests for security.py — API key and JWT auth."""
import pytest
from app.security import create_access_token
from jose import jwt
from app.config import settings


class TestJWT:
    """Test JWT creation and structure."""

    def test_create_token(self):
        token = create_access_token(subject="test-user")
        assert isinstance(token, str)
        assert len(token) > 0

    def test_token_payload(self):
        token = create_access_token(subject="test-user", extra_claims={"role": "analyst"})
        payload = jwt.decode(token, settings.MED_ACCESS_JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        assert payload["sub"] == "test-user"
        assert payload["role"] == "analyst"
        assert payload["iss"] == "med-access-service"
        assert "exp" in payload
        assert "iat" in payload

    def test_token_expiry(self):
        token = create_access_token(subject="test-user")
        payload = jwt.decode(token, settings.MED_ACCESS_JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        assert payload["exp"] > payload["iat"]
