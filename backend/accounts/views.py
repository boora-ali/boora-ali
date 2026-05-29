import logging

from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.exceptions import InvalidTokenException
from core.views import MutationMixin

from .serializers import (
    CURRENT_TERMS_VERSION,
    GoogleLoginSerializer,
    PasswordChangeSerializer,
    RegisterSerializer,
    UserSerializer,
)
from .services import AccountLifecycleService, GoogleAuthService
from .throttles import AuthRateThrottle, RateLimitHeadersMixin
from .token_serializers import (
    SingleSessionTokenObtainPairSerializer,
    SingleSessionTokenRefreshSerializer,
    build_token_pair_for_user,
)
from .turnstile import TurnstileMixin

logger = logging.getLogger(__name__)


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


def _send_verification_email(user, profile=None) -> None:
    AccountLifecycleService.send_verification_email(user, profile)


class RegisterView(
    MutationMixin, TurnstileMixin, RateLimitHeadersMixin, generics.CreateAPIView
):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def perform_create(self, serializer):
        user = serializer.save()
        profile = AccountLifecycleService.get_or_create_profile(user)
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
        from django.contrib.auth import get_user_model
        return (
            get_user_model()
            .objects.select_related("profile", "google_identity")
            .get(pk=self.request.user.pk)
        )


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
        try:
            AccountLifecycleService.request_account_deletion(
                request.user, request.data.get("password", "")
            )
        except ValidationError as exc:
            detail = getattr(exc, "detail", {})
            if isinstance(detail, dict) and "password" in detail:
                value = detail["password"]
                message = value[0] if isinstance(value, list) else str(value)
                return Response(
                    {"password": message}, status=status.HTTP_400_BAD_REQUEST
                )
            raise
        return Response({"detail": "Conta agendada para exclusão em 7 dias."})


class VerifyEmailView(MutationMixin, APIView):
    permission_classes = [permissions.AllowAny]  # token é o segredo
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        token = request.data.get("token", "").strip()
        if not token:
            raise ValidationError({"token": "Token obrigatório."})
        AccountLifecycleService.verify_email_token(token)
        return Response({"detail": "Email verificado com sucesso."})


class ResendVerificationEmailView(MutationMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        result = AccountLifecycleService.resend_verification_email(request.user)
        if result == "verified":
            return Response({"detail": "Email já verificado."})
        if result.startswith("cooldown:"):
            wait = result.split(":", 1)[1]
            return Response(
                {"detail": f"Aguarde {wait}s antes de solicitar novamente."},
                status=429,
            )
        return Response({"detail": "Email de verificação reenviado."})


class TermsAcceptView(MutationMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        AccountLifecycleService.accept_terms(request.user, CURRENT_TERMS_VERSION)
        return Response(status=status.HTTP_204_NO_CONTENT)


class GoogleLoginView(MutationMixin, RateLimitHeadersMixin, APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = GoogleLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        claims = GoogleAuthService.verify_id_token(
            serializer.validated_data["id_token"]
        )
        user = GoogleAuthService.resolve_user(claims)
        logger.info(
            "Google login succeeded for user_id=%s username=%s", user.id, user.username
        )
        token_pair = build_token_pair_for_user(user)
        refresh_token = token_pair.pop("refresh")
        response = Response(token_pair)
        _set_refresh_cookie(response, refresh_token)
        return response
