import ipaddress
import math

from django.conf import settings
from django.core.cache import caches
from django.core.exceptions import ImproperlyConfigured
from rest_framework.exceptions import Throttled
from rest_framework.settings import api_settings
from rest_framework.throttling import ScopedRateThrottle

_DEFAULT_EXEMPT = ["127.0.0.1/32", "::1/128", "172.16.0.0/12", "192.168.0.0/16"]


def _exempt_networks():
    cidrs = getattr(settings, "THROTTLE_EXEMPT_CIDRS", _DEFAULT_EXEMPT)
    return [ipaddress.ip_network(c) for c in cidrs]


def _get_client_ip(request) -> str:
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        trusted = _exempt_networks()
        for ip_str in reversed([ip.strip() for ip in xff.split(",")]):
            try:
                ip = ipaddress.ip_address(ip_str)
                if not any(ip in net for net in trusted):
                    return ip_str
            except ValueError:
                continue
    return request.META.get("REMOTE_ADDR", "")


class CachedScopedRateThrottle(ScopedRateThrottle):
    def __init__(self):
        self.cache = caches["default"]

    def get_rate(self):
        if not getattr(self, "scope", None):
            msg = (
                "You must set either `.scope` or `.rate` for "
                f"'{self.__class__.__name__}' throttle"
            )
            raise ImproperlyConfigured(msg)

        try:
            return api_settings.DEFAULT_THROTTLE_RATES[self.scope]
        except KeyError as exc:
            msg = f"No default throttle rate set for '{self.scope}' scope"
            raise ImproperlyConfigured(msg) from exc

    def allow_request(self, request, view):
        ip_str = _get_client_ip(request)
        try:
            ip = ipaddress.ip_address(ip_str)
            if any(ip in net for net in _exempt_networks()):
                return True
        except ValueError:
            pass
        return super().allow_request(request, view)


class RateLimitHeadersMixin:
    def throttled(self, request, wait):
        self._throttle_wait_seconds = max(1, int(math.ceil(wait or 1)))
        raise Throttled(wait=wait)

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        if response.status_code == 429:
            wait = getattr(self, "_throttle_wait_seconds", 1)
            response["Retry-After"] = str(wait)
            response["X-RateLimit-Remaining"] = "0"
        return response
