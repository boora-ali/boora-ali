from datetime import timedelta

from django.utils import timezone

from .models import Notification, NotificationType

NOTIFICATION_TTL_DAYS = 7


def notify(
    user,
    notification_type: NotificationType,
    title: str,
    body: str,
) -> Notification | None:
    """Cria notificação somente se não houver outra não lida do mesmo tipo."""
    already_pending = Notification.objects.filter(
        user=user,
        type=notification_type,
        read_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).exists()

    if already_pending:
        return None

    return Notification.objects.create(
        user=user,
        type=notification_type,
        title=title,
        body=body,
        expires_at=timezone.now() + timedelta(days=NOTIFICATION_TTL_DAYS),
    )
