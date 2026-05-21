import uuid

from django.conf import settings
from django.db import models


class NotificationType(models.TextChoices):
    TRASH_EXPIRY = "trash_expiry", "Lixeira expirando"
    ACCOUNT_DELETION = "account_deletion", "Conta agendada para deleção"


class Notification(models.Model):
    public_id = models.UUIDField(
        default=uuid.uuid4, editable=False, unique=True, db_index=True
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    type = models.CharField(max_length=40, choices=NotificationType.choices)
    title = models.CharField(max_length=200)
    body = models.TextField()
    read_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["user", "read_at", "expires_at"],
                name="notif_user_unread_idx",
            ),
        ]
