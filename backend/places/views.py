from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from core.views import MutationMixin
from core.viewsets import ViewSetBase, WriteViewSetBase

from .filters import PlaceFilter, VisitFilter, VisitItemFilter
from .models import (
    Collection,
    CollectionPlace,
    CoordsStatus,
    Place,
    PlaceShare,
    Visit,
    VisitItem,
)
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
from .services import PlaceLifecycleService, PlaceShareImportStatus, PlaceShareService
from .tasks import resolve_place_coords


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
        "create_visit": PlaceVisitParamsSerializer,
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
            # order_by explícito: annotate() com Avg pode perder Meta.ordering em alguns DBs
            return (
                queryset.with_avg_rating()
                .with_list_expansion(expand_param)
                .order_by("-created_at")
            )

        if self.action == "retrieve":
            return queryset.with_consumable_stats().with_detail_payload(
                self.request.query_params.get("expand")
            )

        return queryset

    def perform_destroy(self, instance):
        PlaceLifecycleService.soft_delete_place(instance)

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

        PlaceLifecycleService.retry_coords_resolution(place)
        return Response({"detail": "Resolução de coordenadas enfileirada."})

    @action(detail=False, methods=["get"], url_path="trash")
    def trash(self, request):
        qs = Place.objects.filter(user=request.user).deleted().order_by("-deleted_at")
        page = self.paginate_queryset(qs)
        serializer = PlaceListSerializer(page if page is not None else qs, many=True)
        return (
            self.get_paginated_response(serializer.data)
            if page is not None
            else Response(serializer.data)
        )

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, public_id=None):
        place = get_object_or_404(
            Place, public_id=public_id, user=request.user, deleted_at__isnull=False
        )
        PlaceLifecycleService.restore_place(place)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["delete"], url_path="permanent")
    def permanent_delete(self, request, public_id=None):
        place = get_object_or_404(
            Place, public_id=public_id, user=request.user, deleted_at__isnull=False
        )
        place.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="visits")
    def list_visits(self, request, public_id=None):
        place = self.get_object()
        queryset = (
            Visit.objects.for_user(request.user)
            .filter(place=place)
            .select_related("place")
        )
        page = self.paginate_queryset(queryset)
        serializer = VisitSummarySerializer(
            page if page is not None else queryset, many=True
        )
        return (
            self.get_paginated_response(serializer.data)
            if page is not None
            else Response(serializer.data)
        )

    @action(detail=True, methods=["post"], url_path="visits")
    def create_visit(self, request, public_id=None):
        place = self.get_object()
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
        PlaceLifecycleService.soft_delete_visit(instance)

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
        return (
            Collection.objects.for_user(self.request.user)
            .with_place_count()
            .with_places_prefetch()
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
class PlaceShareCreateView(MutationMixin, APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "share_create"

    def post(self, request, public_id):
        place = get_object_or_404(Place, public_id=public_id, user=request.user)
        share, _ = PlaceShareService.get_or_create_share(place, request.user)
        return Response(
            {
                "token": share.token,
                "url": PlaceShareService.build_share_url(share.token),
            },
            status=201,
        )


class PlaceShareRevokeView(MutationMixin, APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, public_id, token):
        share = get_object_or_404(
            PlaceShare, token=token, place__public_id=public_id, owner=request.user
        )
        PlaceShareService.revoke_share(share)
        return Response(status=204)


class PlaceShareDetailView(APIView):
    permission_classes = []

    def get(self, request, token):
        return Response(PlaceShareService.get_share_detail(token))


class PlaceShareMediaView(APIView):
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "share_media"

    def get(self, request, token, path):
        sig = request.query_params.get("sig", "")
        try:
            exp = int(request.query_params.get("exp", 0))
        except (ValueError, TypeError):
            return Response(status=404)
        try:
            image_data = PlaceShareService.get_share_media_bytes(token, path, sig, exp)
        except Exception:
            return Response(status=404)
        return HttpResponse(
            image_data, content_type=PlaceShareService.detect_content_type(image_data)
        )


class PlaceShareImportView(MutationMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, token):
        outcome = PlaceShareService.import_shared_place(token, request.user)
        if outcome.status == PlaceShareImportStatus.OWNER:
            return Response({"detail": "Você já é dono deste lugar."}, status=400)
        if outcome.status == PlaceShareImportStatus.DUPLICATE:
            return Response(
                {"detail": "Você já tem este lugar na sua lista."}, status=400
            )
        return Response(
            {"public_id": str(outcome.imported_place.public_id)}, status=201
        )
