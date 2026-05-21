from __future__ import annotations

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from model_bakery import baker
from rest_framework.test import APIClient

from accounts.tasks import purge_deleted_accounts

User = get_user_model()
pytestmark = pytest.mark.django_db


# ---------- helpers ----------


def _api_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _mark_for_deletion(user, days_ago: int = 0):
    from accounts.models import UserProfile

    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.deletion_requested_at = timezone.now() - timedelta(days=days_ago)
    profile.save(update_fields=["deletion_requested_at"])


# ---------- POST /api/auth/me/delete/ ----------


class TestDeleteAccountView:
    def test_schedules_deletion(self, user):
        client = _api_client(user)
        response = client.post("/api/auth/me/delete/")
        assert response.status_code == 200
        user.profile.refresh_from_db()
        assert user.profile.deletion_requested_at is not None

    def test_already_scheduled_returns_400(self, user):
        _mark_for_deletion(user)
        client = _api_client(user)
        response = client.post("/api/auth/me/delete/")
        assert response.status_code == 400

    def test_unauthenticated_returns_401(self):
        client = APIClient()
        response = client.post("/api/auth/me/delete/")
        assert response.status_code == 401


# ---------- login reactivates ----------


class TestLoginReactivatesAccount:
    def test_login_clears_deletion_requested_at(self, user):
        user.set_password("testpass123")
        user.save()
        _mark_for_deletion(user, days_ago=3)

        client = APIClient()
        client.credentials(REMOTE_ADDR="203.0.113.42")
        response = client.post(
            "/api/auth/login/",
            {"username": user.username, "password": "testpass123"},
            REMOTE_ADDR="203.0.113.42",
        )

        assert response.status_code == 200
        assert response.data.get("account_reactivated") is True
        user.profile.refresh_from_db()
        assert user.profile.deletion_requested_at is None

    def test_login_without_pending_deletion_no_flag(self, user):
        user.set_password("testpass123")
        user.save()

        client = APIClient()
        response = client.post(
            "/api/auth/login/",
            {"username": user.username, "password": "testpass123"},
            REMOTE_ADDR="203.0.113.42",
        )

        assert response.status_code == 200
        assert "account_reactivated" not in response.data


# ---------- purge_deleted_accounts task ----------


class TestPurgeDeletedAccounts:
    def test_no_expired_returns_zero(self):
        result = purge_deleted_accounts()
        assert result == {"deleted": 0}

    def test_active_user_not_deleted(self, user):
        result = purge_deleted_accounts()
        assert result == {"deleted": 0}
        assert User.objects.filter(pk=user.pk).exists()

    def test_recent_pending_not_deleted(self, user):
        _mark_for_deletion(user, days_ago=3)
        purge_deleted_accounts()
        assert User.objects.filter(pk=user.pk).exists()

    def test_expired_account_permanently_deleted(self, user):
        _mark_for_deletion(user, days_ago=8)
        result = purge_deleted_accounts()
        assert result == {"deleted": 1}
        assert not User.objects.filter(pk=user.pk).exists()

    def test_only_expired_deleted_not_recent(self):
        expired = baker.make(User)
        baker.make("accounts.UserProfile", user=expired)
        _mark_for_deletion(expired, days_ago=8)

        recent = baker.make(User)
        baker.make("accounts.UserProfile", user=recent)
        _mark_for_deletion(recent, days_ago=3)

        result = purge_deleted_accounts()
        assert result == {"deleted": 1}
        assert not User.objects.filter(pk=expired.pk).exists()
        assert User.objects.filter(pk=recent.pk).exists()
