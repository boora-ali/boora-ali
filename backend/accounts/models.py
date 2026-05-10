import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class UserSession(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="active_session",
        verbose_name=_("user"),
    )
    session_key = models.UUIDField(default=uuid.uuid4, verbose_name=_("session key"))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounts_user_session"
        verbose_name = _("user session")
        verbose_name_plural = _("user sessions")

    def __str__(self) -> str:
        return f"{self.user.username} — {self.session_key}"

    def rotate(self) -> None:
        from .authentication import invalidate_session_cache

        self.session_key = uuid.uuid4()
        type(self).objects.filter(pk=self.pk).update(session_key=self.session_key)
        invalidate_session_cache(self.user_id)


class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
        verbose_name=_("user"),
    )
    nickname = models.CharField(max_length=80, blank=True, verbose_name=_("nickname"))
    profile_photo = models.ImageField(
        upload_to="profiles/",
        blank=True,
        null=True,
        verbose_name=_("profile photo"),
    )
    terms_accepted_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_("terms accepted at"),
    )
    terms_version = models.CharField(
        max_length=20,
        blank=True,
        default="",
        verbose_name=_("terms version"),
    )

    class Meta:
        db_table = "accounts_user_profile"
        verbose_name = _("user profile")
        verbose_name_plural = _("user profiles")

    def __str__(self) -> str:
        return self.user.username


class GoogleIdentity(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="google_identity",
        verbose_name=_("user"),
    )
    google_sub = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
        verbose_name=_("google sub"),
    )
    email = models.EmailField(verbose_name=_("email"))
    email_verified = models.BooleanField(
        default=False,
        verbose_name=_("email verified"),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "accounts_google_identity"
        verbose_name = _("google identity")
        verbose_name_plural = _("google identities")

    def __str__(self) -> str:
        return f"{self.user.username} — {self.google_sub}"
