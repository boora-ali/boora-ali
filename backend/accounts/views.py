import logging
import secrets
from datetime import timedelta

import resend
from django.conf import settings
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.exceptions import InvalidTokenException
from core.views import MutationMixin

from . import google_login
from .models import UserProfile
from .serializers import (
    CURRENT_TERMS_VERSION,
    GoogleLoginSerializer,
    PasswordChangeSerializer,
    RegisterSerializer,
    UserSerializer,
)
from .throttles import AuthRateThrottle, RateLimitHeadersMixin
from .token_serializers import (
    SingleSessionTokenObtainPairSerializer,
    SingleSessionTokenRefreshSerializer,
    build_token_pair_for_user,
)
from .turnstile import TurnstileMixin

resend.api_key = settings.RESEND_API_KEY

logger = logging.getLogger(__name__)

_email_log = logging.getLogger("accounts.email")


def _send_verification_email(user, profile) -> None:
    token = secrets.token_urlsafe(32)
    profile.email_verification_token = token
    profile.email_verification_sent_at = timezone.now()
    profile.save(
        update_fields=["email_verification_token", "email_verification_sent_at"]
    )

    verification_url = f"{settings.PUBLIC_BASE_URL}/verify-email?token={token}"
    try:
        resend.Emails.send(
            {
                "from": settings.EMAIL_FROM,
                "to": [user.email],
                "subject": "Confirme seu email — Bora Ali",
                "html": (
                    "<p>Olá! Acesse o link abaixo para verificar seu email:</p>"
                    f"<p><a href='{verification_url}'>{verification_url}</a></p>"
                    f"<p>O link expira em {settings.EMAIL_VERIFICATION_TIMEOUT_HOURS} horas.</p>"
                ),
            }
        )
    except Exception:
        _email_log.exception("Falha ao enviar email de verificação para %s", user.email)


REFRESH_COOKIE_NAME = "boraali_refresh"
REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7  # 7 days
REFRESH_COOKIE_PATH = "/api/auth/"


def _set_refresh_cookie(response, refresh_token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="Strict",
        max_age=REFRESH_COOKIE_MAX_AGE,
        path=REFRESH_COOKIE_PATH,
    )


class RegisterView(
    MutationMixin, TurnstileMixin, RateLimitHeadersMixin, generics.CreateAPIView
):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def perform_create(self, serializer):
        user = serializer.save()
        profile, _ = UserProfile.objects.get_or_create(user=user)
        _send_verification_email(user, profile)


class ThrottledLoginView(
    MutationMixin, TurnstileMixin, RateLimitHeadersMixin, TokenObtainPairView
):
    serializer_class = SingleSessionTokenObtainPairSerializer
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200 and "refresh" in response.data:
            refresh_token = response.data.pop("refresh")
            _set_refresh_cookie(response, refresh_token)
        return response


class CookieTokenRefreshView(MutationMixin, RateLimitHeadersMixin, TokenRefreshView):
    serializer_class = SingleSessionTokenRefreshSerializer
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if not refresh_token:
            return Response(
                {"detail": "No refresh token."}, status=status.HTTP_401_UNAUTHORIZED
            )
        # Inject cookie value into request data so the serializer can validate it
        data = (
            request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        )
        data["refresh"] = refresh_token
        request._full_data = data
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200 and "refresh" in response.data:
            new_refresh = response.data.pop("refresh")
            _set_refresh_cookie(response, new_refresh)
        return response


class LogoutView(MutationMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if not refresh:
            raise InvalidTokenException
        try:
            RefreshToken(refresh).blacklist()
        except Exception:
            raise InvalidTokenException
        response = Response(status=status.HTTP_205_RESET_CONTENT)
        response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)
        return response


class MeView(MutationMixin, generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    # Bloqueia PUT explicitamente — apenas GET e PATCH permitidos.
    # PUT poderia sobrescrever campos opcionais (ex: email) com blank inesperadamente.
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.user


class PasswordChangeView(MutationMixin, RateLimitHeadersMixin, generics.GenericAPIView):
    serializer_class = PasswordChangeSerializer
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DeleteAccountView(MutationMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        if not hasattr(request.user, "google_identity"):
            password = request.data.get("password", "")
            if not password or not request.user.check_password(password):
                return Response({"password": "Senha incorreta."}, status=400)

        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.deletion_requested_at:
            return Response({"detail": "Exclusão já solicitada."}, status=400)
        profile.deletion_requested_at = timezone.now()
        profile.save(update_fields=["deletion_requested_at"])

        from notifications.models import NotificationType
        from notifications.service import notify

        notify(
            user=request.user,
            notification_type=NotificationType.ACCOUNT_DELETION,
            title="Conta agendada para exclusão",
            body="Sua conta será excluída permanentemente em 7 dias. "
            "Faça login antes disso para cancelar.",
        )

        return Response({"detail": "Conta agendada para exclusão em 7 dias."})


class VerifyEmailView(MutationMixin, APIView):
    permission_classes = [permissions.AllowAny]  # token é o segredo
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        token = request.data.get("token", "").strip()
        if not token:
            raise ValidationError({"token": "Token obrigatório."})

        profile = UserProfile.objects.filter(
            email_verification_token=token,
            email_verification_sent_at__isnull=False,
        ).first()
        if not profile:
            raise ValidationError({"token": "Token inválido ou expirado."})

        timeout = timedelta(hours=settings.EMAIL_VERIFICATION_TIMEOUT_HOURS)
        if timezone.now() - profile.email_verification_sent_at > timeout:
            raise ValidationError({"token": "Token expirado. Solicite um novo."})

        profile.email_verified = True
        profile.email_verification_token = ""
        profile.save(update_fields=["email_verified", "email_verification_token"])
        return Response({"detail": "Email verificado com sucesso."})


class ResendVerificationEmailView(MutationMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.email_verified:
            return Response({"detail": "Email já verificado."})
        cooldown = timedelta(minutes=1)
        if profile.email_verification_sent_at:
            elapsed = timezone.now() - profile.email_verification_sent_at
            if elapsed < cooldown:
                wait = int((cooldown - elapsed).total_seconds())
                return Response(
                    {"detail": f"Aguarde {wait}s antes de solicitar novamente."},
                    status=429,
                )
        _send_verification_email(request.user, profile)
        return Response({"detail": "Email de verificação reenviado."})


class TermsAcceptView(MutationMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        profile.terms_accepted_at = timezone.now()
        profile.terms_version = CURRENT_TERMS_VERSION
        profile.save(update_fields=["terms_accepted_at", "terms_version"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class GoogleLoginView(MutationMixin, RateLimitHeadersMixin, APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = GoogleLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        claims = google_login.verify_google_id_token(
            serializer.validated_data["id_token"]
        )
        user = google_login.resolve_google_user(claims)
        logger.info(
            "Google login succeeded for user_id=%s username=%s", user.id, user.username
        )
        token_pair = build_token_pair_for_user(user)
        refresh_token = token_pair.pop("refresh")
        response = Response(token_pair)
        _set_refresh_cookie(response, refresh_token)
        return response
