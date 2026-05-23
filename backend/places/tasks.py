from __future__ import annotations

import logging
import urllib.request
from datetime import timedelta
from decimal import Decimal
from urllib.parse import urlparse

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .maps import extract_coords
from .models import CoordsStatus, Place

_log = logging.getLogger("places.tasks")

_ALLOWED_MAPS_HOSTS = {
    "maps.google.com",
    "maps.app.goo.gl",
    "goo.gl",
    "www.google.com",
    "maps.googleapis.com",
}


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
    return urllib.request.urlopen(url, timeout=timeout)  # nosec B310


def _resolve_place_coords(self, place_pk: int):
    place = Place.objects.filter(pk=place_pk).first()
    if place is None or place.coords_status != CoordsStatus.PENDING:
        return

    try:
        response = _safe_maps_urlopen(place.maps_url)
        lat, lng = extract_coords(response.url)
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


@shared_task(bind=True, max_retries=3)
def copy_shared_place_photo(
    self, source_place_pk, source_owner_pk, target_place_pk, target_owner_pk
):
    from django.core.files.base import ContentFile
    from django.core.files.storage import default_storage

    from core.image_service import ImageService
    from places.models import Place as PlaceModel

    try:
        source_place = PlaceModel.objects.get(pk=source_place_pk)
    except PlaceModel.DoesNotExist:
        return  # Place original removido — sem retry

    try:
        target_place = PlaceModel.objects.get(pk=target_place_pk)
    except PlaceModel.DoesNotExist:
        return  # Place importado deletado — sem retry

    if not source_place.cover_photo:
        return

    try:
        raw = default_storage.open(source_place.cover_photo).read()
        decrypted = ImageService.decrypt(raw, user_id=source_owner_pk)
        path = ImageService.save(
            ContentFile(decrypted), user_id=target_owner_pk, category="places/covers"
        )
        target_place.cover_photo = path
        target_place.save(update_fields=["cover_photo"])
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
