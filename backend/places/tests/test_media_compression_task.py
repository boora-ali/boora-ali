import io

import pytest
from django.core.files.storage import default_storage
from django.test import override_settings
from model_bakery import baker
from PIL import Image

from core.image_service import ImageService
from places.tasks import compress_recent_media

pytestmark = pytest.mark.django_db


_STORAGE_SETTINGS = dict(
    SECRET_KEY="test-secret-key-long-enough-for-hkdf-derivation-1234",
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    },
)


def make_large_jpeg():
    buf = io.BytesIO()
    Image.new("RGB", (3200, 2400), color=(255, 128, 0)).save(
        buf, format="JPEG", quality=95
    )
    buf.seek(0)
    buf.name = "large.jpg"
    buf.content_type = "image/jpeg"
    buf.size = len(buf.getvalue())
    return buf


@override_settings(**_STORAGE_SETTINGS)
def test_compress_recent_media_rewrites_recent_place_cover_photo(
    tmp_path, settings, django_user_model
):
    settings.MEDIA_ROOT = str(tmp_path)
    user = baker.make(django_user_model)
    place = baker.make("places.Place", user=user)

    photo = make_large_jpeg()
    raw = photo.getvalue()
    path = ImageService.save(photo, user_id=user.id, category="places/covers")
    place.cover_photo = path
    place.save(update_fields=["cover_photo"])

    result = compress_recent_media()

    assert result["compressed"] == 1
    with default_storage.open(path, "rb") as stored_file:
        stored = stored_file.read()

    assert stored != raw
    with Image.open(io.BytesIO(stored)) as image:
        assert max(image.size) <= 1920
