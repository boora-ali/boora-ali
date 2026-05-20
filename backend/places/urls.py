from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CollectionPlaceView, CollectionViewSet, PlaceViewSet, VisitItemViewSet, VisitViewSet

router = DefaultRouter()
router.register(r"places", PlaceViewSet, basename="place")
router.register(r"visits", VisitViewSet, basename="visit")
router.register(r"visit-items", VisitItemViewSet, basename="visit-item")
router.register(r"collections", CollectionViewSet, basename="collection")

urlpatterns = router.urls + [
    path(
        "collections/<collection_public_id>/places/<place_public_id>/",
        CollectionPlaceView.as_view(),
    ),
]
