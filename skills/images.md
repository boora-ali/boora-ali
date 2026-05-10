# Backend: Image Service

## Regra

Nunca salvar imagem diretamente em ImageField. Todo upload passa por `ImageService`.

## core/image_service.py — esqueleto

```python
import hashlib
import time
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
import base64
from django.conf import settings

def _user_key(user_id: int) -> bytes:
    hkdf = HKDF(algorithm=hashes.SHA256(), length=32, salt=b"bora-ali-media-v1",
                info=str(user_id).encode())
    raw = hkdf.derive(settings.SECRET_KEY.encode())
    return base64.urlsafe_b64encode(raw)

class ImageService:
    @staticmethod
    def save(file, user_id: int, category: str) -> str:
        """Encrypts and stores file. Returns storage path."""
        data = file.read()
        sha = hashlib.sha256(data).hexdigest()[:16]
        ts = int(time.time() * 1000)
        path = f"users/{user_id}/{category}/{sha}_{ts}"
        fernet = Fernet(_user_key(user_id))
        encrypted = fernet.encrypt(data)
        # write encrypted to storage backend (S3/local)
        _write_to_storage(path, encrypted)
        return path

    @staticmethod
    def delete(path: str, user_id: int) -> None:
        _delete_from_storage(path)

    @staticmethod
    def read(path: str, user_id: int) -> tuple[bytes, str]:
        """Returns (decrypted_bytes, content_type)."""
        encrypted = _read_from_storage(path)
        fernet = Fernet(_user_key(user_id))
        data = fernet.decrypt(encrypted)
        content_type = _detect_content_type(data)
        return data, content_type
```

**Path de armazenamento**: `users/{user_id}/{category}/{sha256[:16]}_{timestamp_ms}` — sem extensão, não identificável.

**Categorias por model**:
- `UserProfile.profile_photo` → `profiles`
- `Place.cover_photo` → `places/covers`
- `Visit.photo` → `visits/photos`
- `VisitItem.photo` → `visit_items/photos`

## core/media_views.py — servir imagem autenticada

```python
from django.http import HttpResponse, Http404
from rest_framework_simplejwt.authentication import JWTAuthentication
from .image_service import ImageService

def serve_user_media(request, path):
    auth = JWTAuthentication()
    try:
        user, _ = auth.authenticate(request)
    except Exception:
        raise Http404

    # verifica que o path pertence ao usuário
    expected_prefix = f"users/{user.id}/"
    if not path.startswith(expected_prefix):
        raise Http404

    try:
        data, content_type = ImageService.read(path, user.id)
    except Exception:
        raise Http404

    return HttpResponse(data, content_type=content_type)
```

Rota: `path("api/media/<path:path>", serve_user_media)`

## Signals de cleanup

```python
# accounts/signals.py
from django.db.models.signals import post_delete
from .models import UserProfile
from core.image_service import ImageService

def cleanup_profile_photo(sender, instance, **kwargs):
    if instance.profile_photo:
        ImageService.delete(instance.profile_photo, instance.user_id)

post_delete.connect(cleanup_profile_photo, sender=UserProfile)
```

```python
# accounts/apps.py
class AccountsConfig(AppConfig):
    def ready(self):
        import accounts.signals  # noqa
```

Mesmo padrão para `places/signals.py` (Place, Visit, VisitItem).

## Serializer pattern para imagens

```python
class PlaceWriteSerializer(serializers.ModelSerializer):
    cover_photo = serializers.ImageField(write_only=True, required=False)

    def create(self, validated_data):
        photo_file = validated_data.pop("cover_photo", None)
        instance = super().create(validated_data)
        if photo_file:
            path = ImageService.save(photo_file, instance.user_id, "places/covers")
            instance.cover_photo = path
            instance.save(update_fields=["cover_photo"])
        return instance

    def update(self, instance, validated_data):
        photo_file = validated_data.pop("cover_photo", None)
        if photo_file:
            if instance.cover_photo:
                ImageService.delete(instance.cover_photo, instance.user_id)
            path = ImageService.save(photo_file, instance.user_id, "places/covers")
            validated_data["cover_photo"] = path
        return super().update(instance, validated_data)
```
