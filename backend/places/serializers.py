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


class MediaWriteSerializerMixin:
    media_field_name: str
    media_storage_category: str
    media_path_field_name: str | None = None

    def _get_media_file(self, validated_data, default=serializers.empty):
        return validated_data.pop(self.media_field_name, default)

    def _persist_media(self, instance, media_file):
        from core.image_service import ImageService

        ImageService.replace_media_field(
            instance,
            self.media_field_name,
            media_file,
            _get_owner_id(self.context),
            self.media_storage_category,
            self.media_path_field_name,
        )
        update_fields = [self.media_field_name]
        if self.media_path_field_name:
            update_fields.append(self.media_path_field_name)
        instance.save(update_fields=update_fields)

    def _prepare_create_data(self, validated_data):
        return validated_data

    def _prepare_update_data(self, validated_data):
        return validated_data

    def create(self, validated_data):
        media_file = self._get_media_file(validated_data, default=None)
        instance = super().create(self._prepare_create_data(validated_data))
        if media_file is not None:
            self._persist_media(instance, media_file)
        return instance

    def update(self, instance, validated_data):
        media_file = self._get_media_file(validated_data)
        instance = super().update(instance, self._prepare_update_data(validated_data))
        if media_file is not serializers.empty:
            self._persist_media(instance, media_file)
        return instance


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


class VisitItemWriteSerializer(MediaWriteSerializerMixin, FlexFieldsModelSerializer):
    notes = serializers.CharField(required=False, allow_blank=True, max_length=5000)
    photo = serializers.ImageField(
        required=False, allow_null=True, validators=[validate_image_upload]
    )
    media_field_name = "photo"
    media_storage_category = "visit_items/photos"
    media_path_field_name = "photo_path"

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


class VisitWriteSerializer(MediaWriteSerializerMixin, FlexFieldsModelSerializer):
    general_notes = serializers.CharField(
        required=False, allow_blank=True, max_length=5000
    )
    photo = serializers.ImageField(
        required=False, allow_null=True, validators=[validate_image_upload]
    )
    media_field_name = "photo"
    media_storage_category = "visits/photos"
    media_path_field_name = "photo_path"

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


class PlaceListSerializer(FlexFieldsModelSerializer):
    cover_photo = serializers.SerializerMethodField()
    avg_rating = serializers.FloatField(read_only=True, default=None)

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
            "avg_rating",
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


class PlaceWriteSerializer(MediaWriteSerializerMixin, FlexFieldsModelSerializer):
    notes = serializers.CharField(required=False, allow_blank=True, max_length=5000)
    cover_photo = serializers.ImageField(
        required=False, allow_null=True, validators=[validate_image_upload]
    )
    media_field_name = "cover_photo"
    media_storage_category = "places/covers"

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

    def _prepare_create_data(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return self._sync_coords(validated_data)

    def _prepare_update_data(self, validated_data):
        return self._sync_coords(validated_data)


class CollectionSerializer(serializers.ModelSerializer):
    place_count = serializers.IntegerField(read_only=True, default=0)
    place_public_ids = serializers.SerializerMethodField()

    class Meta:
        model = Collection
        fields = [
            "public_id",
            "name",
            "emoji",
            "description",
            "place_count",
            "place_public_ids",
            "updated_at",
        ]
        read_only_fields = ["public_id", "updated_at"]

    def get_place_public_ids(self, obj):
        return [cp.place.public_id for cp in obj.collection_places.all()]


class CollectionDetailSerializer(CollectionSerializer):
    places = serializers.SerializerMethodField()

    class Meta(CollectionSerializer.Meta):
        fields = CollectionSerializer.Meta.fields + ["places"]

    def get_places(self, obj):
        # collection_places is prefetched in viewset get_queryset
        qs = [cp.place for cp in obj.collection_places.all()]
        return PlaceListSerializer(qs, many=True, context=self.context).data
