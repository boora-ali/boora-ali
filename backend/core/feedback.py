from __future__ import annotations

import html
import logging

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.throttles import CachedScopedRateThrottle, RateLimitHeadersMixin
from core.views import MutationMixin

try:
    import resend
except ModuleNotFoundError:  # pragma: no cover - optional integration
    resend = None

logger = logging.getLogger(__name__)
if resend is not None:
    resend.api_key = settings.RESEND_API_KEY


class FeedbackMessage(models.Model):
    KIND_SUGGESTION = "suggestion"
    KIND_BUG = "bug"
    KIND_CHOICES = (
        (KIND_SUGGESTION, _("Sugestão")),
        (KIND_BUG, _("Bug")),
    )

    kind = models.CharField(max_length=16, choices=KIND_CHOICES)
    message = models.TextField()
    page_url = models.URLField(blank=True, default="")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="feedback_messages",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at", "-id")


class FeedbackMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeedbackMessage
        fields = ("kind", "message", "page_url")


class FeedbackCreateSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=FeedbackMessage.KIND_CHOICES)
    message = serializers.CharField(max_length=2000, trim_whitespace=True)
    page_url = serializers.URLField(required=False, allow_blank=True)

    def validate_message(self, value: str) -> str:
        message = value.strip()
        if not message:
            raise serializers.ValidationError("Mensagem obrigatória.")
        return message


class FeedbackRateThrottle(CachedScopedRateThrottle):
    scope = "feedback"


class FeedbackService:
    @staticmethod
    def submit(*, kind: str, message: str, user=None, page_url: str = "") -> FeedbackMessage:
        feedback = FeedbackMessage.objects.create(
            kind=kind,
            message=message,
            page_url=page_url or "",
            user=user if getattr(user, "is_authenticated", False) else None,
        )
        FeedbackService.send_email(feedback)
        return feedback

    @staticmethod
    def send_email(feedback: FeedbackMessage) -> None:
        recipient = getattr(settings, "FEEDBACK_EMAIL_TO", "samuelviana.dev@gmail.com")
        subject = (
            "Nova sugestão — Boora Ali"
            if feedback.kind == FeedbackMessage.KIND_SUGGESTION
            else "Novo bug — Boora Ali"
        )
        lines = [f"Tipo: {feedback.get_kind_display()}", "", "Mensagem:", feedback.message]
        if feedback.user is not None:
            email = getattr(feedback.user, "email", "") or "(sem e-mail)"
            lines.extend(["", "Usuário:", f"{feedback.user.username} <{email}>"])
        if feedback.page_url:
            lines.extend(["", "Origem:", feedback.page_url])
        text_body = "\n".join(lines)
        html_body = "<br>".join(html.escape(line) if line else "&nbsp;" for line in lines)
        if resend is None:
            logger.warning("resend package not available; skipping feedback email for %s", recipient)
            return
        try:
            resend.Emails.send(
                {
                    "from": settings.EMAIL_FROM,
                    "to": [recipient],
                    "subject": subject,
                    "text": text_body,
                    "html": f"<p>{html_body}</p>",
                }
            )
        except Exception:
            logger.exception("Falha ao enviar feedback para %s", recipient)


class FeedbackSubmitView(MutationMixin, RateLimitHeadersMixin, APIView):
    permission_classes = [AllowAny]
    throttle_classes = [FeedbackRateThrottle]
    throttle_scope = "feedback"

    def post(self, request):
        serializer = FeedbackCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        feedback = FeedbackService.submit(
            kind=serializer.validated_data["kind"],
            message=serializer.validated_data["message"],
            page_url=serializer.validated_data.get("page_url", ""),
            user=request.user if request.user.is_authenticated else None,
        )
        return Response(
            FeedbackMessageSerializer(feedback).data,
            status=status.HTTP_201_CREATED,
        )
