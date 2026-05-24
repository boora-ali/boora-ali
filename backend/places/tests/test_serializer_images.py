import io
from datetime import datetime, timezone

import pytest
from django.test import override_settings
from model_bakery import baker
from PIL import Image
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from places.serializers import (
    PlaceWriteSerializer,
    VisitItemWriteSerializer,
    VisitWriteSerializer,
)


def make_jpeg():
    buf = io.BytesIO()
    Image.new("RGB", (10, 10)).save(buf, format="JPEG")
    buf.seek(0)
    buf.name = "photo.jpg"
    buf.content_type = "image/jpeg"
    buf.size = len(buf.getvalue())
    return buf


def make_drf_request(factory_request, user):
    """Wrap factory request so FlexFields can call query_params."""
    drf_req = Request(factory_request)
    drf_req.user = user
    return drf_req


_STORAGE_SETTINGS = dict(
    SECRET_KEY="test-secret-key-long-enough-for-hkdf-derivation-1234",
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    },
)


# VisitItem


@pytest.mark.django_db
@override_settings(**_STORAGE_SETTINGS)
def test_visit_item_photo_saved_under_user_path(tmp_path, settings, django_user_model):
    settings.MEDIA_ROOT = str(tmp_path)
    user = baker.make(django_user_model)
    place = baker.make("places.Place", user=user)
    visit = baker.make("places.Visit", place=place)
    item = baker.make("places.VisitItem", visit=visit)

    factory = APIRequestFactory()
    request = make_drf_request(factory.patch("/"), user)

    s = VisitItemWriteSerializer(
        instance=item,
        data={"name": item.name, "photo": make_jpeg()},
        partial=True,
        context={"request": request},
    )
    assert s.is_valid(), s.errors
    s.save()

    item.refresh_from_db()
    assert item.photo.name.startswith(f"users/{user.id}/visit_items/photos/")


@pytest.mark.django_db
@override_settings(**_STORAGE_SETTINGS)
def test_visit_item_old_photo_deleted_on_update(tmp_path, settings, django_user_model):
    settings.MEDIA_ROOT = str(tmp_path)
    user = baker.make(django_user_model)
    place = baker.make("places.Place", user=user)
    visit = baker.make("places.Visit", place=place)
    item = baker.make("places.VisitItem", visit=visit)

    factory = APIRequestFactory()
    request = make_drf_request(factory.patch("/"), user)

    s1 = VisitItemWriteSerializer(
        instance=item,
        data={"name": item.name, "photo": make_jpeg()},
        partial=True,
        context={"request": request},
    )
    assert s1.is_valid()
    s1.save()
    item.refresh_from_db()
    old_path = item.photo.name

    from django.core.files.storage import default_storage

    assert default_storage.exists(old_path)

    s2 = VisitItemWriteSerializer(
        instance=item,
        data={"name": item.name, "photo": make_jpeg()},
        partial=True,
        context={"request": request},
    )
    assert s2.is_valid()
    s2.save()
    assert not default_storage.exists(old_path)


# Visit


@pytest.mark.django_db
@override_settings(**_STORAGE_SETTINGS)
def test_visit_photo_saved_under_user_path(tmp_path, settings, django_user_model):
    settings.MEDIA_ROOT = str(tmp_path)
    user = baker.make(django_user_model)
    place = baker.make("places.Place", user=user)
    visit = baker.make("places.Visit", place=place)

    factory = APIRequestFactory()
    request = make_drf_request(factory.patch("/"), user)

    ts = datetime.now(timezone.utc).isoformat()
    s = VisitWriteSerializer(
        instance=visit,
        data={"visited_at": ts, "photo": make_jpeg()},
        partial=True,
        context={"request": request},
    )
    assert s.is_valid(), s.errors
    s.save()

    visit.refresh_from_db()
    assert visit.photo.name.startswith(f"users/{user.id}/visits/photos/")


@pytest.mark.django_db
@override_settings(**_STORAGE_SETTINGS)
def test_visit_old_photo_deleted_on_update(tmp_path, settings, django_user_model):
    settings.MEDIA_ROOT = str(tmp_path)
    user = baker.make(django_user_model)
    place = baker.make("places.Place", user=user)
    visit = baker.make("places.Visit", place=place)

    factory = APIRequestFactory()
    request = make_drf_request(factory.patch("/"), user)

    ts = datetime.now(timezone.utc).isoformat()

    s1 = VisitWriteSerializer(
        instance=visit,
        data={"visited_at": ts, "photo": make_jpeg()},
        partial=True,
        context={"request": request},
    )
    assert s1.is_valid()
    s1.save()
    visit.refresh_from_db()
    old_path = visit.photo.name

    from django.core.files.storage import default_storage

    assert default_storage.exists(old_path)

    s2 = VisitWriteSerializer(
        instance=visit,
        data={"visited_at": ts, "photo": make_jpeg()},
        partial=True,
        context={"request": request},
    )
    assert s2.is_valid()
    s2.save()
    assert not default_storage.exists(old_path)


# Place


@pytest.mark.django_db
@override_settings(**_STORAGE_SETTINGS)
def test_place_cover_photo_saved_on_create(tmp_path, settings, django_user_model):
    settings.MEDIA_ROOT = str(tmp_path)
    user = baker.make(django_user_model)

    factory = APIRequestFactory()
    request = make_drf_request(factory.post("/"), user)

    s = PlaceWriteSerializer(
        data={
            "name": "Café X",
            "category": "café",
            "cover_photo": make_jpeg(),
        },
        context={"request": request},
    )
    assert s.is_valid(), s.errors
    place = s.save()

    assert place.cover_photo.name.startswith(f"users/{user.id}/places/covers/")
    assert s.data["cover_photo"].startswith("http://testserver/api/media/users/")


@pytest.mark.django_db
@override_settings(**_STORAGE_SETTINGS)
def test_place_old_cover_photo_deleted_on_update(tmp_path, settings, django_user_model):
    settings.MEDIA_ROOT = str(tmp_path)
    user = baker.make(django_user_model)
    place = baker.make("places.Place", user=user)

    factory = APIRequestFactory()
    request = make_drf_request(factory.patch("/"), user)

    s1 = PlaceWriteSerializer(
        instance=place,
        data={
            "name": place.name,
            "category": place.category,
            "cover_photo": make_jpeg(),
        },
        partial=True,
        context={"request": request},
    )
    assert s1.is_valid()
    s1.save()
    place.refresh_from_db()
    old_path = place.cover_photo.name

    from django.core.files.storage import default_storage

    assert default_storage.exists(old_path)

    s2 = PlaceWriteSerializer(
        instance=place,
        data={
            "name": place.name,
            "category": place.category,
            "cover_photo": make_jpeg(),
        },
        partial=True,
        context={"request": request},
    )
    assert s2.is_valid()
    s2.save()
    assert s2.data["cover_photo"].startswith("http://testserver/api/media/users/")
    assert not default_storage.exists(old_path)
