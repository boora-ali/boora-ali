from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from enum import Enum

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone

from core.image_service import ImageService

from .models import Place, PlaceShare, PlaceStatus


class PlaceShareImportStatus(str, Enum):
    OWNER = "owner"
    DUPLICATE = "duplicate"
    IMPORTED = "created"


@dataclass(frozen=True)
class PlaceShareImportOutcome:
    status: PlaceShareImportStatus
    imported_place: Place | None = None


class PlaceLifecycleService:
    @staticmethod
    def save_deleted_at_with_history(queryset, deleted_at):
        model = queryset.model
        HistoricalRecord = model.history.model

        instances = list(queryset.select_for_update())
        if not instances:
            return

        queryset.update(deleted_at=deleted_at)

        now = timezone.now()
        history_records = []
        for instance in instances:
            fields = {
                field.attname: getattr(instance, field.attname)
                for field in model._meta.concrete_fields
            }
            fields["deleted_at"] = deleted_at
            history_records.append(
                HistoricalRecord(
                    **fields,
                    history_date=now,
                    history_type="~",
                    history_user=None,
                    history_change_reason=None,
                )
            )
        HistoricalRecord.objects.bulk_create(history_records)

    @staticmethod
    def soft_delete_place(place: Place) -> None:
        from .models import Visit, VisitItem

        now = timezone.now()
        with transaction.atomic():
            PlaceLifecycleService.save_deleted_at_with_history(
                VisitItem.objects.filter(visit__place=place, deleted_at__isnull=True),
                now,
            )
            PlaceLifecycleService.save_deleted_at_with_history(
                Visit.objects.filter(place=place, deleted_at__isnull=True),
                now,
            )
            place.deleted_at = now
            place.save(update_fields=["deleted_at"])

    @staticmethod
    def retry_coords_resolution(place) -> None:
        """Marca coordenadas como pendentes e enfileira resolução."""
        from .models import CoordsStatus
        from .tasks import resolve_place_coords

        place.coords_status = CoordsStatus.PENDING
        place.save(update_fields=["coords_status"])
        transaction.on_commit(lambda: resolve_place_coords.delay(place.pk))

    @staticmethod
    def soft_delete_visit(visit) -> None:
        """Soft-delete de Visit e seus VisitItems com histórico."""
        from .models import VisitItem

        now = timezone.now()
        with transaction.atomic():
            PlaceLifecycleService.save_deleted_at_with_history(
                VisitItem.objects.filter(visit=visit, deleted_at__isnull=True),
                now,
            )
            visit.deleted_at = now
            visit.save(update_fields=["deleted_at"])

    @staticmethod
    def restore_place(place: Place) -> None:
        from .models import Visit, VisitItem

        with transaction.atomic():
            place.deleted_at = None
            place.save(update_fields=["deleted_at"])
            PlaceLifecycleService.save_deleted_at_with_history(
                Visit.objects.filter(place=place),
                None,
            )
            PlaceLifecycleService.save_deleted_at_with_history(
                VisitItem.objects.filter(visit__place=place),
                None,
            )


