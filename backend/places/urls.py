from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CategoryViewSet,
    CollectionPlaceView,
    CollectionShareCreateView,
    CollectionShareDetailView,
    CollectionShareImportView,
    CollectionShareMediaView,
    CollectionShareRevokeView,
    CollectionViewSet,
    PlaceCategoryView,
    PlaceShareCreateView,
    PlaceShareDetailView,
    PlaceShareImportView,
    PlaceShareMediaView,
    PlaceShareRevokeView,
    PlaceViewSet,
    VisitItemViewSet,
    VisitViewSet,
)

router = DefaultRouter()
router.register(r"places", PlaceViewSet, basename="place")
router.register(r"visits", VisitViewSet, basename="visit")
router.register(r"visit-items", VisitItemViewSet, basename="visit-item")
router.register(r"collections", CollectionViewSet, basename="collection")
router.register(r"categories", CategoryViewSet, basename="category")

urlpatterns = router.urls + [
    path(
        "places/<place_public_id>/categories/<category_public_id>/",
        PlaceCategoryView.as_view(),
        name="place-category",
    ),
    path(
        "collections/<collection_public_id>/places/<place_public_id>/",
        CollectionPlaceView.as_view(),
        name="collection-place",
    ),
    path("collections/<uuid:public_id>/share/", CollectionShareCreateView.as_view()),
    path("share/collections/<str:token>/import/", CollectionShareImportView.as_view()),
    path(
        "collections/<uuid:public_id>/share/<str:token>/",
        CollectionShareRevokeView.as_view(),
    ),
    path("share/collections/<str:token>/", CollectionShareDetailView.as_view()),
    path(
        "share/collections/<str:token>/media/<path:path>",
        CollectionShareMediaView.as_view(),
    ),
    path("places/<uuid:public_id>/share/", PlaceShareCreateView.as_view()),
    path("places/<uuid:public_id>/share/<str:token>/", PlaceShareRevokeView.as_view()),
    path("share/<str:token>/", PlaceShareDetailView.as_view()),
    path("share/<str:token>/media/<path:path>", PlaceShareMediaView.as_view()),
    path("share/<str:token>/import/", PlaceShareImportView.as_view()),
]
