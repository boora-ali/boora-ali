from rest_framework.routers import DefaultRouter

from .views import PlaceViewSet, VisitItemViewSet, VisitViewSet

router = DefaultRouter()
router.register(r"places", PlaceViewSet, basename="place")
router.register(r"visits", VisitViewSet, basename="visit")
router.register(r"visit-items", VisitItemViewSet, basename="visit-item")

urlpatterns = router.urls
