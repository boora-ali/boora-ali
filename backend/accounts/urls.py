from django.urls import path

from .views import (
    CookieTokenRefreshView,
    DataExportView,
    DeleteAccountView,
    GoogleLoginView,
    LogoutView,
    MeView,
    PasswordChangeView,
    RegisterView,
    ResendVerificationEmailView,
    TermsAcceptView,
    ThrottledLoginView,
    VerifyEmailView,
    WithdrawConsentView,
)

urlpatterns = [
    path("register/", RegisterView.as_view()),
    path("login/", ThrottledLoginView.as_view()),
    path("google/", GoogleLoginView.as_view()),
    path("refresh/", CookieTokenRefreshView.as_view()),
    path("logout/", LogoutView.as_view()),
    path("me/", MeView.as_view()),
    path("password/", PasswordChangeView.as_view()),
    path("terms/accept/", TermsAcceptView.as_view()),
    path("me/delete/", DeleteAccountView.as_view()),
    path("me/export/", DataExportView.as_view()),
    path("me/withdraw-consent/", WithdrawConsentView.as_view()),
    path("verify-email/", VerifyEmailView.as_view()),
    path("resend-verification/", ResendVerificationEmailView.as_view()),
]
