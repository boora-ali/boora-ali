from __future__ import annotations

import logging
import urllib.request
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from urllib.parse import urlparse

from celery import shared_task
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db.models import Q
from django.utils import timezone

from accounts.models import UserProfile
from core.image_service import ImageService

from .maps import extract_coords, extract_place_cid
from .models import CoordsStatus, Place, Visit, VisitItem
from .services import PlaceShareService

_log = logging.getLogger("places.tasks")
_MEDIA_COMPRESSION_WINDOW_DAYS = 1


@dataclass(frozen=True)
class MediaTarget:
    label: str
    user_id: int
    path: str


def _read_media_bytes(path: str) -> bytes:
    if hasattr(default_storage, "bucket"):
        return default_storage.bucket.Object(path).get()["Body"].read()
    with default_storage.open(path, "rb") as handle:
        return handle.read()


def _write_media_bytes(path: str, data: bytes, content_type: str) -> None:
    if hasattr(default_storage, "bucket"):
        default_storage.bucket.Object(path).put(Body=data, ContentType=content_type)
        return

    default_storage.delete(path)
    default_storage.save(path, ContentFile(data))


def _iter_recent_media_targets(cutoff):
    for user_id, path in UserProfile.history.filter(
        history_date__gte=cutoff
    ).values_list("user_id", "profile_photo"):
        if path:
            yield MediaTarget("accounts.UserProfile.profile_photo", user_id, str(path))

    recent_places = Place.objects.filter(
        Q(created_at__gte=cutoff) | Q(updated_at__gte=cutoff),
        cover_photo__isnull=False,
    ).values_list("user_id", "cover_photo")
    for user_id, path in recent_places:
        if path:
            yield MediaTarget("places.Place.cover_photo", user_id, str(path))

    recent_visits = Visit.objects.filter(
        Q(created_at__gte=cutoff) | Q(updated_at__gte=cutoff),
        photo__isnull=False,
    ).values_list("place__user_id", "photo", "photo_path")
    for user_id, path, path_fallback in recent_visits:
        resolved_path = path_fallback or path
        if resolved_path:
            yield MediaTarget("places.Visit.photo", user_id, str(resolved_path))

    recent_items = VisitItem.objects.filter(
        Q(created_at__gte=cutoff) | Q(updated_at__gte=cutoff),
        photo__isnull=False,
    ).values_list("visit__place__user_id", "photo", "photo_path")
    for user_id, path, path_fallback in recent_items:
        resolved_path = path_fallback or path
        if resolved_path:
            yield MediaTarget("places.VisitItem.photo", user_id, str(resolved_path))


def _compress_media_target(target: MediaTarget) -> bool:
    raw = _read_media_bytes(target.path)
    optimized = ImageService.optimize_bytes(raw)
    if optimized == raw:
        return False

    content_type = ImageService.detect_content_type(optimized)
    _write_media_bytes(target.path, optimized, content_type)
    _log.info(
        "compress_recent_media: rewrote %s user=%s path=%s size=%d->%d",
        target.label,
        target.user_id,
        target.path,
        len(raw),
        len(optimized),
    )
    return True


_ALLOWED_MAPS_HOSTS = {
    "maps.google.com",
    "maps.app.goo.gl",
    "goo.gl",
    "www.google.com",
    "maps.googleapis.com",
}


_BROWSER_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


def _safe_maps_urlopen(url: str, timeout: int = 5):
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise ValueError(f"URL scheme não permitido: {parsed.scheme!r}")
    host = parsed.hostname or ""
    if not any(
        host == allowed or host.endswith("." + allowed)
        for allowed in _ALLOWED_MAPS_HOSTS
    ):
        raise ValueError(f"Host não permitido para resolução de Maps: {host!r}")
    req = urllib.request.Request(url, headers={"User-Agent": _BROWSER_UA})  # nosec B310
    return urllib.request.urlopen(req, timeout=timeout)  # nosec B310


