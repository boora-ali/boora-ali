import pytest
from django.utils import timezone

from accounts.models import GoogleIdentity
from accounts.views import (
    CookieTokenRefreshView,
    ResendVerificationEmailView,
    VerifyEmailView,
)

pytestmark = pytest.mark.django_db


def test_register(api_client):
    r = api_client.post(
        "/api/auth/register/",
        {
            "username": "carol",
            "email": "c@c.com",
            "password": "Strong-Pass1!",
            "confirm_password": "Strong-Pass1!",
            "terms_accepted": True,
        },
        format="json",
    )
    assert r.status_code == 201


def test_register_rejects_honeypot(api_client):
    r = api_client.post(
        "/api/auth/register/",
        {
            "username": "carol",
            "email": "c@c.com",
            "password": "Strong-Pass1!",
            "confirm_password": "Strong-Pass1!",
            "terms_accepted": True,
            "website": "https://spam.example",
        },
        format="json",
    )
    assert r.status_code == 400
    assert r.data["message"] == "Verifique os campos informados."


def test_register_rejects_false_terms(api_client):
    r = api_client.post(
        "/api/auth/register/",
        {
            "username": "carol",
            "email": "c@c.com",
            "password": "Strong-Pass1!",
            "confirm_password": "Strong-Pass1!",
            "terms_accepted": False,
        },
        format="json",
    )
    assert r.status_code == 400


def test_register_rejects_missing_terms(api_client):
    r = api_client.post(
        "/api/auth/register/",
        {
            "username": "carol",
            "email": "c@c.com",
            "password": "Strong-Pass1!",
            "confirm_password": "Strong-Pass1!",
        },
        format="json",
    )
    assert r.status_code == 400


def test_login_returns_tokens(api_client, user):
    r = api_client.post(
        "/api/auth/login/", {"username": "alice", "password": "pw12345!"}, format="json"
    )
    assert r.status_code == 200
    assert "access" in r.data


def test_login_with_email_returns_tokens(api_client, user):
    r = api_client.post(
        "/api/auth/login/",
        {"username": "a@a.com", "password": "pw12345!"},
        format="json",
    )
    assert r.status_code == 200
    assert "access" in r.data


def test_login_sets_refresh_httponly_cookie(api_client, user):
    """Refresh token must arrive as HttpOnly cookie, not in response body."""
    r = api_client.post(
        "/api/auth/login/", {"username": "alice", "password": "pw12345!"}, format="json"
    )
    assert r.status_code == 200
    assert "boraali_refresh" in r.cookies
    cookie = r.cookies["boraali_refresh"]
    assert cookie["httponly"]
    assert "refresh" not in r.data


def test_refresh(api_client, user):
    login_resp = api_client.post(
        "/api/auth/login/", {"username": "alice", "password": "pw12345!"}, format="json"
    )
    assert login_resp.status_code == 200
    # Cookie is set automatically by the test client for subsequent requests
    r = api_client.post("/api/auth/refresh/", format="json")
    assert r.status_code == 200
    assert "access" in r.data


def test_auth_sensitive_views_use_auth_throttle():
    assert CookieTokenRefreshView.throttle_scope == "auth"
    assert VerifyEmailView.throttle_scope == "auth"
    assert ResendVerificationEmailView.throttle_scope == "auth"


def test_logout_blacklists(api_client, user):
    login_resp = api_client.post(
        "/api/auth/login/", {"username": "alice", "password": "pw12345!"}, format="json"
    )
    assert login_resp.status_code == 200
    access = login_resp.data["access"]
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    r = api_client.post("/api/auth/logout/", format="json")
    assert r.status_code == 205
    r2 = api_client.post("/api/auth/refresh/", format="json")
    assert r2.status_code == 401


def test_logout_clears_refresh_cookie(api_client, user):
    """Logout must clear the refresh cookie."""
    login_resp = api_client.post(
        "/api/auth/login/", {"username": "alice", "password": "pw12345!"}, format="json"
    )
    assert login_resp.status_code == 200
    access = login_resp.data["access"]
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    r = api_client.post("/api/auth/logout/", format="json")
    assert r.status_code in [200, 204, 205]
    if "boraali_refresh" in r.cookies:
        assert r.cookies["boraali_refresh"].value == ""


def test_change_password(auth_client, api_client):
    r = auth_client.post(
        "/api/auth/password/",
        {
            "current_password": "pw12345!",
            "new_password": "New-Strong-Pass1!",
            "confirm_password": "New-Strong-Pass1!",
        },
        format="json",
    )
    assert r.status_code == 204

    login = api_client.post(
        "/api/auth/login/",
        {"username": "alice", "password": "New-Strong-Pass1!"},
        format="json",
    )
    assert login.status_code == 200


def test_google_account_cannot_change_password(auth_client, user):
    GoogleIdentity.objects.create(
        user=user,
        google_sub="sub-1",
        email="alice@example.com",
        email_verified=True,
    )

    response = auth_client.post(
        "/api/auth/password/",
        {
            "current_password": "pw12345!",
            "new_password": "New-Strong-Pass1!",
            "confirm_password": "New-Strong-Pass1!",
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.data["code"] == "google_identity_password_change_not_allowed"


def test_google_account_cannot_change_password_even_with_wrong_current_password(
    auth_client, user
):
    GoogleIdentity.objects.create(
        user=user,
        google_sub="sub-2",
        email="alice@example.com",
        email_verified=True,
    )

    response = auth_client.post(
        "/api/auth/password/",
        {
            "current_password": "wrong-password",
            "new_password": "New-Strong-Pass1!",
            "confirm_password": "New-Strong-Pass1!",
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.data["code"] == "google_identity_password_change_not_allowed"


def test_unauth_blocked(api_client):
    assert api_client.get("/api/auth/me/").status_code == 401


def test_terms_accept_saves_timestamp(auth_client, user):
    from accounts.models import UserProfile

    r = auth_client.post("/api/auth/terms/accept/")
    assert r.status_code == 204
    profile = UserProfile.objects.get(user=user)
    assert profile.terms_accepted_at is not None
    assert profile.terms_version == "1.0"


def test_terms_accept_requires_auth(api_client):
    r = api_client.post("/api/auth/terms/accept/")
    assert r.status_code == 401


def test_terms_accept_idempotent(auth_client, user):
    from accounts.models import UserProfile

    auth_client.post("/api/auth/terms/accept/")
    first = UserProfile.objects.get(user=user).terms_accepted_at

    auth_client.post("/api/auth/terms/accept/")
    second = UserProfile.objects.get(user=user).terms_accepted_at

    assert second >= first


def test_resend_verification_email_enforces_persistent_cooldown(auth_client, user):
    profile = user.profile
    profile.email_verified = False
    profile.email_verification_sent_at = timezone.now()
    profile.save(update_fields=["email_verified", "email_verification_sent_at"])

    response = auth_client.post("/api/auth/resend-verification/")

    assert response.status_code == 429
    assert "Aguarde" in response.data["detail"]
