import os

os.environ.setdefault("MEDIA_ENCRYPTION_KEY", "test-media-encryption-key-not-for-production")

from .settings import *  # noqa: F403

USE_VERSITYGW = False
GOOGLE_OAUTH_CLIENT_ID = "test-google-oauth-client-id"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
SECURE_SSL_REDIRECT = False
CELERY_TASK_ALWAYS_EAGER = True

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.dummy.DummyCache",
    }
}
