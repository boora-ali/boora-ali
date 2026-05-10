from rest_framework import status
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    NotFound,
    PermissionDenied,
)

from core import messages


class ActionFailedException(APIException):
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_detail = messages.ACTION_FAILED
    default_code = "action_failed"

    def __init__(self, cause: str, status_code: int | None = None):
        if status_code is not None:
            self.status_code = status_code
        super().__init__(detail=self.default_detail % (cause,))


class PermissionNotAllowedException(PermissionDenied):
    default_detail = messages.PERMISSION_NOT_ALLOWED
    default_code = "permission_not_allowed"


class ForeignKeyException(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = messages.FOREIGN_KEY_EXCEPTION
    default_code = "foreign_key_exception"


class InvalidPasswordException(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = messages.INVALID_PASSWORD
    default_code = "invalid_password"


class InvalidCredentialsException(AuthenticationFailed):
    default_detail = messages.INVALID_CREDENTIALS
    default_code = "invalid_credentials"


class InvalidTokenException(AuthenticationFailed):
    default_detail = messages.INVALID_TOKEN
    default_code = "invalid_token"


class SessionExpiredException(AuthenticationFailed):
    default_detail = messages.SESSION_EXPIRED
    default_code = "session_expired"


class SessionInvalidatedException(AuthenticationFailed):
    default_detail = messages.SESSION_INVALIDATED
    default_code = "session_invalidated"


class SessionNotFoundException(AuthenticationFailed):
    default_detail = messages.SESSION_NOT_FOUND
    default_code = "session_not_found"


class UserNotFoundException(APIException):
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = messages.USER_NOT_FOUND
    default_code = "user_not_found"


class NoRecordFoundException(NotFound):
    default_detail = messages.NO_RECORD_FOUND
    default_code = "no_record_found"
