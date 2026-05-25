from django.utils import timezone
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from core.views import MutationMixin

from .models import Notification
from .serializers import NotificationSerializer
from .service import NotificationService


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Notification.objects.filter(
            user=self.request.user,
            read_at__isnull=True,
            expires_at__gt=timezone.now(),
        )


class NotificationMarkReadView(MutationMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, public_id):
        found = NotificationService.mark_read(public_id, request.user)
        if not found:
            return Response({"detail": "Notificação não encontrada."}, status=404)
        return Response({"detail": "Marcada como lida."})


class NotificationMarkAllReadView(MutationMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        NotificationService.mark_all_read(request.user)
        return Response({"detail": "Todas marcadas como lidas."})
