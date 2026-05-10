from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver

from core.image_service import ImageService

from .models import Place, Visit, VisitItem


def _delete_on_commit(path: str) -> None:
    if not path:
        return
    # on_commit ensures we only delete after the DB transaction commits —
    # prevents orphaned storage deletes if the transaction rolls back.
    transaction.on_commit(lambda: ImageService.delete(path))


@receiver(post_delete, sender=Place)
def cleanup_place_cover_photo(sender, instance, **kwargs):
    _delete_on_commit(instance.cover_photo.name if instance.cover_photo else "")


@receiver(post_delete, sender=Visit)
def cleanup_visit_photo(sender, instance, **kwargs):
    _delete_on_commit(
        instance.photo_path or (instance.photo.name if instance.photo else "")
    )


@receiver(post_delete, sender=VisitItem)
def cleanup_visit_item_photo(sender, instance, **kwargs):
    _delete_on_commit(
        instance.photo_path or (instance.photo.name if instance.photo else "")
    )
