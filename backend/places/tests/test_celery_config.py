from __future__ import annotations

from django.conf import settings


def test_celery_publishes_to_worker_queue():
    assert settings.CELERY_TASK_DEFAULT_QUEUE == "default"
