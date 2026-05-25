import pytest
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import GoogleIdentity, UserProfile

pytestmark = pytest.mark.django_db


def test_google_login_creates_user_and_returns_tokens(api_client, monkeypatch):
    monkeypatch.setattr(
        "accounts.services.GoogleAuthService.verify_id_token",
        lambda token: {
            "sub": "sub-1",
            "email": "new@example.com",
            "email_verified": True,
            "name": "New User",
        },
    )

    response = api_client.post(
        "/api/auth/google/",
        {"id_token": "token"},
        format="json",
    )

    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" not in response.data
    assert "boraali_refresh" in response.cookies

    refresh = RefreshToken(response.cookies["boraali_refresh"].value)
    assert refresh["session_key"] is not None

    identity = GoogleIdentity.objects.get(google_sub="sub-1")
    assert identity.email == "new@example.com"
    assert identity.email_verified is True
    assert identity.user.email == "new@example.com"
    assert UserProfile.objects.filter(user=identity.user).exists()


def test_google_login_links_existing_user_by_verified_email(
    api_client, user, monkeypatch
):
    user.email = "same@example.com"
    user.save(update_fields=["email"])

    monkeypatch.setattr(
        "accounts.services.GoogleAuthService.verify_id_token",
        lambda token: {
            "sub": "sub-2",
            "email": "same@example.com",
            "email_verified": True,
            "name": "Same User",
        },
    )

    response = api_client.post(
        "/api/auth/google/",
        {"id_token": "token"},
        format="json",
    )

    assert response.status_code == 200
    identity = GoogleIdentity.objects.get(google_sub="sub-2")
    assert identity.user_id == user.id

    refresh = RefreshToken(response.cookies["boraali_refresh"].value)
    assert refresh["session_key"] is not None


def test_google_login_rejects_unverified_email(api_client, monkeypatch):
    monkeypatch.setattr(
        "accounts.services.GoogleAuthService.verify_id_token",
        lambda token: {
            "sub": "sub-3",
            "email": "nope@example.com",
            "email_verified": False,
            "name": "Nope User",
        },
    )

    response = api_client.post(
        "/api/auth/google/",
        {"id_token": "token"},
        format="json",
    )

    assert response.status_code == 401
    assert response.data["code"] == "google_identity_email_not_verified"
