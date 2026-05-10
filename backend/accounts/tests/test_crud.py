import pytest
from django.contrib.auth import get_user_model

from accounts.models import UserProfile, UserSession

pytestmark = pytest.mark.django_db

User = get_user_model()


def test_register_creates_user(api_client):
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
    assert User.objects.filter(username="carol", email="c@c.com").exists()


def test_register_saves_terms_accepted_at(api_client):
    api_client.post(
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
    user = User.objects.get(username="carol")
    profile = UserProfile.objects.get(user=user)
    assert profile.terms_accepted_at is not None
    assert profile.terms_version == "1.0"


def test_me_exposes_terms_accepted_at_after_register(api_client):
    api_client.post(
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
    tokens = api_client.post(
        "/api/auth/login/",
        {"username": "carol", "password": "Strong-Pass1!"},
        format="json",
    ).data
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    me = api_client.get("/api/auth/me/")
    assert me.status_code == 200
    assert me.data["terms_accepted_at"] is not None


def test_me_terms_accepted_at_null_for_existing_user(auth_client):
    r = auth_client.get("/api/auth/me/")
    assert r.status_code == 200
    assert r.data["terms_accepted_at"] is None


def test_me_retrieves_current_user_and_profile_defaults(auth_client):
    r = auth_client.get("/api/auth/me/")
    assert r.status_code == 200
    assert r.data["username"] == "alice"
    assert r.data["nickname"] == ""
    assert r.data["profile_photo_url"] == ""
    assert UserProfile.objects.filter(user__username="alice").exists()


def test_me_updates_user_and_profile_fields(auth_client):
    r = auth_client.patch(
        "/api/auth/me/",
        {
            "username": "alice-new",
            "email": "new@a.com",
            "display_name": "Alice Silva",
            "nickname": "Ali",
        },
        format="json",
    )
    assert r.status_code == 200
    assert r.data["username"] == "alice-new"
    assert r.data["email"] == "new@a.com"
    assert r.data["display_name"] == "Alice Silva"
    assert r.data["nickname"] == "Ali"

    user = User.objects.get(username="alice-new")
    profile = UserProfile.objects.get(user=user)
    assert user.email == "new@a.com"
    assert profile.nickname == "Ali"


def test_deleting_user_cascades_profile_and_session():
    user = User.objects.create_user(
        username="temp",
        email="temp@example.com",
        password="Strong-Pass1!",
    )
    UserProfile.objects.create(user=user, nickname="Tmp")
    UserSession.objects.create(user=user)

    user.delete()

    assert not UserProfile.objects.filter(user_id=user.id).exists()
    assert not UserSession.objects.filter(user_id=user.id).exists()
