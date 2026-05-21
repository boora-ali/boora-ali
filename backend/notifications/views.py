from django.utils import timezone
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from core.views import MutationMixin

from .models import Notification
from .serializers import NotificationSerializer


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
        notif = Notification.objects.filter(
            public_id=public_id,
            user=request.user,
            read_at__isnull=True,
        ).first()
        if not notif:
            return Response({"detail": "Notificação não encontrada."}, status=404)
        notif.read_at = timezone.now()
        notif.save(update_fields=["read_at"])
        return Response({"detail": "Marcada como lida."})


class NotificationMarkAllReadView(MutationMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(
            user=request.user,
            read_at__isnull=True,
        ).update(read_at=timezone.now())
        return Response({"detail": "Todas marcadas como lidas."})
