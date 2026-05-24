import io

import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management import call_command
from django.test import override_settings
from model_bakery import baker
from PIL import Image

from accounts.models import UserProfile
from places.models import Place, Visit, VisitItem


def make_exif_rotated_jpeg_bytes():
    buf = io.BytesIO()
    image = Image.new("RGB", (40, 20), color=(0, 128, 255))
    exif = image.getexif()
    exif[274] = 6
    image.save(buf, format="JPEG", exif=exif)
    buf.seek(0)
    return buf.read()


def save_raw_media(path: str, data: bytes) -> str:
    return default_storage.save(path, ContentFile(data))


def assert_oriented(path: str):
    with default_storage.open(path, "rb") as stored_file:
        stored = stored_file.read()

    with Image.open(io.BytesIO(stored)) as image:
        assert image.size == (20, 40)
        assert image.getexif().get(274) in (None, 1)


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
def test_normalize_media_orientation_rewrites_all_media_types(
    tmp_path, settings, django_user_model
):
    settings.MEDIA_ROOT = str(tmp_path)
    raw = make_exif_rotated_jpeg_bytes()

    user = baker.make(django_user_model)

    profile = UserProfile.objects.create(user=user)
    profile_path = save_raw_media(f"users/{user.id}/profiles/profile.jpg", raw)
    profile.profile_photo = profile_path
    profile.save(update_fields=["profile_photo"])

    place = baker.make(Place, user=user)
    cover_path = save_raw_media(f"users/{user.id}/places/covers/place.jpg", raw)
    place.cover_photo = cover_path
    place.save(update_fields=["cover_photo"])

    visit = baker.make(Visit, place=place)
    visit_path = save_raw_media(f"users/{user.id}/visits/photos/visit.jpg", raw)
    visit.photo = ""
    visit.photo_path = visit_path
    visit.save(update_fields=["photo", "photo_path"])

    item = baker.make(VisitItem, visit=visit)
    item_path = save_raw_media(f"users/{user.id}/visit_items/photos/item.jpg", raw)
    item.photo = ""
    item.photo_path = item_path
    item.save(update_fields=["photo", "photo_path"])

    out = io.StringIO()
    call_command("normalize_media_orientation", stdout=out)

    assert_oriented(profile_path)
    assert_oriented(cover_path)
    assert_oriented(visit_path)
    assert_oriented(item_path)
    assert "'rewritten': 4" in out.getvalue()
