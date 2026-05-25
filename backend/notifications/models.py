from django.conf import settings
from django.db import models

from core.models import BaseModel


class NotificationType(models.TextChoices):
    TRASH_EXPIRY = "trash_expiry", "Lixeira expirando"
    ACCOUNT_DELETION = "account_deletion", "Conta agendada para deleção"


class Notification(BaseModel):
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

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["user", "read_at", "expires_at"],
                name="notif_user_unread_idx",
            ),
        ]

    def __str__(self) -> str:
        state = "read" if self.read_at else "unread"
        return f"{self.user.username} — {self.title} ({state})"
