from __future__ import annotations

TOKEN_CLEANUP_TASK_NAME = "Limpar tokens bloqueados expirados"
TOKEN_CLEANUP_TASK_PATH = "accounts.tasks.flush_expired_blacklisted_tokens"
TOKEN_CLEANUP_INTERVAL = {"every": 7, "period": "days"}

ACCOUNT_PURGE_TASK_NAME = "Apagar contas agendadas"
ACCOUNT_PURGE_TASK_PATH = "accounts.tasks.purge_deleted_accounts"
ACCOUNT_PURGE_CRONTAB = {
    "minute": "0",
    "hour": "2",
    "day_of_week": "*",
    "day_of_month": "*",
    "month_of_year": "*",
}


def _beat_models(apps=None):
    if apps is None:
        from django_celery_beat.models import (
            CrontabSchedule,
            IntervalSchedule,
            PeriodicTask,
        )

        return CrontabSchedule, IntervalSchedule, PeriodicTask

    return (
        apps.get_model("django_celery_beat", "CrontabSchedule"),
        apps.get_model("django_celery_beat", "IntervalSchedule"),
        apps.get_model("django_celery_beat", "PeriodicTask"),
    )


def ensure_token_cleanup_schedule(apps=None):
    """Cria ou atualiza o beat da limpeza de tokens expirados."""

    _, interval_schedule, periodic_task = _beat_models(apps)
    interval, _created = interval_schedule.objects.get_or_create(
        **TOKEN_CLEANUP_INTERVAL
    )
    return periodic_task.objects.update_or_create(
        name=TOKEN_CLEANUP_TASK_NAME,
        defaults={
            "task": TOKEN_CLEANUP_TASK_PATH,
            "interval": interval,
            "enabled": True,
            "description": (
                "Remove tokens SimpleJWT expirados, incluindo tokens bloqueados "
                "expirados."
            ),
        },
    )


def remove_token_cleanup_schedule(apps=None):
    _, _, periodic_task = _beat_models(apps)
    deleted, _details = periodic_task.objects.filter(
        name=TOKEN_CLEANUP_TASK_NAME,
        task=TOKEN_CLEANUP_TASK_PATH,
    ).delete()
    return deleted


def ensure_account_purge_schedule(apps=None):
    """Cria ou atualiza o beat da limpeza de contas agendadas.

    O helper aceita `apps` para uso em migration e funciona sem ele no comando.
    """

    crontab_schedule, _, periodic_task = _beat_models(apps)
    crontab, _created = crontab_schedule.objects.get_or_create(**ACCOUNT_PURGE_CRONTAB)
    return periodic_task.objects.update_or_create(
        name=ACCOUNT_PURGE_TASK_NAME,
        defaults={
            "task": ACCOUNT_PURGE_TASK_PATH,
            "crontab": crontab,
            "enabled": True,
            "description": (
                "Remove permanentemente contas cuja exclusão foi solicitada "
                "há mais de 7 dias."
            ),
        },
    )


def remove_account_purge_schedule(apps=None):
    _, _, periodic_task = _beat_models(apps)
    deleted, _details = periodic_task.objects.filter(
        name=ACCOUNT_PURGE_TASK_NAME,
        task=ACCOUNT_PURGE_TASK_PATH,
    ).delete()
    return deleted
