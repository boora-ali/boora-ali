import logging
import os
from datetime import timedelta
from pathlib import Path

import resend as _resend
from django.urls import reverse_lazy
from django.utils.translation import gettext_lazy as _
from dotenv import load_dotenv

_log = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
APP_ENV = os.getenv("APP_ENV", "dev")

_sentry_dsn = os.getenv("SENTRY_DSN")
if _sentry_dsn:
    import sentry_sdk

    sentry_sdk.init(
        dsn=_sentry_dsn,
        environment=APP_ENV,
        traces_sample_rate=0.2,
        send_default_pii=False,
    )
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")
AWS_S3_PUBLIC_URL = os.getenv("AWS_S3_PUBLIC_URL", "")
AWS_S3_PUBLIC_ENDPOINT = os.getenv("AWS_S3_PUBLIC_ENDPOINT", "")
AWS_S3_URL_EXPIRES_IN = int(os.getenv("AWS_S3_URL_EXPIRES_IN", "3600"))
AWS_STORAGE_BUCKET_NAME = os.getenv("AWS_STORAGE_BUCKET_NAME", "bora-ali")
AWS_S3_REGION_NAME = os.getenv("AWS_S3_REGION_NAME", "us-east-1")
AWS_S3_ENDPOINT_URL = os.getenv("AWS_S3_ENDPOINT_URL", "http://localhost:8081")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
GOOGLE_OAUTH_CLIENT_ID = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
_resend.api_key = RESEND_API_KEY
EMAIL_FROM = os.getenv("EMAIL_FROM", "Bora Ali <noreply@boraali.com.br>")
EMAIL_VERIFICATION_TIMEOUT_HOURS = int(
    os.getenv("EMAIL_VERIFICATION_TIMEOUT_HOURS", "24")
)
TURNSTILE_SECRET_KEY = os.getenv("TURNSTILE_SECRET_KEY", "")
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://127.0.0.1:6379/1")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://127.0.0.1:6379/2")
CELERY_TASK_DEFAULT_QUEUE = os.getenv("CELERY_TASK_DEFAULT_QUEUE", "default")
CELERY_TASK_SERIALIZER = "json"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_ALWAYS_EAGER = os.getenv("CELERY_TASK_ALWAYS_EAGER", "False") == "True"
HISTORY_RETENTION_DAYS = int(os.getenv("HISTORY_RETENTION_DAYS", "90"))
TRASH_RETENTION_DAYS = int(os.getenv("TRASH_RETENTION_DAYS", "30"))

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-secret")
DEBUG = os.getenv("DJANGO_DEBUG", "False") == "True"
USE_VERSITYGW = os.getenv("USE_VERSITYGW", "True") == "True"
USE_R2 = (
    os.getenv("AWS_S3_ENDPOINT_URL", "").startswith("https://") and not USE_VERSITYGW
)


def _split_env(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _host_from_url(value: str) -> str:
    if not value:
        return ""
    from urllib.parse import urlparse

    return urlparse(value).hostname or ""


def _default_allowed_hosts() -> list[str]:
    hosts = ["localhost", "127.0.0.1"]
    public_host = _host_from_url(PUBLIC_BASE_URL)
    if public_host:
        hosts.append(public_host)
    if APP_ENV == "preprod":
        hosts.extend([".ngrok-free.app", ".ngrok-free.dev"])
    if APP_ENV == "prod" and not public_host:
        return []
    return hosts


ALLOWED_HOSTS = (
    _split_env(os.getenv("DJANGO_ALLOWED_HOSTS", "")) or _default_allowed_hosts()
)

_weak_key = SECRET_KEY in ("dev-secret", "changeme") or len(SECRET_KEY) < 50
_skip_secret_key_check = os.getenv("DJANGO_SKIP_SECRET_KEY_CHECK", "False") == "True"
if _weak_key and not DEBUG and not _skip_secret_key_check:
    raise RuntimeError(
        "DJANGO_SECRET_KEY inválida: defina uma chave aleatória forte (mínimo 50 caracteres) "
        "antes de rodar em produção. Use: "
        'python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"'
    )
if _weak_key and (DEBUG or _skip_secret_key_check):
    _log.warning(
        "DJANGO_SECRET_KEY is weak — set a strong key before going to production."
    )

MEDIA_ENCRYPTION_KEY = os.getenv("MEDIA_ENCRYPTION_KEY", "")
if not MEDIA_ENCRYPTION_KEY and not DEBUG:
    raise RuntimeError(
        "MEDIA_ENCRYPTION_KEY não definida. "
        'Gere com: python -c "import secrets; print(secrets.token_hex(32))"'
    )
if not MEDIA_ENCRYPTION_KEY and DEBUG:
    _log.warning(
        "MEDIA_ENCRYPTION_KEY não definida — usando SECRET_KEY como fallback (apenas dev)."
    )
    MEDIA_ENCRYPTION_KEY = SECRET_KEY

# Configurações de segurança HTTPS para produção.
# Em desenvolvimento (DEBUG=True) são desativadas para não bloquear HTTP local.
if not DEBUG:
    SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "True") == "True"
    SECURE_HSTS_SECONDS = 31536000  # 1 ano
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

