from __future__ import annotations

import logging

from django.db import IntegrityError, transaction
from rest_framework import mixins, viewsets

from core import exceptions

logger = logging.getLogger(__name__)


class ActionParamsMixin:
    action_param_serializers: dict[str, type] = {}

    def get_action_serializer_class(self):
        return self.action_param_serializers.get(self.action)

    def validate_action_params(self, request):
        serializer_class = self.get_action_serializer_class()
        if serializer_class is None:
            raise AssertionError(
                f"{self.__class__.__name__} nao definiu action_param_serializers para '{self.action}'."
            )

        serializer = serializer_class(
            data=request.data, context=self.get_serializer_context()
        )
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data


class ViewSetBase(ActionParamsMixin, viewsets.ModelViewSet):
    serializer_action_classes: dict[str, type] = {}

    def get_serializer_class(self):
        serializer_class = self.serializer_action_classes.get(self.action)
        if serializer_class is not None:
            return serializer_class
        return super().get_serializer_class()

    def create(self, request, *args, **kwargs):
        with transaction.atomic():
            logger.info(
                "Creating %s by user=%s", self.queryset.model.__name__, request.user
            )
            return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        with transaction.atomic():
            lookup = kwargs.get(self.lookup_field, kwargs.get("pk"))
            logger.info(
                "Updating %s %s=%s by user=%s",
                self.queryset.model.__name__,
                self.lookup_field,
                lookup,
                request.user,
            )
            return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                lookup = kwargs.get(self.lookup_field, kwargs.get("pk"))
                logger.warning(
                    "Deleting %s %s=%s by user=%s",
                    self.queryset.model.__name__,
                    self.lookup_field,
                    lookup,
                    request.user,
                )
                return super().destroy(request, *args, **kwargs)
        except IntegrityError as error:
            logger.exception(
                "Integrity error while deleting %s: %s",
                self.queryset.model.__name__,
                error,
            )
            raise exceptions.ForeignKeyException from error


class WriteViewSetBase(
    ActionParamsMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    def update(self, request, *args, **kwargs):
        with transaction.atomic():
            lookup = kwargs.get(self.lookup_field, kwargs.get("pk"))
            logger.info(
                "Updating %s %s=%s by user=%s",
                self.queryset.model.__name__,
                self.lookup_field,
                lookup,
                request.user,
            )
            return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                lookup = kwargs.get(self.lookup_field, kwargs.get("pk"))
                logger.warning(
                    "Deleting %s %s=%s by user=%s",
                    self.queryset.model.__name__,
                    self.lookup_field,
                    lookup,
                    request.user,
                )
                return super().destroy(request, *args, **kwargs)
        except IntegrityError as error:
            logger.exception(
                "Integrity error while deleting %s: %s",
                self.queryset.model.__name__,
                error,
            )
            raise exceptions.ForeignKeyException from error
