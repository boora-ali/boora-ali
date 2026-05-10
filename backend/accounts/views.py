import logging

from django.utils import timezone
from rest_framework import generics, permissions, status
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

logger = logging.getLogger(__name__)


class RegisterView(
    MutationMixin, TurnstileMixin, RateLimitHeadersMixin, generics.CreateAPIView
):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"


class ThrottledLoginView(
    MutationMixin, TurnstileMixin, RateLimitHeadersMixin, TokenObtainPairView
):
    serializer_class = SingleSessionTokenObtainPairSerializer
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"


class ThrottledRefreshView(MutationMixin, RateLimitHeadersMixin, TokenRefreshView):
    serializer_class = SingleSessionTokenRefreshSerializer
    throttle_classes = []  # refresh token is signed — brute force is infeasible


class LogoutView(MutationMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh = request.data.get("refresh")
        if not refresh:
            raise InvalidTokenException
        try:
            RefreshToken(refresh).blacklist()
        except Exception:
            raise InvalidTokenException
        return Response(status=status.HTTP_205_RESET_CONTENT)


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
        return Response(build_token_pair_for_user(user))