def _resolve_place_coords(self, place_pk: int):
    place = Place.objects.filter(pk=place_pk).first()
    if place is None or place.coords_status != CoordsStatus.PENDING:
        return

    try:
        response = _safe_maps_urlopen(place.maps_url)
        lat, lng = extract_coords(response.url)

        # Fallback: GPS-shared URLs (entry=gps) resolve without embedded coords.
        # Extract the CID from !1s0x<high>:0x<low> and re-fetch via ?cid= which
        # always redirects to a coordinate-bearing URL.
        if lat is None or lng is None:
            cid = extract_place_cid(response.url)
            if cid is not None:
                cid_url = f"https://maps.google.com/maps?cid={cid}"
                cid_response = _safe_maps_urlopen(cid_url)
                lat, lng = extract_coords(cid_response.url)

        if lat is None or lng is None:
            raise ValueError("Coordenadas não encontradas na URL do Maps")
    except Exception as exc:  # pragma: no cover - covered through retry tests
        if self.request.retries >= self.max_retries:
            place.coords_status = CoordsStatus.FAILED
            place.save(update_fields=["coords_status"])
            _log.error(
                "resolve_place_coords falhou após %d tentativas: place_pk=%s maps_url=%r exc=%s",
                self.max_retries + 1,
                place_pk,
                place.maps_url,
                exc,
            )
            return
        countdown = 60 * (2**self.request.retries)
        raise self.retry(exc=exc, countdown=countdown)

    place.latitude = Decimal(str(lat))
    place.longitude = Decimal(str(lng))
    place.coords_status = CoordsStatus.RESOLVED
    place.save(update_fields=["latitude", "longitude", "coords_status"])


@shared_task(bind=True, max_retries=3)
def resolve_place_coords(self, place_pk: int):
    return _resolve_place_coords(self, place_pk)


@shared_task
def purge_expired_trash():
    """Permanent delete de lugares na lixeira há mais de TRASH_RETENTION_DAYS dias."""
    cutoff = timezone.now() - timedelta(days=settings.TRASH_RETENTION_DAYS)

    expired = Place.objects.deleted().filter(deleted_at__lt=cutoff)

    count = expired.count()
    if count == 0:
        return {"deleted": 0}

    # Notificar por usuário antes de deletar
    from django.db.models import Count

    from notifications.models import NotificationType
    from notifications.service import notify

    by_user = expired.values("user").annotate(total=Count("id"))
    for row in by_user:
        from django.contrib.auth import get_user_model

        owner = get_user_model().objects.filter(pk=row["user"]).first()
        if owner:
            notify(
                user=owner,
                notification_type=NotificationType.TRASH_EXPIRY,
                title="Lugares excluídos permanentemente",
                body=f"{row['total']} lugar(es) da lixeira foram removidos permanentemente.",
            )

    # place.delete() individual — dispara post_delete signals (cleanup de storage em
    # Place, Visit e VisitItem). queryset.delete() pularia esses signals, vazando imagens.
    deleted_count = 0
    for place in expired.select_related().iterator():
        place.delete()
        deleted_count += 1

    _log.info(
        "purge_expired_trash: %d lugares permanentemente deletados (cutoff=%s)",
        deleted_count,
        cutoff.date(),
    )
    return {"deleted": deleted_count}


@shared_task
def compress_recent_media():
    """Comprime mídias alteradas nas últimas 24h em lote, fora do request."""
    cutoff = timezone.now() - timedelta(days=_MEDIA_COMPRESSION_WINDOW_DAYS)

    stats = {
        "scanned": 0,
        "compressed": 0,
        "skipped_unchanged": 0,
        "skipped_missing": 0,
        "skipped_invalid": 0,
    }
    seen_paths: set[str] = set()

    for target in _iter_recent_media_targets(cutoff):
        if target.path in seen_paths:
            continue
        seen_paths.add(target.path)
        stats["scanned"] += 1

        try:
            changed = _compress_media_target(target)
        except FileNotFoundError:
            stats["skipped_missing"] += 1
            continue
        except Exception as exc:
            _log.warning(
                "compress_recent_media: skipped %s user=%s path=%s err=%s",
                target.label,
                target.user_id,
                target.path,
                exc,
                exc_info=True,
            )
            stats["skipped_invalid"] += 1
            continue

        if changed:
            stats["compressed"] += 1
        else:
            stats["skipped_unchanged"] += 1

    _log.info("compress_recent_media: %s", stats)
    return stats


@shared_task(bind=True, max_retries=3)
def copy_shared_place_photo(
    self, source_place_pk, source_owner_pk, target_place_pk, target_owner_pk
):
    try:
        changed = PlaceShareService.import_shared_place_photo(
            source_place_pk=source_place_pk,
            source_owner_pk=source_owner_pk,
            target_place_pk=target_place_pk,
            target_owner_pk=target_owner_pk,
        )
        if not changed:
            return
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60 * (2**self.request.retries))


@shared_task
def cleanup_old_history():
    from .models import Visit, VisitItem

    cutoff = timezone.now() - timedelta(days=settings.HISTORY_RETENTION_DAYS)

    deleted = {
        "place": Place.history.filter(history_date__lt=cutoff).delete()[0],
        "visit": Visit.history.filter(history_date__lt=cutoff).delete()[0],
        "visit_item": VisitItem.history.filter(history_date__lt=cutoff).delete()[0],
    }

    _log.info("History cleanup complete: %s", deleted)
    return deleted
