import secrets
from decimal import Decimal

from django.conf import settings
from django.contrib.postgres.indexes import GinIndex
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _
from simple_history.models import HistoricalRecords

from core.models import BaseModel

from .managers import (
    CollectionQuerySet,
    PlaceQuerySet,
    VisitItemQuerySet,
    VisitQuerySet,
)


class PlaceStatus(models.TextChoices):
    WANT_TO_VISIT = "want_to_visit", _("Want to visit")
    VISITED = "visited", _("Visited")
    FAVORITE = "favorite", _("Favorite")
    WOULD_NOT_RETURN = "would_not_return", _("Would not return")


class CoordsStatus(models.TextChoices):
    PENDING = "pending", _("Pending")
    RESOLVED = "resolved", _("Resolved")
    FAILED = "failed", _("Failed")


class VisitItemType(models.TextChoices):
    SWEET = "sweet", _("Sweet")
    SAVORY = "savory", _("Savory")
    DRINK = "drink", _("Drink")
    COFFEE = "coffee", _("Coffee")
    JUICE = "juice", _("Juice")
    DESSERT = "dessert", _("Dessert")
    OTHER = "other", _("Other")


class Place(BaseModel):
    objects = PlaceQuerySet.as_manager()
    history = HistoricalRecords()

    deleted_at = models.DateTimeField(
        null=True, blank=True, verbose_name="deleted at", db_column="deleted_at"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="places",
        verbose_name="user",
        db_column="user_id",
    )
    name = models.CharField(max_length=200, verbose_name="name", db_column="name")
    category = models.CharField(
        max_length=100, verbose_name="category", db_column="category"
    )
    address = models.CharField(
        max_length=300, blank=True, verbose_name="address", db_column="address"
    )
    instagram_url = models.URLField(
        blank=True, verbose_name="instagram url", db_column="instagram_url"
    )
    maps_url = models.URLField(
        blank=True, max_length=2000, verbose_name="maps url", db_column="maps_url"
    )
    coords_status = models.CharField(
        max_length=10,
        choices=CoordsStatus.choices,
        default=CoordsStatus.RESOLVED,
        verbose_name="coords status",
        db_column="coords_status",
    )
    latitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        blank=True,
        null=True,
        verbose_name="latitude",
        db_column="latitude",
    )
    longitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        blank=True,
        null=True,
        verbose_name="longitude",
        db_column="longitude",
    )
    status = models.CharField(
        max_length=32,
        choices=PlaceStatus.choices,
        default=PlaceStatus.WANT_TO_VISIT,
        verbose_name="status",
        db_column="status",
    )
    notes = models.TextField(blank=True, verbose_name="notes", db_column="notes")
    cover_photo = models.ImageField(
        upload_to="places/covers/",
        blank=True,
        null=True,
        verbose_name="cover photo",
        db_column="cover_photo",
    )

    class Meta:
        db_table = "places_place"
        ordering = ("-created_at",)
        verbose_name = "place"
        verbose_name_plural = "places"
        indexes = [
            models.Index(fields=["user", "status"], name="place_user_status_idx"),
            models.Index(fields=["user", "category"], name="place_user_category_idx"),
            models.Index(
                fields=["user", "deleted_at"], name="place_user_deleted_at_idx"
            ),
            GinIndex(
                fields=["name"], name="place_name_trgm_idx", opclasses=["gin_trgm_ops"]
            ),
            GinIndex(
                fields=["category"],
                name="place_category_trgm_idx",
                opclasses=["gin_trgm_ops"],
            ),
            GinIndex(
                fields=["address"],
                name="place_address_trgm_idx",
                opclasses=["gin_trgm_ops"],
            ),
        ]

    def __str__(self) -> str:
        return self.name


class Visit(BaseModel):
    objects = VisitQuerySet.as_manager()
    history = HistoricalRecords()

    deleted_at = models.DateTimeField(
        null=True, blank=True, verbose_name="deleted at", db_column="deleted_at"
    )
    place = models.ForeignKey(
        Place,
        on_delete=models.CASCADE,
        related_name="visits",
        verbose_name="place",
        db_column="place_id",
    )
    visited_at = models.DateTimeField(
        verbose_name="visited at", db_column="visited_at", db_index=True
    )
    environment_rating = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("10"))],
        verbose_name="environment rating",
        db_column="environment_rating",
        null=True,
        blank=True,
    )
    service_rating = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("10"))],
        verbose_name="service rating",
        db_column="service_rating",
        null=True,
        blank=True,
    )
    overall_rating = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("10"))],
        verbose_name="overall rating",
        db_column="overall_rating",
        null=True,
        blank=True,
    )
    would_return = models.BooleanField(
        default=True, verbose_name="would return", db_column="would_return"
    )
    general_notes = models.TextField(
        blank=True, verbose_name="general notes", db_column="general_notes"
    )
    photo = models.ImageField(
        upload_to="visits/photos/",
        blank=True,
        null=True,
        verbose_name="photo",
        db_column="photo",
    )
    photo_path = models.CharField(
        max_length=500, blank=True, verbose_name="photo path", db_column="photo_path"
    )

    class Meta:
        db_table = "places_visit"
        ordering = ("-visited_at",)
        verbose_name = "visit"
        verbose_name_plural = "visits"
        indexes = [
            models.Index(
                fields=["place", "visited_at"], name="visit_place_visited_idx"
            ),
            models.Index(
                fields=["place", "overall_rating"], name="visit_place_rating_idx"
            ),
            models.Index(
                fields=["place", "deleted_at"], name="visit_place_deleted_at_idx"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.place.name} @ {self.visited_at:%Y-%m-%d}"


class VisitItem(BaseModel):
    objects = VisitItemQuerySet.as_manager()
    history = HistoricalRecords()

    deleted_at = models.DateTimeField(
        null=True, blank=True, verbose_name="deleted at", db_column="deleted_at"
    )
    visit = models.ForeignKey(
        Visit,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="visit",
        db_column="visit_id",
    )
    name = models.CharField(max_length=200, verbose_name="name", db_column="name")
    type = models.CharField(
        max_length=32,
        choices=VisitItemType.choices,
        default=VisitItemType.OTHER,
        verbose_name="type",
        db_column="type",
    )
    rating = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("10"))],
        verbose_name="rating",
        db_column="rating",
        null=True,
        blank=True,
    )
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
        verbose_name="price",
        db_column="price",
        null=True,
        blank=True,
    )
    would_order_again = models.BooleanField(
        default=True, verbose_name="would order again", db_column="would_order_again"
    )
    notes = models.TextField(blank=True, verbose_name="notes", db_column="notes")
    photo = models.ImageField(
        upload_to="visit_items/photos/",
        blank=True,
        null=True,
        verbose_name="photo",
        db_column="photo",
    )
    photo_path = models.CharField(
        max_length=500, blank=True, verbose_name="photo path", db_column="photo_path"
    )

    class Meta:
        db_table = "places_visit_item"
        ordering = ("-created_at",)
        verbose_name = "visit item"
        verbose_name_plural = "visit items"
        indexes = [
            models.Index(fields=["visit", "type"], name="visititem_visit_type_idx"),
            models.Index(fields=["visit", "rating"], name="visititem_visit_rating_idx"),
            models.Index(
                fields=["visit", "deleted_at"], name="visititem_visit_deleted_at_idx"
            ),
        ]

    def __str__(self) -> str:
        return self.name


