from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id", read_only=True)
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "type",
            "title",
            "body",
            "is_read",
            "read_at",
            "expires_at",
            "created_at",
        ]

    def get_is_read(self, obj):
        return obj.read_at is not None
