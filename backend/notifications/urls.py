from django.urls import path

from .views import (
    NotificationListView,
    NotificationMarkAllReadView,
    NotificationMarkReadView,
)

urlpatterns = [
    path("", NotificationListView.as_view()),
    path("read-all/", NotificationMarkAllReadView.as_view()),
    path("<uuid:public_id>/read/", NotificationMarkReadView.as_view()),
]
