from django.conf import settings
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.permissions import IsAuthenticated

from config.admin_site import site as admin_site
from core.feedback import FeedbackSubmitView
from core.media_views import serve_user_media


def health(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("api/health/", health, name="health"),
    path("admin/", admin_site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/feedback/", FeedbackSubmitView.as_view(), name="feedback"),
    path("api/", include("places.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/media/<path:path>", serve_user_media, name="serve-user-media"),
]

# Documentação da API disponível apenas em DEBUG ou para usuários autenticados.
# Em produção, exige autenticação para evitar expor o contrato da API.
if settings.DEBUG:
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path(
            "api/docs/",
            SpectacularSwaggerView.as_view(url_name="schema"),
            name="swagger-ui",
        ),
    ]
else:
    urlpatterns += [
        path(
            "api/schema/",
            SpectacularAPIView.as_view(permission_classes=[IsAuthenticated]),
            name="schema",
        ),
        path(
            "api/docs/",
            SpectacularSwaggerView.as_view(
                url_name="schema", permission_classes=[IsAuthenticated]
            ),
            name="swagger-ui",
        ),
    ]
