import uuid

from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="created at",
        db_column="created_at",
        db_index=True,
    )
    updated_at = models.DateTimeField(
        auto_now=True, verbose_name="updated at", db_column="updated_at"
    )

    class Meta:
        abstract = True


class BaseModel(TimeStampedModel):
    public_id = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
        db_index=True,
    )

    class Meta:
        abstract = True


# Backward compat alias
PublicIdModel = BaseModel

from .feedback import FeedbackMessage  # noqa: E402,F401
