from datetime import timedelta

import pytest
from django.utils import timezone
from model_bakery import baker

from accounts.models import ConsentHistory

pytestmark = pytest.mark.django_db


def test_register_creates_consent_history(api_client):
    response = api_client.post(
        "/api/auth/register/",
        {
            "username": "carol",
            "email": "c@c.com",
            "password": "Strong-Pass1!",
            "confirm_password": "Strong-Pass1!",
            "terms_accepted": True,
        },
        format="json",
        REMOTE_ADDR="203.0.113.10",
        HTTP_USER_AGENT="pytest-agent",
    )

    assert response.status_code == 201
    consent = ConsentHistory.objects.get(user__username="carol")
    assert consent.method == "register"
    assert consent.ip_address == "203.0.113.10"
    assert consent.user_agent == "pytest-agent"


def test_terms_accept_creates_history(auth_client, user):
    response = auth_client.post("/api/auth/terms/accept/")

    assert response.status_code == 204
    assert ConsentHistory.objects.filter(user=user, method="re_accept").exists()


def test_google_login_creates_history_only_on_first_link(api_client, monkeypatch):
    monkeypatch.setattr(
        "accounts.services.GoogleAuthService.verify_id_token",
        lambda token: {
            "sub": "sub-lgpd",
            "email": "lgpd@example.com",
            "email_verified": True,
            "name": "LGPD User",
        },
    )

    first = api_client.post(
        "/api/auth/google/",
        {"id_token": "token"},
        format="json",
        REMOTE_ADDR="203.0.113.11",
        HTTP_USER_AGENT="pytest-agent",
    )
    second = api_client.post(
        "/api/auth/google/",
        {"id_token": "token"},
        format="json",
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert ConsentHistory.objects.filter(method="google_oauth").count() == 1


def test_withdraw_consent_schedules_deletion(auth_client, user):
    response = auth_client.post("/api/auth/me/withdraw-consent/")

    assert response.status_code == 200
    user.profile.refresh_from_db()
    assert user.profile.deletion_requested_at is not None


def test_withdraw_consent_is_idempotent(auth_client, user):
    auth_client.post("/api/auth/me/withdraw-consent/")
    response = auth_client.post("/api/auth/me/withdraw-consent/")

    assert response.status_code == 409


def test_export_returns_user_data(auth_client, user):
    place = baker.make("places.Place", user=user, name="Café", category="cafe")
    visit = baker.make("places.Visit", place=place)
    baker.make("places.VisitItem", visit=visit, name="Bolo")
    collection = baker.make(
        "places.Collection",
        user=user,
        name="Favoritos",
        emoji="⭐",
        description="Locais preferidos",
    )
    baker.make("places.CollectionPlace", collection=collection, place=place)
    baker.make("places.PlaceShare", owner=user, place=place, is_active=True)
    collection_share = baker.make(
        "places.CollectionShare",
        owner=user,
        source_collection=collection,
        snapshot_name="Favoritos",
        snapshot_emoji="⭐",
        snapshot_description="Locais preferidos",
        is_active=True,
    )
    baker.make(
        "places.CollectionSharePlaceSnapshot",
        share=collection_share,
        source_place_public_id=place.public_id,
        name=place.name,
        category=place.category,
        status=place.status,
        order_index=0,
    )
    baker.make(
        "notifications.Notification",
        user=user,
        type="account_deletion",
        title="Conta agendada",
        body="Sua conta será excluída.",
        expires_at=timezone.now() + timedelta(days=1),
    )
    baker.make(
        "accounts.GoogleIdentity",
        user=user,
        google_sub="google-sub-1",
        email=user.email,
        email_verified=True,
    )
    ConsentHistory.objects.create(
        user=user,
        terms_version="1.0",
        ip_address="203.0.113.12",
        user_agent="pytest-agent",
        method="register",
    )

    response = auth_client.get("/api/auth/me/export/")

    assert response.status_code == 200
    assert response["Content-Disposition"] == 'attachment; filename="meus-dados-boora-ali.json"'
    assert response.data["profile"]["username"] == user.username
    assert response.data["google_identity"]["email"] == user.email
    assert response.data["notifications"][0]["title"] == "Conta agendada"
    assert response.data["collections"][0]["places"][0]["place_name"] == "Café"
    assert response.data["place_shares"][0]["place_name"] == "Café"
    assert response.data["collection_shares"][0]["place_snapshots"][0]["name"] == "Café"
    assert response.data["consent_history"][0]["method"] == "register"
    assert response.data["places"][0]["name"] == "Café"
    assert response.data["places"][0]["visits"][0]["items"][0]["name"] == "Bolo"