class PlaceShareService:
    @staticmethod
    def detect_content_type(data: bytes) -> str:
        return ImageService.detect_content_type(data)

    @staticmethod
    def build_share_url(token: str) -> str:
        return f"{settings.PUBLIC_BASE_URL}/share/{token}"

    @staticmethod
    def build_share_media_url(
        share_token: str, image_path: str, ttl: int = 3600
    ) -> str:
        exp = int(time.time()) + ttl
        msg = json.dumps([share_token, image_path, exp], separators=(",", ":")).encode()
        sig = hmac.new(
            settings.MEDIA_ENCRYPTION_KEY.encode(), msg, hashlib.sha256
        ).hexdigest()
        return (
            f"{settings.PUBLIC_BASE_URL}/api/share/{share_token}/media/"
            f"{image_path}?sig={sig}&exp={exp}"
        )

    @staticmethod
    def get_active_share(token: str) -> PlaceShare:
        return get_object_or_404(
            PlaceShare.objects.select_related("place", "owner"),
            token=token,
            is_active=True,
        )

    @staticmethod
    def get_share_detail(token: str) -> dict:
        share = PlaceShareService.get_active_share(token)
        place = share.place
        image_url = (
            PlaceShareService.build_share_media_url(token, str(place.cover_photo))
            if place.cover_photo
            else None
        )
        return {
            "name": place.name,
            "category": place.category,
            "address": place.address,
            "instagram_url": place.instagram_url,
            "maps_url": place.maps_url,
            "latitude": place.latitude,
            "longitude": place.longitude,
            "cover_photo_url": image_url,
        }

    @staticmethod
    def validate_share_media_request(token: str, path: str, sig: str, exp: int) -> None:
        if time.time() > exp:
            raise LookupError("expired")

        msg = json.dumps([token, path, exp], separators=(",", ":")).encode()
        expected = hmac.new(
            settings.MEDIA_ENCRYPTION_KEY.encode(),
            msg,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(sig, expected):
            raise LookupError("invalid signature")

    @staticmethod
    def get_share_media_bytes(token: str, path: str, sig: str, exp: int) -> bytes:
        PlaceShareService.validate_share_media_request(token, path, sig, exp)
        share = PlaceShareService.get_active_share(token)
        if str(share.place.cover_photo) != path:
            raise LookupError("path mismatch")

        raw = default_storage.open(str(share.place.cover_photo)).read()
        if PlaceShareService.detect_content_type(raw) == "application/octet-stream":
            return ImageService.decrypt(raw, user_id=share.owner.pk)
        return raw

    @staticmethod
    def import_shared_place_photo(
        source_place_pk: int,
        source_owner_pk: int,
        target_place_pk: int,
        target_owner_pk: int,
    ) -> bool:
        source_place = Place.objects.filter(pk=source_place_pk).first()
        if not source_place or not source_place.cover_photo:
            return False

        target_place = Place.objects.filter(pk=target_place_pk).first()
        if not target_place:
            return False

        raw = default_storage.open(str(source_place.cover_photo)).read()
        if PlaceShareService.detect_content_type(raw) == "application/octet-stream":
            raw = ImageService.decrypt(raw, user_id=source_owner_pk)
        path = ImageService.save(
            ContentFile(raw), user_id=target_owner_pk, category="places/covers"
        )
        target_place.cover_photo = path
        target_place.save(update_fields=["cover_photo"])
        return True

    @staticmethod
    def revoke_share(share) -> None:
        """Revoga um share de lugar desativando-o."""
        share.is_active = False
        share.save(update_fields=["is_active"])

    @staticmethod
    def get_or_create_share(place: Place, owner):
        return PlaceShare.objects.get_or_create(
            place=place, owner=owner, is_active=True
        )

    @staticmethod
    def import_shared_place(token: str, target_user) -> PlaceShareImportOutcome:
        share = PlaceShareService.get_active_share(token)
        if share.owner == target_user:
            return PlaceShareImportOutcome(status=PlaceShareImportStatus.OWNER)

        place = share.place

        try:
            imported, created = Place.objects.get_or_create(
                user=target_user,
                name=place.name,
                address=place.address,
                defaults=PlaceShareService.create_import_defaults(place),
            )
        except IntegrityError:
            return PlaceShareImportOutcome(status=PlaceShareImportStatus.DUPLICATE)

        if not created:
            return PlaceShareImportOutcome(status=PlaceShareImportStatus.DUPLICATE)

        if place.cover_photo:
            from .tasks import copy_shared_place_photo

            copy_shared_place_photo.delay(
                source_place_pk=place.pk,
                source_owner_pk=share.owner.pk,
                target_place_pk=imported.pk,
                target_owner_pk=target_user.pk,
            )

        return PlaceShareImportOutcome(
            status=PlaceShareImportStatus.IMPORTED, imported_place=imported
        )

    @staticmethod
    def create_import_defaults(place: Place) -> dict:
        return {
            "category": place.category,
            "instagram_url": place.instagram_url,
            "maps_url": place.maps_url,
            "latitude": place.latitude,
            "longitude": place.longitude,
            "coords_status": place.coords_status,
            "status": PlaceStatus.WANT_TO_VISIT,
            "notes": "",
        }
