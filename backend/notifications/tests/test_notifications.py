from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone
from model_bakery import baker
from rest_framework.test import APIClient

from notifications.models import Notification, NotificationType
from notifications.service import notify

pytestmark = pytest.mark.django_db


# ---------- helpers ----------


def _api_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _notif(
    user, notification_type=NotificationType.TRASH_EXPIRY, read=False, expired=False
):
    delta = timedelta(days=-1) if expired else timedelta(days=7)
    n = baker.make(
        Notification,
        user=user,
        type=notification_type,
        expires_at=timezone.now() + delta,
    )
    if read:
        n.read_at = timezone.now()
        n.save(update_fields=["read_at"])
    return n


# ---------- notify() service ----------


class TestNotifyService:
    def test_creates_notification(self, user):
        result = notify(user, NotificationType.TRASH_EXPIRY, "Título", "Corpo")
        assert result is not None
        assert Notification.objects.filter(user=user).count() == 1

    def test_no_duplicate_if_unread_pending(self, user):
        _notif(user)
        result = notify(user, NotificationType.TRASH_EXPIRY, "Título 2", "Corpo 2")
        assert result is None
        assert Notification.objects.filter(user=user).count() == 1

    def test_creates_after_read(self, user):
        _notif(user, read=True)
        result = notify(user, NotificationType.TRASH_EXPIRY, "Novo", "Corpo")
        assert result is not None
        assert Notification.objects.filter(user=user).count() == 2

    def test_creates_after_expired(self, user):
        _notif(user, expired=True)
        result = notify(user, NotificationType.TRASH_EXPIRY, "Novo", "Corpo")
        assert result is not None

    def test_different_types_both_created(self, user):
        notify(user, NotificationType.TRASH_EXPIRY, "T1", "B1")
        notify(user, NotificationType.ACCOUNT_DELETION, "T2", "B2")
        assert Notification.objects.filter(user=user).count() == 2


# ---------- GET /api/notifications/ ----------


class TestNotificationListView:
    def test_returns_unread_non_expired(self, user):
        _notif(user)
        response = _api_client(user).get("/api/notifications/")
        assert response.status_code == 200
        assert len(response.data) == 1

    def test_excludes_read(self, user):
        _notif(user, read=True)
        response = _api_client(user).get("/api/notifications/")
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_excludes_expired(self, user):
        _notif(user, expired=True)
        response = _api_client(user).get("/api/notifications/")
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_excludes_other_user(self, user, other_user):
        _notif(other_user)
        response = _api_client(user).get("/api/notifications/")
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_unauthenticated_returns_401(self):
        response = APIClient().get("/api/notifications/")
        assert response.status_code == 401

    def test_response_shape(self, user):
        _notif(user)
        response = _api_client(user).get("/api/notifications/")
        data = response.data[0]
        assert "id" in data
        assert "type" in data
        assert "title" in data
        assert "body" in data
        assert data["is_read"] is False


# ---------- POST /api/notifications/{id}/read/ ----------


class TestNotificationMarkReadView:
    def test_marks_as_read(self, user):
        n = _notif(user)
        response = _api_client(user).post(f"/api/notifications/{n.public_id}/read/")
        assert response.status_code == 200
        n.refresh_from_db()
        assert n.read_at is not None

    def test_other_user_cannot_mark(self, user, other_user):
        n = _notif(user)
        response = _api_client(other_user).post(
            f"/api/notifications/{n.public_id}/read/"
        )
        assert response.status_code == 404

    def test_already_read_returns_404(self, user):
        n = _notif(user, read=True)
        response = _api_client(user).post(f"/api/notifications/{n.public_id}/read/")
        assert response.status_code == 404


# ---------- POST /api/notifications/read-all/ ----------


class TestNotificationMarkAllReadView:
    def test_marks_all_read(self, user):
        _notif(user)
        _notif(user, notification_type=NotificationType.ACCOUNT_DELETION)
        response = _api_client(user).post("/api/notifications/read-all/")
        assert response.status_code == 200
        assert Notification.objects.filter(user=user, read_at__isnull=True).count() == 0

    def test_does_not_affect_other_user(self, user, other_user):
        _notif(other_user)
        _api_client(user).post("/api/notifications/read-all/")
        assert (
            Notification.objects.filter(user=other_user, read_at__isnull=True).count()
            == 1
        )
