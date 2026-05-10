import io

import pytest
from django.test import override_settings
from model_bakery import baker
from PIL import Image
from rest_framework.test import APIRequestFactory

from accounts.serializers import UserSerializer


def make_jpeg():
    buf = io.BytesIO()
    Image.new("RGB", (10, 10)).save(buf, format="JPEG")
    buf.seek(0)
    buf.name = "photo.jpg"
    buf.content_type = "image/jpeg"
    buf.size = len(buf.getvalue())
    return buf


_STORAGE_SETTINGS = dict(
    SECRET_KEY="test-secret-key-long-enough-for-hkdf-derivation-1234",
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    },
)


@pytest.mark.django_db
@override_settings(**_STORAGE_SETTINGS)
def test_profile_photo_saved_under_user_path(tmp_path, settings, django_user_model):
    settings.MEDIA_ROOT = str(tmp_path)
    user = baker.make(django_user_model)
    factory = APIRequestFactory()
    request = factory.patch("/api/auth/me/")
    request.user = user

    photo = make_jpeg()
    serializer = UserSerializer(
        instance=user,
        data={"profile_photo": photo},
        partial=True,
        context={"request": request},
    )
    assert serializer.is_valid(), serializer.errors
    serializer.save()

    from accounts.models import UserProfile

    profile = UserProfile.objects.get(user=user)
    assert profile.profile_photo.name.startswith(f"users/{user.id}/profiles/")


@pytest.mark.django_db
@override_settings(**_STORAGE_SETTINGS)
def test_old_profile_photo_deleted_on_update(tmp_path, settings, django_user_model):
    settings.MEDIA_ROOT = str(tmp_path)
    user = baker.make(django_user_model)
    factory = APIRequestFactory()
    request = factory.patch("/api/auth/me/")
    request.user = user

    # First upload
    s1 = UserSerializer(
        instance=user,
        data={"profile_photo": make_jpeg()},
        partial=True,
        context={"request": request},
    )
    assert s1.is_valid()
    s1.save()

    from django.core.files.storage import default_storage

    from accounts.models import UserProfile

    profile = UserProfile.objects.get(user=user)
    old_path = profile.profile_photo.name
    assert default_storage.exists(old_path)

    # Second upload — old file must be deleted
    s2 = UserSerializer(
        instance=user,
        data={"profile_photo": make_jpeg()},
        partial=True,
        context={"request": request},
    )
    assert s2.is_valid()
    s2.save()

    assert not default_storage.exists(old_path)


@pytest.mark.django_db
@override_settings(**_STORAGE_SETTINGS)
def test_profile_photo_cleared_when_null_sent(tmp_path, settings, django_user_model):
    """profile_photo=None clears the field and deletes the old file."""
    settings.MEDIA_ROOT = str(tmp_path)
    user = baker.make(django_user_model)
    factory = APIRequestFactory()
    request = factory.patch("/api/auth/me/")
    request.user = user

    # First upload a photo
    s1 = UserSerializer(
        instance=user,
        data={"profile_photo": make_jpeg()},
        partial=True,
        context={"request": request},
    )
    assert s1.is_valid()
    s1.save()

    from django.core.files.storage import default_storage

    from accounts.models import UserProfile

    profile = UserProfile.objects.get(user=user)
    old_path = profile.profile_photo.name
    assert default_storage.exists(old_path)

    # Now clear it with None
    s2 = UserSerializer(
        instance=user,
        data={"profile_photo": None},
        partial=True,
        context={"request": request},
    )
    assert s2.is_valid(), s2.errors
    s2.save()

    profile.refresh_from_db()
    assert not profile.profile_photo
    assert not default_storage.exists(old_path)


@pytest.mark.django_db
@override_settings(**_STORAGE_SETTINGS)
def test_profile_photo_unchanged_when_omitted(tmp_path, settings, django_user_model):
    """Partial update omitting profile_photo should leave it unchanged."""
    settings.MEDIA_ROOT = str(tmp_path)
    user = baker.make(django_user_model)
    factory = APIRequestFactory()
    request = factory.patch("/api/auth/me/")
    request.user = user

    # First upload a photo
    s1 = UserSerializer(
        instance=user,
        data={"profile_photo": make_jpeg()},
        partial=True,
        context={"request": request},
    )
    assert s1.is_valid()
    s1.save()

    from django.core.files.storage import default_storage

    from accounts.models import UserProfile

    profile = UserProfile.objects.get(user=user)
    original_path = profile.profile_photo.name
    assert default_storage.exists(original_path)

    # Partial update omitting photo (only updating nickname)
    s2 = UserSerializer(
        instance=user,
        data={"nickname": "new-nick"},
        partial=True,
        context={"request": request},
    )
    assert s2.is_valid(), s2.errors
    s2.save()

    profile.refresh_from_db()
    assert profile.profile_photo.name == original_path
    assert default_storage.exists(original_path)
