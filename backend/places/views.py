import hashlib
import hmac
import time

from django.conf import settings
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Count, Prefetch
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.image_service import ImageService
from core.views import MutationMixin
from core.viewsets import ViewSetBase, WriteViewSetBase

from .filters import PlaceFilter, VisitFilter, VisitItemFilter
from .models import Collection, CollectionPlace, CoordsStatus, Place, PlaceShare, PlaceStatus, Visit, VisitItem
from .params_serializers import PlaceVisitParamsSerializer, VisitItemParamsSerializer
from .serializers import (
    CollectionDetailSerializer,
    CollectionSerializer,
    PlaceDetailSerializer,
    PlaceListSerializer,
    PlaceWriteSerializer,
    VisitDetailSerializer,
    VisitItemSerializer,
    VisitItemWriteSerializer,
    VisitSummarySerializer,
    VisitWriteSerializer,
)
from .tasks import resolve_place_coords

try:
    from .tasks import copy_shared_place_photo
except ImportError:  # pragma: no cover — added in Task 3
    copy_shared_place_photo = None  # type: ignore[assignment]


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


class PlaceViewSet(ViewSetBase):
    queryset = Place.objects.all()
    lookup_field = "public_id"
    filterset_class = PlaceFilter
    search_fields = ("name", "category", "address")
    ordering_fields = ("created_at", "updated_at", "name")
    serializer_class = PlaceListSerializer
    serializer_action_classes = {
        "create": PlaceWriteSerializer,
        "update": PlaceWriteSerializer,
        "partial_update": PlaceWriteSerializer,
        "retrieve": PlaceDetailSerializer,
    }
    action_param_serializers = {
        "visits": PlaceVisitParamsSerializer,
    }

    def _queue_coord_resolution(self, instance):
        if instance.coords_status == CoordsStatus.PENDING:
            transaction.on_commit(lambda: resolve_place_coords.delay(instance.pk))

    def perform_create(self, serializer):
        instance = serializer.save()
        self._queue_coord_resolution(instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        self._queue_coord_resolution(instance)

    def get_queryset(self):
        expand_param = self.request.query_params.get("expand")
        queryset = Place.objects.for_user(self.request.user)

        if self.action == "list":
            return queryset.with_avg_rating().with_list_expansion(expand_param)

        if self.action == "retrieve":
            return queryset.with_consumable_stats().with_detail_payload(
                self.request.query_params.get("expand")
            )

        return queryset

    def perform_destroy(self, instance):
        now = timezone.now()
        with transaction.atomic():
            save_deleted_at_with_history(
                VisitItem.objects.filter(
                    visit__place=instance, deleted_at__isnull=True
                ),
                now,
            )
            save_deleted_at_with_history(
                Visit.objects.filter(place=instance, deleted_at__isnull=True),
                now,
            )
            instance.deleted_at = now
            instance.save(update_fields=["deleted_at"])

    @action(detail=True, methods=["post"], url_path="retry-coords")
    def retry_coords(self, request, public_id=None):
        place = self.get_object()
        if not place.maps_url:
            return Response(
                {"detail": "Este lugar não possui maps_url."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if place.coords_status == CoordsStatus.RESOLVED:
            return Response(
                {"detail": "Coordenadas já resolvidas."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        place.coords_status = CoordsStatus.PENDING
        place.save(update_fields=["coords_status"])
        transaction.on_commit(lambda: resolve_place_coords.delay(place.pk))
        return Response({"detail": "Resolução de coordenadas enfileirada."})

    @action(detail=False, methods=["get"], url_path="trash")
    def trash(self, request):
        qs = Place.objects.filter(user=request.user).deleted().order_by("-deleted_at")
        page = self.paginate_queryset(qs)
        ser = PlaceListSerializer(page if page is not None else qs, many=True)
        return (
            self.get_paginated_response(ser.data)
            if page is not None
            else Response(ser.data)
        )

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, public_id=None):
        place = get_object_or_404(
            Place, public_id=public_id, user=request.user, deleted_at__isnull=False
        )
        with transaction.atomic():
            place.deleted_at = None
            place.save(update_fields=["deleted_at"])
            save_deleted_at_with_history(Visit.objects.filter(place=place), None)
            save_deleted_at_with_history(
                VisitItem.objects.filter(visit__place=place), None
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["delete"], url_path="permanent")
    def permanent_delete(self, request, public_id=None):
        place = get_object_or_404(
            Place, public_id=public_id, user=request.user, deleted_at__isnull=False
        )
        place.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get", "post"], url_path="visits")
    def visits(self, request, public_id=None):
        place = self.get_object()

        if request.method == "GET":
            qs = (
                Visit.objects.for_user(request.user)
                .filter(place=place)
                .select_related("place")
            )
            page = self.paginate_queryset(qs)
            ser = VisitSummarySerializer(page if page is not None else qs, many=True)
            return (
                self.get_paginated_response(ser.data)
                if page is not None
                else Response(ser.data)
            )

        serializer = self.get_action_serializer_class()(
            data=request.data,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        visit = serializer.save(place=place)
        return Response(
            VisitSummarySerializer(visit).data, status=status.HTTP_201_CREATED
        )


class VisitViewSet(WriteViewSetBase):
    queryset = Visit.objects.all()
    lookup_field = "public_id"
    serializer_class = VisitWriteSerializer
    serializer_action_classes = {
        "retrieve": VisitDetailSerializer,
    }
    filterset_class = VisitFilter
    action_param_serializers = {
        "add_item": VisitItemParamsSerializer,
    }

    def get_queryset(self):
        if self.action == "retrieve":
            return Visit.objects.for_user(self.request.user).with_detail_payload(
                self.request.query_params.get("expand")
            )

        return Visit.objects.for_user(self.request.user).with_expansion(
            self.request.query_params.get("expand")
        )

    def get_serializer_class(self):
        serializer_class = self.serializer_action_classes.get(self.action)
        if serializer_class is not None:
            return serializer_class
        return super().get_serializer_class()

    def perform_destroy(self, instance):
        now = timezone.now()
        with transaction.atomic():
            save_deleted_at_with_history(
                VisitItem.objects.filter(visit=instance, deleted_at__isnull=True),
                now,
            )
            instance.deleted_at = now
            instance.save(update_fields=["deleted_at"])

    @action(detail=True, methods=["post"], url_path="items")
    def add_item(self, request, public_id=None):
        visit = self.get_object()
        serializer = self.get_action_serializer_class()(
            data=request.data,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        item = serializer.save(visit=visit)
        return Response(VisitItemSerializer(item).data, status=status.HTTP_201_CREATED)


class CollectionViewSet(ViewSetBase):
    lookup_field = "public_id"
    queryset = Collection.objects.all()

    def get_queryset(self):
        qs = Collection.objects.filter(user=self.request.user)
        place_prefetch = Prefetch(
            "collection_places",
            queryset=CollectionPlace.objects.select_related("place").order_by(
                "-added_at"
            ),
        )
        return (
            qs.annotate(place_count=Count("collection_places"))
            .prefetch_related(place_prefetch)
            .order_by("-updated_at")
        )

    def get_serializer_class(self):
        if self.action == "retrieve":
            return CollectionDetailSerializer
        return CollectionSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class CollectionPlaceView(MutationMixin, APIView):
    """POST /collections/{public_id}/places/{place_public_id}/ — add
    DELETE /collections/{public_id}/places/{place_public_id}/ — remove"""

    def _get_collection_and_place(self, request, collection_public_id, place_public_id):
        collection = get_object_or_404(
            Collection, public_id=collection_public_id, user=request.user
        )
        place = get_object_or_404(Place, public_id=place_public_id, user=request.user)
        return collection, place

    def post(self, request, collection_public_id, place_public_id):
        collection, place = self._get_collection_and_place(
            request, collection_public_id, place_public_id
        )
        _, created = CollectionPlace.objects.get_or_create(
            collection=collection, place=place
        )
        return Response(status=201 if created else 200)

    def delete(self, request, collection_public_id, place_public_id):
        collection, place = self._get_collection_and_place(
            request, collection_public_id, place_public_id
        )
        CollectionPlace.objects.filter(collection=collection, place=place).delete()
        return Response(status=204)


class VisitItemViewSet(WriteViewSetBase):
    queryset = VisitItem.objects.all()
    lookup_field = "public_id"
    serializer_class = VisitItemWriteSerializer
    filterset_class = VisitItemFilter

    def get_queryset(self):
        return VisitItem.objects.for_user(self.request.user).with_expansion(
            self.request.query_params.get("expand")
        )

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at"])


# ---------------------------------------------------------------------------
# Share views
# ---------------------------------------------------------------------------


def _make_signed_media_url(share_token: str, image_path: str, ttl: int = 3600) -> str:
    exp = int(time.time()) + ttl
    msg = f"{share_token}:{image_path}:{exp}".encode()
    sig = hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()
    return f"{settings.PUBLIC_BASE_URL}/api/share/{share_token}/media/{image_path}?sig={sig}&exp={exp}"


class PlaceShareCreateView(MutationMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, public_id):
        place = get_object_or_404(Place, public_id=public_id, user=request.user)
        share = PlaceShare.objects.create(place=place, owner=request.user)
        return Response({"token": share.token, "url": f"{settings.PUBLIC_BASE_URL}/share/{share.token}"}, status=201)


class PlaceShareRevokeView(MutationMixin, APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, public_id, token):
        share = get_object_or_404(PlaceShare, token=token, place__public_id=public_id, owner=request.user)
        share.is_active = False
        share.save(update_fields=["is_active"])
        return Response(status=204)


class PlaceShareDetailView(APIView):
    permission_classes = []

    def get(self, request, token):
        share = get_object_or_404(
            PlaceShare.objects.select_related("place"),
            token=token,
            is_active=True,
        )
        place = share.place
        image_url = None
        if place.cover_photo:
            image_url = _make_signed_media_url(token, str(place.cover_photo))
        return Response({
            "name": place.name,
            "category": place.category,
            "address": place.address,
            "status": place.status,
            "instagram_url": place.instagram_url,
            "maps_url": place.maps_url,
            "latitude": place.latitude,
            "longitude": place.longitude,
            "cover_photo_url": image_url,
        })


class PlaceShareMediaView(APIView):
    permission_classes = []

    def get(self, request, token, path):
        sig = request.query_params.get("sig", "")
        try:
            exp = int(request.query_params.get("exp", 0))
        except (ValueError, TypeError):
            return Response(status=404)
        if time.time() > exp:
            return Response(status=404)
        expected = hmac.new(
            settings.SECRET_KEY.encode(),
            f"{token}:{path}:{exp}".encode(),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return Response(status=404)
        share = get_object_or_404(
            PlaceShare.objects.select_related("place", "owner"),
            token=token,
            is_active=True,
        )
        if str(share.place.cover_photo) != path:
            return Response(status=404)
        try:
            raw = default_storage.open(share.place.cover_photo).read()
            decrypted = ImageService.decrypt(raw, user_id=share.owner.pk)
        except Exception:
            return Response(status=404)
        return HttpResponse(decrypted, content_type=ImageService.detect_content_type(decrypted))


class PlaceShareImportView(MutationMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, token):
        share = get_object_or_404(
            PlaceShare.objects.select_related("place", "owner"),
            token=token,
            is_active=True,
        )
        if share.owner == request.user:
            return Response({"detail": "Você já é dono deste lugar."}, status=400)

        place = share.place

        already_imported = Place.objects.filter(
            user=request.user, name=place.name, address=place.address
        ).exists()
        if already_imported:
            return Response({"detail": "Você já tem este lugar na sua lista."}, status=400)

        imported = Place.objects.create(
            user=request.user,
            name=place.name,
            category=place.category,
            address=place.address,
            instagram_url=place.instagram_url,
            maps_url=place.maps_url,
            latitude=place.latitude,
            longitude=place.longitude,
            coords_status=place.coords_status,
            status=PlaceStatus.WANT_TO_VISIT,
            notes="",
        )

        if place.cover_photo and copy_shared_place_photo is not None:
            copy_shared_place_photo.delay(
                source_place_pk=place.pk,
                source_owner_pk=share.owner.pk,
                target_place_pk=imported.pk,
                target_owner_pk=request.user.pk,
            )

        return Response({"public_id": str(imported.public_id)}, status=201)
