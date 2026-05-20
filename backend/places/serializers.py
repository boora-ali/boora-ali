from rest_flex_fields import FlexFieldsModelSerializer
from rest_framework import serializers

from core.storage_urls import build_public_media_url
from core.validators import (
    validate_google_maps_url,
    validate_image_upload,
    validate_safe_url,
)

from .maps import extract_coords
from .models import Collection, CoordsStatus, Place, Visit, VisitItem


def _get_owner_id(context) -> int:
    return context["request"].user.id


def _extract_coords(url: str) -> tuple[float, float] | tuple[None, None]:
    """Extract (lat, lng) from a Google Maps URL, or return (None, None)."""
    return extract_coords(url)


class VisitItemSerializer(FlexFieldsModelSerializer):
    photo = serializers.SerializerMethodField()

    def get_photo(self, obj):
        return build_public_media_url(obj.photo, self.context.get("request"))

    class Meta:
        model = VisitItem
        fields = (
            "public_id",
            "visit",
            "name",
            "type",
            "rating",
            "price",
            "would_order_again",
            "notes",
            "photo",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("public_id", "visit", "created_at", "updated_at")


class VisitItemWriteSerializer(FlexFieldsModelSerializer):
    notes = serializers.CharField(required=False, allow_blank=True, max_length=5000)
    photo = serializers.ImageField(
        required=False, allow_null=True, validators=[validate_image_upload]
    )

    class Meta:
        model = VisitItem
        fields = (
            "name",
            "type",
            "rating",
            "price",
            "would_order_again",
            "notes",
            "photo",
        )

    def _handle_photo(self, instance, photo_file):
        from core.image_service import ImageService

        old_path = instance.photo.name if instance.photo else None
        if old_path:
            ImageService.delete(old_path)
        if photo_file is None:
            instance.photo = None
        else:
            instance.photo = ImageService.save(
                photo_file, _get_owner_id(self.context), "visit_items/photos"
            )
            instance.photo_path = instance.photo
        instance.save(update_fields=["photo"])

    def create(self, validated_data):
        photo_file = validated_data.pop("photo", None)
        instance = super().create(validated_data)
        if photo_file:
            self._handle_photo(instance, photo_file)
        return instance

    def update(self, instance, validated_data):
        photo_file = validated_data.pop("photo", serializers.empty)
        instance = super().update(instance, validated_data)
        if photo_file is not serializers.empty:
            self._handle_photo(instance, photo_file)
        return instance


class VisitSummarySerializer(FlexFieldsModelSerializer):
    photo = serializers.SerializerMethodField()

    def get_photo(self, obj):
        return build_public_media_url(obj.photo, self.context.get("request"))

    class Meta:
        model = Visit
        fields = (
            "public_id",
            "place",
            "visited_at",
            "environment_rating",
            "service_rating",
            "overall_rating",
            "would_return",
            "general_notes",
            "photo",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "public_id",
            "place",
            "created_at",
            "updated_at",
        )
        expandable_fields = {
            "place": (
                "places.serializers.PlaceListSerializer",
                {"read_only": True},
            ),
            "items": (
                "places.serializers.VisitItemSerializer",
                {"many": True, "read_only": True},
            ),
        }


class VisitDetailSerializer(VisitSummarySerializer):
    items = VisitItemSerializer(many=True, read_only=True)

    class Meta(VisitSummarySerializer.Meta):
        fields = VisitSummarySerializer.Meta.fields + ("items",)
        read_only_fields = VisitSummarySerializer.Meta.read_only_fields + ("items",)


class VisitWriteSerializer(FlexFieldsModelSerializer):
    general_notes = serializers.CharField(
        required=False, allow_blank=True, max_length=5000
    )
    photo = serializers.ImageField(
        required=False, allow_null=True, validators=[validate_image_upload]
    )

    class Meta:
        model = Visit
        fields = (
            "public_id",
            "visited_at",
            "environment_rating",
            "service_rating",
            "overall_rating",
            "would_return",
            "general_notes",
            "photo",
        )
        read_only_fields = ("public_id",)

    def _handle_photo(self, instance, photo_file):
        from core.image_service import ImageService

        old_path = instance.photo.name if instance.photo else None
        if old_path:
            ImageService.delete(old_path)
        if photo_file is None:
            instance.photo = None
        else:
            instance.photo = ImageService.save(
                photo_file, _get_owner_id(self.context), "visits/photos"
            )
            instance.photo_path = instance.photo
        instance.save(update_fields=["photo"])

    def create(self, validated_data):
        photo_file = validated_data.pop("photo", None)
        instance = super().create(validated_data)
        if photo_file:
            self._handle_photo(instance, photo_file)
        return instance

    def update(self, instance, validated_data):
        photo_file = validated_data.pop("photo", serializers.empty)
        instance = super().update(instance, validated_data)
        if photo_file is not serializers.empty:
            self._handle_photo(instance, photo_file)
        return instance


class PlaceListSerializer(FlexFieldsModelSerializer):
    cover_photo = serializers.SerializerMethodField()

    def get_cover_photo(self, obj):
        return build_public_media_url(obj.cover_photo, self.context.get("request"))

    class Meta:
        model = Place
        fields = (
            "public_id",
            "name",
            "category",
            "address",
            "instagram_url",
            "maps_url",
            "coords_status",
            "latitude",
            "longitude",
            "status",
            "cover_photo",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("public_id", "created_at", "updated_at")
        expandable_fields = {
            "visits": (
                "places.serializers.VisitSummarySerializer",
                {"many": True, "read_only": True},
            ),
        }


class PlaceDetailSerializer(FlexFieldsModelSerializer):
    cover_photo = serializers.SerializerMethodField()
    visits = VisitSummarySerializer(many=True, read_only=True)
    consumables_count = serializers.IntegerField(read_only=True)
    average_consumable_rating = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        read_only=True,
        allow_null=True,
    )
    total_consumed_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
        allow_null=True,
    )

    def get_cover_photo(self, obj):
        return build_public_media_url(obj.cover_photo, self.context.get("request"))

    class Meta:
        model = Place
        fields = (
            "public_id",
            "name",
            "category",
            "address",
            "instagram_url",
            "maps_url",
            "coords_status",
            "latitude",
            "longitude",
            "status",
            "notes",
            "cover_photo",
            "visits",
            "consumables_count",
            "average_consumable_rating",
            "total_consumed_amount",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "public_id",
            "visits",
            "consumables_count",
            "average_consumable_rating",
            "total_consumed_amount",
            "created_at",
            "updated_at",
        )
        expandable_fields = {
            "visits": (
                "places.serializers.VisitSummarySerializer",
                {"many": True, "read_only": True},
            ),
        }


