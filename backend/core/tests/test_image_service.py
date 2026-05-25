import io
from types import SimpleNamespace

import pytest
from django.conf import settings
from django.test import override_settings

from core.image_service import ImageService


@pytest.fixture
def fake_image_bytes():
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color=(255, 0, 0)).save(buf, format="JPEG")
    buf.seek(0)
    return buf.read()


@pytest.fixture
def exif_rotated_jpeg_bytes():
    from PIL import Image

    buf = io.BytesIO()
    image = Image.new("RGB", (40, 20), color=(0, 128, 255))
    exif = image.getexif()
    exif[274] = 6  # Rotate 90 degrees clockwise when decoded respecting EXIF.
    image.save(buf, format="JPEG", exif=exif)
    buf.seek(0)
    return buf.read()


@pytest.mark.django_db
def test_make_path_format():
    path = ImageService.make_path(42, "places/covers", b"some-data")
    assert path.startswith("users/42/places/covers/")
    parts = path.split("/")[-1].split("_")
    assert len(parts) == 2
    assert len(parts[0]) == 16  # sha256[:16]
    assert len(parts[1]) == 16  # token_hex(8) = 16 hex chars


@pytest.mark.django_db
def test_different_content_different_path():
    p1 = ImageService.make_path(1, "cat", b"data-a")
    p2 = ImageService.make_path(1, "cat", b"data-b")
    assert p1.split("/")[-1][:16] != p2.split("/")[-1][:16]


@pytest.mark.django_db
@override_settings(SECRET_KEY="test-secret-key-long-enough-for-hkdf-derivation-1234")
def test_encrypt_decrypt_roundtrip():
    data = b"hello image bytes"
    encrypted = ImageService.encrypt(data, user_id=7)
    assert encrypted != data
    decrypted = ImageService.decrypt(encrypted, user_id=7)
    assert decrypted == data


@pytest.mark.django_db
@override_settings(SECRET_KEY="test-secret-key-long-enough-for-hkdf-derivation-1234")
def test_different_users_cannot_cross_decrypt():
    data = b"secret image"
    encrypted = ImageService.encrypt(data, user_id=1)
    from cryptography.fernet import InvalidToken

    with pytest.raises(InvalidToken):
        ImageService.decrypt(encrypted, user_id=2)


@pytest.mark.django_db
@override_settings(
    SECRET_KEY="legacy-secret-key-long-enough-for-existing-media-1234",
    MEDIA_ENCRYPTION_KEY="new-media-key-long-enough-for-new-media-1234",
)
def test_decrypt_keeps_secret_key_fallback_for_existing_media():
    data = b"legacy encrypted image"
    encrypted = ImageService._derive_key(7, settings.SECRET_KEY).encrypt(data)

    assert ImageService.decrypt(encrypted, user_id=7) == data


@pytest.mark.django_db
def test_decrypt_does_not_mask_unexpected_failures(monkeypatch):
    class BrokenFernet:
        def decrypt(self, data):
            raise RuntimeError("unexpected decrypt failure")

    monkeypatch.setattr(
        ImageService, "_media_key", staticmethod(lambda user_id: BrokenFernet())
    )

    with pytest.raises(RuntimeError, match="unexpected decrypt failure"):
        ImageService.decrypt(b"encrypted", user_id=7)


@pytest.mark.django_db
@override_settings(
    SECRET_KEY="test-secret-key-long-enough-for-hkdf-derivation-1234",
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    },
)
def test_save_returns_valid_path(tmp_path, settings, fake_image_bytes):
    settings.MEDIA_ROOT = str(tmp_path)
    f = io.BytesIO(fake_image_bytes)
    f.name = "photo.jpg"
    path = ImageService.save(f, user_id=5, category="places/covers")
    assert path.startswith("users/5/places/covers/")


@pytest.mark.django_db
@override_settings(
    SECRET_KEY="test-secret-key-long-enough-for-hkdf-derivation-1234",
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    },
)
def test_save_preserves_raw_bytes(tmp_path, settings, fake_image_bytes):
    settings.MEDIA_ROOT = str(tmp_path)
    f = io.BytesIO(fake_image_bytes)
    f.name = "photo.jpg"
    raw = f.getvalue()

    path = ImageService.save(f, user_id=5, category="places/covers")

    from django.core.files.storage import default_storage

    with default_storage.open(path, "rb") as stored_file:
        stored = stored_file.read()

    assert stored == raw


@pytest.mark.django_db
@override_settings(
    SECRET_KEY="test-secret-key-long-enough-for-hkdf-derivation-1234",
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    },
)
def test_optimize_bytes_applies_exif_orientation(exif_rotated_jpeg_bytes):
    optimized = ImageService.optimize_bytes(exif_rotated_jpeg_bytes)

    from PIL import Image

    with Image.open(io.BytesIO(optimized)) as image:
        assert image.size == (20, 40)
        assert image.getexif().get(274) in (None, 1)


@pytest.mark.django_db
@override_settings(
    SECRET_KEY="test-secret-key-long-enough-for-hkdf-derivation-1234",
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    },
)
def test_delete_removes_file(tmp_path, settings, fake_image_bytes):
    settings.MEDIA_ROOT = str(tmp_path)
    f = io.BytesIO(fake_image_bytes)
    f.name = "photo.jpg"
    path = ImageService.save(f, user_id=5, category="places/covers")
    from django.core.files.storage import default_storage

    assert default_storage.exists(path)
    ImageService.delete(path)
    assert not default_storage.exists(path)


@pytest.mark.django_db
def test_delete_empty_path_is_noop():
    ImageService.delete("")
    ImageService.delete(None)


@pytest.mark.django_db
@override_settings(
    SECRET_KEY="test-secret-key-long-enough-for-hkdf-derivation-1234",
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    },
)
def test_replace_media_field_replaces_old_file(tmp_path, settings, fake_image_bytes):
    settings.MEDIA_ROOT = str(tmp_path)

    current = io.BytesIO(fake_image_bytes)
    current.name = "current.jpg"
    old_path = ImageService.save(current, user_id=5, category="places/covers")

    instance = SimpleNamespace(
        photo=SimpleNamespace(name=old_path),
        photo_path=old_path,
    )

    replacement = io.BytesIO(fake_image_bytes)
    replacement.name = "replacement.jpg"

    new_path = ImageService.replace_media_field(
        instance,
        "photo",
        replacement,
        user_id=5,
        category="places/covers",
        path_field_name="photo_path",
    )

    from django.core.files.storage import default_storage

    assert new_path is not None
    assert instance.photo == new_path
    assert instance.photo_path == new_path
    assert not default_storage.exists(old_path)
    assert default_storage.exists(new_path)
