from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers

from core import messages
from core.storage_urls import build_public_media_url
from core.validators import validate_image_upload

from .exceptions import GoogleIdentityPasswordChangeNotAllowedException
from .models import ConsentHistory, GoogleIdentity, UserProfile

User = get_user_model()


CURRENT_TERMS_VERSION = "1.0"

_PROFILE_FIELDS = ("nickname",)


def _get_client_ip(request) -> str | None:
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True)
    website = serializers.CharField(
        required=False,
        allow_blank=True,
        write_only=True,
        trim_whitespace=False,
    )
    terms_accepted = serializers.BooleanField(write_only=True)

    class Meta:
        model = User
        # "id" removido: evita expor PK sequencial no registro.
        fields = (
            "username",
            "email",
            "password",
            "confirm_password",
            "website",
            "terms_accepted",
        )

    def validate_terms_accepted(self, value):
        if not value:
            raise serializers.ValidationError(
                "Você precisa aceitar os Termos de Uso e a Política de Privacidade."
            )
        return value

    def validate(self, attrs):
        website = attrs.pop("website", "")
        if isinstance(website, str) and website.strip():
            raise serializers.ValidationError(
                {"detail": str(messages.VALIDATION_ERROR)}
            )
        if attrs["password"] != attrs.pop("confirm_password"):
            raise serializers.ValidationError(
                {"confirm_password": str(messages.PASSWORDS_DO_NOT_MATCH)}
            )
        if User.objects.filter(email__iexact=attrs["email"]).exists():
            raise serializers.ValidationError(
                {"email": str(messages.EMAIL_ALREADY_EXISTS)}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop("terms_accepted")
        user = User.objects.create_user(**validated_data)
        UserProfile.objects.update_or_create(
            user=user,
            defaults={
                "terms_accepted_at": timezone.now(),
                "terms_version": CURRENT_TERMS_VERSION,
            },
        )
        request = self.context.get("request")
        ConsentHistory.objects.create(
            user=user,
            terms_version=CURRENT_TERMS_VERSION,
            ip_address=_get_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:512] if request else "",
            method="register",
        )
        return user


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(
        source="first_name",
        required=False,
        allow_blank=True,
        max_length=150,
    )
    nickname = serializers.CharField(required=False, allow_blank=True, max_length=80)
    profile_photo = serializers.ImageField(
        required=False,
        allow_null=True,
        write_only=True,
        validators=[validate_image_upload],
    )
    profile_photo_url = serializers.SerializerMethodField()
    is_google_account = serializers.SerializerMethodField()
    terms_accepted_at = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "display_name",
            "nickname",
            "profile_photo",
            "profile_photo_url",
            "is_google_account",
            "terms_accepted_at",
        )
        read_only_fields = (
            "id",
            "profile_photo_url",
            "is_google_account",
            "terms_accepted_at",
        )

    def validate_email(self, value):
        if (
            value
            and User.objects.filter(email__iexact=value)
            .exclude(pk=self.instance.pk if self.instance else None)
            .exists()
        ):
            raise serializers.ValidationError(str(messages.EMAIL_ALREADY_EXISTS))
        return value

    def get_terms_accepted_at(self, obj):
        profile = self._get_profile(obj)
        if not profile.terms_accepted_at:
            return None
        return profile.terms_accepted_at.isoformat()

    def get_profile_photo_url(self, obj):
        profile = self._get_profile(obj)
        if not profile.profile_photo:
            return ""
        return build_public_media_url(
            profile.profile_photo, self.context.get("request")
        )

    def get_is_google_account(self, obj):
        try:
            return obj.google_identity is not None
        except GoogleIdentity.DoesNotExist:
            return False

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["nickname"] = self._get_profile(instance).nickname
        return data

    def update(self, instance, validated_data):
        from core.image_service import ImageService

        profile_fields = {
            field: validated_data.pop(field, serializers.empty)
            for field in _PROFILE_FIELDS
        }
        photo_file = validated_data.pop("profile_photo", serializers.empty)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        profile = self._get_profile(instance)

        for field, value in profile_fields.items():
            if value is not serializers.empty:
                setattr(profile, field, value)

        if photo_file is not serializers.empty:
            ImageService.replace_media_field(
                profile, "profile_photo", photo_file, instance.id, "profiles"
            )

        profile.save()
        return instance

    def _get_profile(self, user):
        profile, _ = UserProfile.objects.get_or_create(user=user)
        return profile


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(
        write_only=True, validators=[validate_password]
    )
    confirm_password = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if self._is_google_account(user):
            raise GoogleIdentityPasswordChangeNotAllowedException
        if not user.check_password(value):
            raise serializers.ValidationError(str(messages.INVALID_PASSWORD))
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": str(messages.PASSWORDS_DO_NOT_MATCH)}
            )
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user

    def _is_google_account(self, user) -> bool:
        return GoogleIdentity.objects.filter(user=user).exists()


class GoogleLoginSerializer(serializers.Serializer):
    id_token = serializers.CharField()
