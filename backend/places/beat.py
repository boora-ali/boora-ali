from __future__ import annotations

MEDIA_COMPRESSION_TASK_NAME = "Comprimir mídias recentes"
MEDIA_COMPRESSION_TASK_PATH = "places.tasks.compress_recent_media"
MEDIA_COMPRESSION_CRONTAB = {
    "minute": "0",
    "hour": "2",
    "day_of_week": "*",
    "day_of_month": "*",
    "month_of_year": "*",
}


def _beat_models(apps=None):
    if apps is None:
        from django_celery_beat.models import CrontabSchedule, PeriodicTask

        return CrontabSchedule, PeriodicTask

    return (
        apps.get_model("django_celery_beat", "CrontabSchedule"),
        apps.get_model("django_celery_beat", "PeriodicTask"),
    )


def ensure_media_compression_schedule(apps=None):
    """Cria ou atualiza o beat de compressão de mídias."""

    crontab_schedule, periodic_task = _beat_models(apps)
    crontab, _created = crontab_schedule.objects.get_or_create(
        **MEDIA_COMPRESSION_CRONTAB
    )
    return periodic_task.objects.update_or_create(
        name=MEDIA_COMPRESSION_TASK_NAME,
        defaults={
            "task": MEDIA_COMPRESSION_TASK_PATH,
            "crontab": crontab,
            "enabled": True,
            "description": (
                "Comprime em background as mídias alteradas nas últimas 24h, "
                "fora do caminho síncrono de upload."
            ),
        },
    )


def remove_media_compression_schedule(apps=None):
    _, periodic_task = _beat_models(apps)
    deleted, _details = periodic_task.objects.filter(
        name=MEDIA_COMPRESSION_TASK_NAME,
        task=MEDIA_COMPRESSION_TASK_PATH,
    ).delete()
    return deleted
