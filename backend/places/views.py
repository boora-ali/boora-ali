from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from core.viewsets import ViewSetBase, WriteViewSetBase

from .filters import PlaceFilter, VisitFilter, VisitItemFilter
from .models import CoordsStatus, Place, Visit, VisitItem
from .params_serializers import PlaceVisitParamsSerializer, VisitItemParamsSerializer
from .serializers import (
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
        queryset = Place.objects.for_user(self.request.user).select_related("user")

        if self.action == "list":
            return queryset.with_list_expansion(expand_param)

        if self.action == "retrieve":
            return queryset.with_consumable_stats().with_detail_payload(
                self.request.query_params.get("expand")
            )

        return queryset

    def perform_destroy(self, instance):
        now = timezone.now()
        with transaction.atomic():
            VisitItem.objects.filter(
                visit__place=instance, deleted_at__isnull=True
            ).update(deleted_at=now)
            Visit.objects.filter(place=instance, deleted_at__isnull=True).update(
                deleted_at=now
            )
            instance.deleted_at = now
            instance.save(update_fields=["deleted_at"])

    @action(detail=False, methods=["get"], url_path="trash")
    def trash(self, request):
        qs = (
            Place.objects.filter(user=request.user)
            .deleted()
            .order_by("-deleted_at")
            .select_related("user")
        )
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
            Visit.objects.filter(place=place).update(deleted_at=None)
            VisitItem.objects.filter(visit__place=place).update(deleted_at=None)
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
            VisitItem.objects.filter(visit=instance, deleted_at__isnull=True).update(
                deleted_at=now
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
