from django.utils.translation import gettext_lazy as _
from rest_framework import status
from rest_framework.exceptions import APIException, AuthenticationFailed


class GoogleOAuthClientIdNotConfiguredException(APIException):
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_detail = _("Google OAuth client id nao configurado.")
    default_code = "google_oauth_client_id_not_configured"


class GoogleIdentityTokenInvalidException(AuthenticationFailed):
    default_detail = _("Token do Google invalido.")
    default_code = "google_identity_token_invalid"


class GoogleIdentityEmailNotVerifiedException(AuthenticationFailed):
    default_detail = _("E-mail do Google nao verificado.")
    default_code = "google_identity_email_not_verified"


class GoogleIdentityEmailConflictException(AuthenticationFailed):
    default_detail = _("Ja existe mais de uma conta com este e-mail.")
    default_code = "google_identity_email_conflict"


class GoogleIdentityPasswordChangeNotAllowedException(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = _("Contas do Google nao podem trocar senha.")
    default_code = "google_identity_password_change_not_allowed"
