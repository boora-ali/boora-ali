from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence

from rest_framework import status
from rest_framework.exceptions import APIException, ErrorDetail, ValidationError
from rest_framework.views import exception_handler

from core import messages

logger = logging.getLogger(__name__)


_STRINGIFY_DISPATCH: list[tuple] = [
    (ErrorDetail, str),
    (Mapping,     lambda mapping: {key: _stringify_detail(item) for key, item in mapping.items()}),
    (Sequence,    lambda seq: [str(item) for item in seq]),
]


def _stringify_detail(value):
    if isinstance(value, (str, bytes)):
        return value
    for type_, handler in _STRINGIFY_DISPATCH:
        if isinstance(value, type_):
            return handler(value)
    return str(value)


def _flatten_field_errors(data) -> dict[str, list[str]]:
    if not isinstance(data, Mapping):
        return {}

    field_errors: dict[str, list[str]] = {}
    for key, value in data.items():
        if key == "detail":
            continue

        normalized = _stringify_detail(value)
        if isinstance(normalized, list):
            field_errors[key] = [str(item) for item in normalized]
        elif isinstance(normalized, dict):
            nested_messages: list[str] = []
            for nested_value in normalized.values():
                if isinstance(nested_value, list):
                    nested_messages.extend(str(item) for item in nested_value)
                else:
                    nested_messages.append(str(nested_value))
            if nested_messages:
                field_errors[key] = nested_messages
        else:
            field_errors[key] = [str(normalized)]
    return field_errors


def _first_code_from_sequence(codes) -> str | None:
    return str(codes[0]) if codes else None


def _first_code_from_mapping(codes) -> str | None:
    for value in codes.values():
        if isinstance(value, str):
            return value
        if isinstance(value, Sequence) and value:
            return str(value[0])
    return None


_CODES_TYPE_DISPATCH: list[tuple] = [
    (str,      lambda code: code),
    (Sequence, _first_code_from_sequence),
    (Mapping,  _first_code_from_mapping),
]


def _normalize_code(exc: Exception) -> str:
    if isinstance(exc, ValidationError):
        return "validation_error"
    if not isinstance(exc, APIException):
        return "error"
    codes = exc.get_codes()
    for type_, handler in _CODES_TYPE_DISPATCH:
        if isinstance(codes, type_):
            result = handler(codes)
            if result is not None:
                return result
    return str(getattr(exc, "default_code", "api_error"))


def _message_from_mapping_with_detail(exc, data) -> str | None:
    if "detail" not in data:
        return None
    detail = _stringify_detail(data["detail"])
    return str(detail[0]) if isinstance(detail, list) else str(detail)


def _message_from_mapping(exc, data) -> str:
    field_errors = _flatten_field_errors(data)
    if field_errors:
        first_field = next(iter(field_errors.values()))
        if first_field:
            return str(first_field[0])
    return str(messages.VALIDATION_ERROR)


def _message_from_sequence(exc, data) -> str:
    return str(_stringify_detail(data[0]))


def _pick_message(exc: Exception, data) -> str:
    if isinstance(exc, ValidationError):
        return str(messages.VALIDATION_ERROR)
    if isinstance(data, Mapping):
        msg = _message_from_mapping_with_detail(exc, data)
        return msg if msg is not None else _message_from_mapping(exc, data)
    if isinstance(data, Sequence) and data and not isinstance(data, (str, bytes)):
        return _message_from_sequence(exc, data)
    return str(_stringify_detail(data))


def semantic_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return response

    raw_data = response.data
    message = _pick_message(exc, raw_data)
    field_errors = _flatten_field_errors(raw_data)
    code = _normalize_code(exc)

    response.data = {
        "code": code,
        "message": message,
        "detail": message,
        "field_errors": field_errors,
        "status_code": response.status_code,
    }

    request = context.get("request") if isinstance(context, Mapping) else None
    path = getattr(request, "path", None)
    if path:
        logger.info(
            "API error %s on %s: code=%s message=%s",
            response.status_code,
            path,
            code,
            message,
        )
    else:
        logger.info(
            "API error %s: code=%s message=%s", response.status_code, code, message
        )

    if response.status_code == status.HTTP_404_NOT_FOUND and code == "not_found":
        response.data["code"] = "no_record_found"
        response.data["message"] = str(messages.NO_RECORD_FOUND)
        response.data["detail"] = str(messages.NO_RECORD_FOUND)

    return response
