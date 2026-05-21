from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone
from model_bakery import baker

from places.models import Place
from places.tasks import purge_expired_trash

pytestmark = pytest.mark.django_db


def _soft_deleted(user, days_ago: int) -> Place:
    cutoff = timezone.now() - timedelta(days=days_ago)
    return baker.make("places.Place", user=user, deleted_at=cutoff)


def _active(user) -> Place:
    return baker.make("places.Place", user=user, deleted_at=None)


class TestPurgeExpiredTrash:
    def test_no_expired_returns_zero(self, user, settings):
        settings.TRASH_RETENTION_DAYS = 30
        _active(user)
        result = purge_expired_trash()
        assert result == {"deleted": 0}

    def test_recent_trash_not_deleted(self, user, settings):
        settings.TRASH_RETENTION_DAYS = 30
        place = _soft_deleted(user, days_ago=10)
        purge_expired_trash()
        assert Place.objects.deleted().filter(pk=place.pk).exists()

    def test_expired_trash_permanently_deleted(self, user, settings):
        settings.TRASH_RETENTION_DAYS = 30
        place = _soft_deleted(user, days_ago=31)
        result = purge_expired_trash()
        assert result == {"deleted": 1}
        assert not Place.objects.filter(pk=place.pk).exists()

    def test_only_expired_deleted_not_recent(self, user, settings):
        settings.TRASH_RETENTION_DAYS = 30
        expired = _soft_deleted(user, days_ago=31)
        recent = _soft_deleted(user, days_ago=5)
        active = _active(user)

        result = purge_expired_trash()

        assert result == {"deleted": 1}
        assert not Place.objects.filter(pk=expired.pk).exists()
        assert Place.objects.deleted().filter(pk=recent.pk).exists()
        assert Place.objects.filter(pk=active.pk).exists()

    def test_multiple_expired_all_deleted(self, user, settings):
        settings.TRASH_RETENTION_DAYS = 30
        for _ in range(3):
            _soft_deleted(user, days_ago=60)

        result = purge_expired_trash()

        assert result == {"deleted": 3}
        assert Place.objects.deleted().count() == 0

    def test_one_day_before_cutoff_not_deleted(self, user, settings):
        settings.TRASH_RETENTION_DAYS = 30
        place = _soft_deleted(user, days_ago=29)
        purge_expired_trash()
        assert Place.objects.deleted().filter(pk=place.pk).exists()