INSTALLED_APPS = [
    "unfold",
    "unfold.contrib.filters",
    "unfold.contrib.forms",
    "unfold.contrib.inlines",
    "unfold.contrib.simple_history",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "corsheaders",
    "drf_spectacular",
    "simple_history",
    "django_celery_beat",
    "accounts",
    "places",
    "notifications",
]

UNFOLD = {
    "SITE_TITLE": _("Bora Ali Admin"),
    "SITE_HEADER": _("Bora Ali"),
    "SITE_SUBHEADER": _("Diário pessoal de lugares"),
    "SITE_SYMBOL": "travel_explore",
    "SITE_URL": "/",
    "SHOW_HISTORY": True,
    "SHOW_VIEW_ON_SITE": False,
    "SHOW_BACK_BUTTON": True,
    "BORDER_RADIUS": "8px",
    "COLORS": {
        "primary": {
            "50": "oklch(97.6% .018 166.113)",
            "100": "oklch(95% .052 163.051)",
            "200": "oklch(90.5% .093 164.15)",
            "300": "oklch(84.5% .143 164.978)",
            "400": "oklch(76.5% .177 163.223)",
            "500": "oklch(69.6% .17 162.48)",
            "600": "oklch(59.6% .145 163.225)",
            "700": "oklch(50.8% .118 165.612)",
            "800": "oklch(43.2% .095 166.913)",
            "900": "oklch(37.8% .077 168.94)",
            "950": "oklch(26.2% .051 172.552)",
        },
    },
    "SIDEBAR": {
        "show_search": True,
        "command_search": True,
        "show_all_applications": True,
        "navigation": [
            {
                "title": _("Insights"),
                "separator": True,
                "collapsible": False,
                "items": [
                    {
                        "title": _("Dashboard"),
                        "icon": "dashboard",
                        "link": reverse_lazy("boraali_admin:index"),
                    },
                    {
                        "title": _("Lugares"),
                        "icon": "location_on",
                        "link": reverse_lazy("boraali_admin:places_place_changelist"),
                    },
                    {
                        "title": _("Visitas"),
                        "icon": "event_available",
                        "link": reverse_lazy("boraali_admin:places_visit_changelist"),
                    },
                    {
                        "title": _("Itens consumidos"),
                        "icon": "restaurant",
                        "link": reverse_lazy(
                            "boraali_admin:places_visititem_changelist"
                        ),
                    },
                ],
            },
            {
                "title": _("Contas"),
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": _("Usuários"),
                        "icon": "people",
                        "link": reverse_lazy("boraali_admin:auth_user_changelist"),
                    },
                    {
                        "title": _("Grupos"),
                        "icon": "groups",
                        "link": reverse_lazy("boraali_admin:auth_group_changelist"),
                    },
                    {
                        "title": _("Perfis"),
                        "icon": "account_circle",
                        "link": reverse_lazy(
                            "boraali_admin:accounts_userprofile_changelist"
                        ),
                    },
                    {
                        "title": _("Google"),
                        "icon": "passkey",
                        "link": reverse_lazy(
                            "boraali_admin:accounts_googleidentity_changelist"
                        ),
                    },
                    {
                        "title": _("Sessões de usuário"),
                        "icon": "devices",
                        "link": reverse_lazy(
                            "boraali_admin:accounts_usersession_changelist"
                        ),
                    },
                ],
            },
            {
                "title": _("Segurança"),
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": _("Tokens ativos"),
                        "icon": "key",
                        "link": reverse_lazy(
                            "boraali_admin:token_blacklist_outstandingtoken_changelist"
                        ),
                    },
                    {
                        "title": _("Tokens bloqueados"),
                        "icon": "block",
                        "link": reverse_lazy(
                            "boraali_admin:token_blacklist_blacklistedtoken_changelist"
                        ),
                    },
                ],
            },
            {
                "title": _("Operações"),
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": _("Tasks periódicas"),
                        "icon": "task_alt",
                        "link": reverse_lazy(
                            "boraali_admin:django_celery_beat_periodictask_changelist"
                        ),
                    },
                    {
                        "title": _("Crontabs"),
                        "icon": "schedule",
                        "link": reverse_lazy(
                            "boraali_admin:django_celery_beat_crontabschedule_changelist"
                        ),
                    },
                    {
                        "title": _("Intervalos"),
                        "icon": "timer",
                        "link": reverse_lazy(
                            "boraali_admin:django_celery_beat_intervalschedule_changelist"
                        ),
                    },
                    {
                        "title": _("Solar"),
                        "icon": "wb_sunny",
                        "link": reverse_lazy(
                            "boraali_admin:django_celery_beat_solarschedule_changelist"
                        ),
                    },
                    {
                        "title": _("Execução única"),
                        "icon": "event",
                        "link": reverse_lazy(
                            "boraali_admin:django_celery_beat_clockedschedule_changelist"
                        ),
                    },
                    {
                        "title": _("Estado do beat"),
                        "icon": "update",
                        "link": reverse_lazy(
                            "boraali_admin:django_celery_beat_periodictasks_changelist"
                        ),
                    },
                ],
            },
            {
                "title": _("Sistema"),
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": _("Sessões Django"),
                        "icon": "storage",
                        "link": reverse_lazy(
                            "boraali_admin:sessions_session_changelist"
                        ),
                    },
                    {
                        "title": _("Tipos de conteúdo"),
                        "icon": "category",
                        "link": reverse_lazy(
                            "boraali_admin:contenttypes_contenttype_changelist"
                        ),
                    },
                ],
            },
        ],
    },
    "TABS": [
        {
            "models": [
                "places.place",
                "places.visit",
                "places.visititem",
                {"name": "places.place", "detail": True},
                {"name": "places.visit", "detail": True},
                {"name": "places.visititem", "detail": True},
            ],
            "items": [
                {
                    "title": _("Lugares"),
                    "link": reverse_lazy("boraali_admin:places_place_changelist"),
                },
                {
                    "title": _("Visitas"),
                    "link": reverse_lazy("boraali_admin:places_visit_changelist"),
                },
                {
                    "title": _("Itens"),
                    "link": reverse_lazy("boraali_admin:places_visititem_changelist"),
                },
            ],
        },
    ],
}

CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "simple_history.middleware.HistoryRequestMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB"),
        "USER": os.getenv("POSTGRES_USER"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD"),
        "HOST": os.getenv("POSTGRES_HOST", "localhost"),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
        "CONN_MAX_AGE": 60,
    }
}

_REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": _REDIS_URL,
    }
}

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

LANGUAGES = [
    ("pt-br", "Português (Brasil)"),
    ("en", "English"),
]

LOCALE_PATHS = [BASE_DIR / "locale"]

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = os.path.join(BASE_DIR, "media")

# VersityGW Object Storage Configuration
if USE_VERSITYGW:
    # Use VersityGW (S3-compatible) for file storage
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
            "OPTIONS": {
                "bucket_name": os.getenv("AWS_STORAGE_BUCKET_NAME", "bora-ali"),
                "region_name": os.getenv("AWS_S3_REGION_NAME", "us-east-1"),
                "endpoint_url": os.getenv(
                    "AWS_S3_ENDPOINT_URL", "http://localhost:8081"
                ),
                "use_ssl": os.getenv("AWS_S3_USE_SSL", "False") == "True",
                "addressing_style": "path",
                "signature_version": "s3v4",
                "default_acl": None,
            },
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }
    public_media_base = os.getenv("AWS_S3_PUBLIC_URL", "").rstrip("/")
    if public_media_base:
        MEDIA_URL = f"{public_media_base}/"
    else:
        MEDIA_URL = f"{os.getenv('AWS_S3_ENDPOINT_URL', 'http://localhost:8080')}/{os.getenv('AWS_STORAGE_BUCKET_NAME', 'bora-ali')}/"
elif USE_R2:
    # Cloudflare R2 (S3-compatible, no VersityGW)
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
            "OPTIONS": {
                "bucket_name": os.getenv("AWS_STORAGE_BUCKET_NAME", "bora-ali"),
                "region_name": os.getenv("AWS_S3_REGION_NAME", "auto"),
                "endpoint_url": os.getenv("AWS_S3_ENDPOINT_URL"),
                "use_ssl": True,
                "addressing_style": "path",
                "signature_version": "s3v4",
                "default_acl": None,
            },
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }
    MEDIA_URL = f"{os.getenv('AWS_S3_ENDPOINT_URL', '').rstrip('/')}/{os.getenv('AWS_STORAGE_BUCKET_NAME', 'bora-ali')}/"
else:
    # Local filesystem para desenvolvimento sem storage externo
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.authentication.SingleSessionJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 4,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "core.exception_handler.semantic_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "1000/hour",
        "auth": "30/minute",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=2),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "ALGORITHM": "HS256",
    "ALLOWED_ALGORITHMS": ["HS256"],
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Bora Ali API",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

_default_browser_origins = ["http://localhost:5173", "http://localhost:8080"]
if PUBLIC_BASE_URL:
    _default_browser_origins.append(PUBLIC_BASE_URL)

CORS_ALLOWED_ORIGINS = (
    _split_env(os.getenv("CORS_ALLOWED_ORIGINS", "")) or _default_browser_origins
)
CSRF_TRUSTED_ORIGINS = (
    _split_env(os.getenv("CSRF_TRUSTED_ORIGINS", "")) or _default_browser_origins
)

# Limite de tamanho de upload: protege contra request bodies gigantes.
# Arquivos maiores que 10 MB são rejeitados antes de chegar nos serializers.
DATA_UPLOAD_MAX_MEMORY_SIZE = 15 * 1024 * 1024  # 15 MB (inclui fields não-arquivo)
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10 MB (spool em memória)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
        },
    },
    "loggers": {
        # Loga queries SQL apenas em modo DEBUG — jamais em produção
        "django.db.backends": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "WARNING",
            "propagate": False,
        },
        # Mostra 4xx/5xx e erros de request no console
        "django.request": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        # Nunca loga headers de Authorization, cookies ou tokens
        "django.security": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "accounts": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "core": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}