class PlaceWriteSerializer(FlexFieldsModelSerializer):
    notes = serializers.CharField(required=False, allow_blank=True, max_length=5000)
    cover_photo = serializers.ImageField(
        required=False, allow_null=True, validators=[validate_image_upload]
    )

    class Meta:
        model = Place
        fields = (
            "public_id",
            "name",
            "category",
            "address",
            "instagram_url",
            "maps_url",
            "coords_status",
            "latitude",
            "longitude",
            "status",
            "notes",
            "cover_photo",
        )
        read_only_fields = ("public_id", "coords_status")

    def validate_instagram_url(self, value):
        return validate_safe_url(value)

    def validate_maps_url(self, value):
        if not value:
            return value
        validate_safe_url(value)
        return validate_google_maps_url(value)

    def _sync_coords(self, validated_data: dict) -> dict:
        has_manual_coords = (
            validated_data.get("latitude") is not None
            and validated_data.get("longitude") is not None
        )
        if has_manual_coords:
            validated_data["coords_status"] = CoordsStatus.RESOLVED
            return validated_data

        maps_url = validated_data.get("maps_url", "")
        if maps_url:
            lat, lng = _extract_coords(maps_url)
            if lat is not None and lng is not None:
                validated_data["latitude"] = lat
                validated_data["longitude"] = lng
                validated_data["coords_status"] = CoordsStatus.RESOLVED
            else:
                validated_data["latitude"] = None
                validated_data["longitude"] = None
                validated_data["coords_status"] = CoordsStatus.PENDING
        elif "maps_url" in validated_data:
            validated_data["coords_status"] = CoordsStatus.RESOLVED
        return validated_data

    def _handle_photo(self, instance, photo_file):
        from core.image_service import ImageService

        old_path = instance.cover_photo.name if instance.cover_photo else None
        if old_path:
            ImageService.delete(old_path)
        if photo_file is None:
            instance.cover_photo = None
        else:
            instance.cover_photo = ImageService.save(
                photo_file, _get_owner_id(self.context), "places/covers"
            )
        instance.save(update_fields=["cover_photo"])

    def create(self, validated_data):
        from core.image_service import ImageService

        validated_data["user"] = self.context["request"].user
        photo_file = validated_data.pop("cover_photo", None)
        instance = super().create(self._sync_coords(validated_data))
        if photo_file:
            instance.cover_photo = ImageService.save(
                photo_file, instance.user_id, "places/covers"
            )
            instance.cover_photo_path = instance.cover_photo
            instance.save(update_fields=["cover_photo"])
        return instance

    def update(self, instance, validated_data):
        photo_file = validated_data.pop("cover_photo", serializers.empty)
        instance = super().update(instance, self._sync_coords(validated_data))
        if photo_file is not serializers.empty:
            self._handle_photo(instance, photo_file)
        return instance


class CollectionSerializer(serializers.ModelSerializer):
    place_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Collection
        fields = ["public_id", "name", "emoji", "description", "place_count", "updated_at"]
        read_only_fields = ["public_id", "updated_at"]


class CollectionDetailSerializer(CollectionSerializer):
    places = serializers.SerializerMethodField()

    class Meta(CollectionSerializer.Meta):
        fields = CollectionSerializer.Meta.fields + ["places"]

    def get_places(self, obj):
        # collection_places is prefetched in viewset get_queryset
        qs = [cp.place for cp in obj.collection_places.all()]
        return PlaceListSerializer(qs, many=True, context=self.context).data
