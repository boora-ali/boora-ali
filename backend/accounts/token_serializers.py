from django.contrib.auth import authenticate, get_user_model
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.settings import api_settings

from core import messages
from core.exceptions import (
    InvalidCredentialsException,
    SessionInvalidatedException,
    SessionNotFoundException,
)

from .authentication import invalidate_session_cache
from .exceptions import EmailNotVerifiedException
from .models import GoogleIdentity, UserSession
from .services import AccountLifecycleService

User = get_user_model()


class SingleSessionTokenObtainPairSerializer(TokenObtainPairSerializer):
    """On login, rotates the session_key and embeds it in both tokens."""

    default_error_messages = {
        "no_active_account": messages.INVALID_CREDENTIALS,
    }

    @classmethod
    def get_token(cls, user):
        session, _ = UserSession.objects.get_or_create(user=user)
        session.rotate()

        token = super().get_token(user)
        token["session_key"] = str(session.session_key)
        return token

    def validate(self, attrs):
        login_value = attrs.get("username", "")
        if login_value and "@" in login_value:
            username = (
                User.objects.filter(email__iexact=login_value)
                .values_list("username", flat=True)
                .first()
            )
            # Always set username (found or not) so both paths hit authenticate()
            # with the same code, minimising timing difference for email enumeration.
            attrs["username"] = username or login_value

        request = self.context.get("request")
        user = authenticate(
            request=request,
            username=attrs.get(self.username_field),
            password=attrs.get("password"),
        )
        if not user or not user.is_active:
            raise InvalidCredentialsException

        profile = getattr(user, "profile", None)
        if profile and not profile.email_verified:
            if not GoogleIdentity.objects.filter(user=user).exists():
                raise EmailNotVerifiedException

        data = build_token_pair_for_user(user)

        if AccountLifecycleService.reactivate_account_if_pending(user):
            data["account_reactivated"] = True

        return data


def build_token_pair_for_user(user):
    refresh = SingleSessionTokenObtainPairSerializer.get_token(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


class SingleSessionTokenRefreshSerializer(TokenRefreshSerializer):
    """On refresh, validates session_key and rotates it to eliminate replay window."""

    def validate(self, attrs):
        refresh = self.token_class(attrs["refresh"])

        token_session_key = refresh.get("session_key")
        if not token_session_key:
            raise SessionNotFoundException

        user_id = refresh.get(api_settings.USER_ID_CLAIM)
        try:
            user = User.objects.select_related("active_session").get(pk=user_id)
            session = user.active_session
            if str(session.session_key) != str(token_session_key):
                raise SessionInvalidatedException
        except (User.DoesNotExist, UserSession.DoesNotExist):
            raise SessionNotFoundException

        # Rotate session_key on every refresh — eliminates stolen-token replay window
        session.rotate()
        invalidate_session_cache(user.pk)
        new_session_key = str(session.session_key)

        data = super().validate(attrs)

        if "refresh" in data:
            new_refresh = self.token_class(data["refresh"])
            new_refresh["session_key"] = new_session_key
            data["refresh"] = str(new_refresh)
            # Re-derive access token from updated refresh so it carries new session_key.
            data["access"] = str(new_refresh.access_token)

        return data