class Collection(BaseModel):
    objects = CollectionQuerySet.as_manager()

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="collections"
    )
    name = models.CharField(max_length=100)
    emoji = models.CharField(max_length=8, blank=True, default="📍")
    description = models.TextField(blank=True, default="")

    class Meta:
        db_table = "places_collection"
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return self.name


class CollectionPlace(models.Model):
    collection = models.ForeignKey(
        Collection, on_delete=models.CASCADE, related_name="collection_places"
    )
    place = models.ForeignKey(
        "Place", on_delete=models.CASCADE, related_name="collection_places"
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "places_collection_place"
        ordering = ["-added_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["collection", "place"], name="collection_place_unique"
            )
        ]


class PlaceShare(models.Model):
    # IMPORTANTE: passar a função sem chamar — secrets.token_urlsafe(32) chamaria uma vez
    # e todos os registros teriam o mesmo token.
    token = models.CharField(max_length=64, unique=True, default=secrets.token_urlsafe)
    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name="shares")
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="place_shares"
    )
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "places_place_share"
        indexes = [
            models.Index(fields=["token", "is_active"], name="share_token_active_idx"),
        ]

    def __str__(self) -> str:
        state = "ativo" if self.is_active else "inativo"
        return f"{self.place.name} share ({state}, {self.token[:8]})"


class CollectionShare(models.Model):
    token = models.CharField(max_length=64, unique=True, default=secrets.token_urlsafe)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="collection_shares",
    )
    source_collection = models.ForeignKey(
        Collection, on_delete=models.CASCADE, related_name="shares"
    )
    snapshot_name = models.CharField(max_length=100)
    snapshot_emoji = models.CharField(max_length=8, blank=True, default="📍")
    snapshot_description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "places_collection_share"
        indexes = [
            models.Index(
                fields=["token", "is_active"], name="colshare_token_active_idx"
            ),
        ]

    def __str__(self) -> str:
        collection_name = (
            self.source_collection.name if self.source_collection_id else "collection"
        )
        state = "ativo" if self.is_active else "rascunho"
        return f"{collection_name} share ({state}, {self.token[:8]})"


class CollectionSharePlaceSnapshot(models.Model):
    share = models.ForeignKey(
        CollectionShare, on_delete=models.CASCADE, related_name="place_snapshots"
    )
    source_place_public_id = models.UUIDField(db_index=True)
    name = models.CharField(max_length=2000)
    category = models.CharField(max_length=2000)
    address = models.CharField(max_length=2000, blank=True, default="")
    instagram_url = models.URLField(blank=True, default="", max_length=2000)
    maps_url = models.URLField(blank=True, default="", max_length=2000)
    coords_status = models.CharField(
        max_length=10,
        choices=CoordsStatus.choices,
        default=CoordsStatus.RESOLVED,
    )
    latitude = models.DecimalField(
        max_digits=10, decimal_places=7, blank=True, null=True
    )
    longitude = models.DecimalField(
        max_digits=10, decimal_places=7, blank=True, null=True
    )
    status = models.CharField(max_length=32, choices=PlaceStatus.choices)
    notes = models.TextField(blank=True, default="")
    source_cover_photo_path = models.CharField(max_length=2000, blank=True, default="")
    cover_photo_path = models.CharField(max_length=2000, blank=True, default="")
    order_index = models.PositiveIntegerField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "places_collection_share_place_snapshot"
        ordering = ["order_index", "created_at"]
        indexes = [
            models.Index(
                fields=["share", "order_index"], name="colshare_snapshot_order_idx"
            ),
        ]

    def __str__(self) -> str:
        collection_name = (
            self.share.source_collection.name if self.share_id else "share"
        )
        return f"{collection_name}: {self.name} [{self.category}]"
