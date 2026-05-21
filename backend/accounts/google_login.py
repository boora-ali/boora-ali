from __future__ import annotations

import logging
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils.text import slugify

from .exceptions import (
    GoogleIdentityEmailConflictException,
    GoogleIdentityEmailNotVerifiedException,
    GoogleIdentityTokenInvalidException,
    GoogleOAuthClientIdNotConfiguredException,
)
from .models import GoogleIdentity, UserProfile

User = get_user_model()
logger = logging.getLogger(__name__)


def verify_google_id_token(id_token: str) -> dict[str, Any]:
    client_id = getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "")
    if not client_id:
        logger.error("Google OAuth client id not configured")
        raise GoogleOAuthClientIdNotConfiguredException

    try:
        from google.auth import exceptions as google_auth_exceptions
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token as google_id_token
    except ImportError as error:
        logger.exception("google-auth dependency is not available")
        raise GoogleIdentityTokenInvalidException from error

    try:
        claims = google_id_token.verify_oauth2_token(
            id_token,
            google_requests.Request(),
            client_id,
        )
        logger.info(
            "Google token verified for sub=%s email=%s verified=%s",
            claims.get("sub"),
            claims.get("email"),
            claims.get("email_verified"),
        )
        return claims
    except (ValueError, google_auth_exceptions.GoogleAuthError) as error:
        logger.warning("Google token verification failed: %s", error.__class__.__name__)
        raise GoogleIdentityTokenInvalidException from error


def resolve_google_user(claims: dict[str, Any]):
    google_sub = str(claims.get("sub", "")).strip()
    email = str(claims.get("email", "")).strip()
    email_verified = bool(claims.get("email_verified"))

    if not google_sub or not email:
        logger.warning("Google claims missing sub/email")
        raise GoogleIdentityTokenInvalidException

    with transaction.atomic():
        identity = (
            GoogleIdentity.objects.select_related("user")
            .filter(google_sub=google_sub)
            .first()
        )
        if identity:
            logger.info(
                "Google identity matched existing link for user_id=%s", identity.user_id
            )
            identity.email = email
            identity.email_verified = email_verified
            identity.save(update_fields=["email", "email_verified", "updated_at"])
            UserProfile.objects.update_or_create(
                user=identity.user, defaults={"email_verified": True}
            )
            return identity.user

        if not email_verified:
            logger.warning(
                "Google email is not verified for sub=%s email=%s", google_sub, email
            )
            raise GoogleIdentityEmailNotVerifiedException

        matched_users = list(
            User.objects.filter(email__iexact=email).order_by("id")[:2]
        )
        if len(matched_users) > 1:
            logger.warning(
                "Google email conflict for email=%s matched_users=%s",
                email,
                len(matched_users),
            )
            raise GoogleIdentityEmailConflictException

        if matched_users:
            user = matched_users[0]
            logger.info(
                "Google login linked verified email=%s to existing user_id=%s",
                email,
                user.id,
            )
            identity, _ = GoogleIdentity.objects.get_or_create(
                user=user,
                defaults={
                    "google_sub": google_sub,
                    "email": email,
                    "email_verified": email_verified,
                },
            )
            if identity.google_sub != google_sub:
                identity.google_sub = google_sub
                identity.email = email
                identity.email_verified = email_verified
                identity.save(
                    update_fields=[
                        "google_sub",
                        "email",
                        "email_verified",
                        "updated_at",
                    ]
                )
            UserProfile.objects.update_or_create(
                user=user, defaults={"email_verified": True}
            )
            return user

        username = _build_unique_username(email=email, sub=google_sub, claims=claims)
        logger.info(
            "Google login creating new local user for email=%s username=%s",
            email,
            username,
        )
        user = User.objects.create_user(
            username=username,
            email=email,
            password=None,
        )
        user.set_unusable_password()
        user.save(update_fields=["password"])

        UserProfile.objects.update_or_create(
            user=user, defaults={"email_verified": True}
        )
        GoogleIdentity.objects.create(
            user=user,
            google_sub=google_sub,
            email=email,
            email_verified=email_verified,
        )
        return user


def _build_unique_username(*, email: str, sub: str, claims: dict[str, Any]) -> str:
    candidates = [
        claims.get("name"),
        claims.get("given_name"),
        email.split("@")[0],
        "google-user",
    ]
    base = ""
    for candidate in candidates:
        if candidate:
            base = slugify(str(candidate))
            if base:
                break
    if not base:
        base = "google-user"

    base = base[:142]
    username = base
    suffix = sub.replace("-", "")[:8] or "google"
    if not User.objects.filter(username=username).exists():
        return username

    username = f"{base}-{suffix}"[:150]
    if not User.objects.filter(username=username).exists():
        return username

    index = 2
    while True:
        username = f"{base}-{suffix}-{index}"[:150]
        if not User.objects.filter(username=username).exists():
            return username
        index += 1
