from core.throttles import CachedScopedRateThrottle
from core.throttles import RateLimitHeadersMixin as _RateLimitHeadersMixin

RateLimitHeadersMixin = _RateLimitHeadersMixin


class AuthRateThrottle(CachedScopedRateThrottle):
    scope = "auth"
