from django.urls import path

from .views import (
    GoogleLoginView,
    LogoutView,
    MeView,
    PasswordChangeView,
    RegisterView,
    TermsAcceptView,
    ThrottledLoginView,
    ThrottledRefreshView,
)

urlpatterns = [
    path("register/", RegisterView.as_view()),
    path("login/", ThrottledLoginView.as_view()),
    path("google/", GoogleLoginView.as_view()),
    path("refresh/", ThrottledRefreshView.as_view()),
    path("logout/", LogoutView.as_view()),
    path("me/", MeView.as_view()),
    path("password/", PasswordChangeView.as_view()),
    path("terms/accept/", TermsAcceptView.as_view()),
]
