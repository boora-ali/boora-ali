import io

import pytest
from django.core.files.storage import default_storage
from django.test import override_settings
from model_bakery import baker
from PIL import Image

from core.image_service import ImageService


def make_jpeg_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (5, 5)).save(buf, format="JPEG")
    buf.seek(0)
    return buf.read()


_STORAGE_SETTINGS = dict(
    SECRET_KEY="test-secret-key-long-enough-for-hkdf-derivation-1234",
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    },
)


@pytest.mark.django_db(transaction=True)
@override_settings(**_STORAGE_SETTINGS)
def test_place_delete_removes_cover_photo(tmp_path, settings, django_user_model):
    settings.MEDIA_ROOT = str(tmp_path)
    user = baker.make(django_user_model)
    place = baker.make("places.Place", user=user)

    data = make_jpeg_bytes()
    path = ImageService.save(
        io.BytesIO(data), user_id=user.id, category="places/covers"
    )
    place.cover_photo = path
    place.save(update_fields=["cover_photo"])

    assert default_storage.exists(path)
    place.delete()
    assert not default_storage.exists(path)


@pytest.mark.django_db(transaction=True)
@override_settings(**_STORAGE_SETTINGS)
def test_visit_delete_removes_photo(tmp_path, settings, django_user_model):
    settings.MEDIA_ROOT = str(tmp_path)
    user = baker.make(django_user_model)
    place = baker.make("places.Place", user=user)
    visit = baker.make("places.Visit", place=place)

    data = make_jpeg_bytes()
    path = ImageService.save(
        io.BytesIO(data), user_id=user.id, category="visits/photos"
    )
    visit.photo = path
    visit.save(update_fields=["photo"])

    assert default_storage.exists(path)
    visit.delete()
    assert not default_storage.exists(path)


@pytest.mark.django_db(transaction=True)
@override_settings(**_STORAGE_SETTINGS)
def test_visit_item_delete_removes_photo(tmp_path, settings, django_user_model):
    settings.MEDIA_ROOT = str(tmp_path)
    user = baker.make(django_user_model)
    place = baker.make("places.Place", user=user)
    visit = baker.make("places.Visit", place=place)
    item = baker.make("places.VisitItem", visit=visit)

    data = make_jpeg_bytes()
    path = ImageService.save(
        io.BytesIO(data), user_id=user.id, category="visit_items/photos"
    )
    item.photo = path
    item.save(update_fields=["photo"])

    assert default_storage.exists(path)
    item.delete()
    assert not default_storage.exists(path)
