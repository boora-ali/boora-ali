# Risco #5 — Registro sem verificação de email ✅ IMPLEMENTADO

## Problema

O campo `email_verified` existe em `UserProfile` (`accounts/models.py:90`) mas não há
nenhum fluxo de verificação implementado: nenhum email de confirmação enviado no registro,
nenhum endpoint de verificação, e nenhum bloqueio de acesso a usuários com email não verificado.

O campo está presente mas nunca é definido como `True` após o registro — todo usuário
tem `email_verified = False` permanentemente.

**Impactos**:
- Qualquer email pode ser usado sem confirmação (spam de contas, squatting de emails)
- Recuperação de senha por email futura ficará insegura (email não confiável)
- Impossível distinguir usuários com email real dos com email falso

---

## Objetivo

Implementar o fluxo completo: enviar email de verificação no registro via Resend,
endpoint para confirmar o token, e (opcional) bloquear acesso enquanto não verificado.

---

## Skills a invocar antes de implementar

Backend:
- `/django-expert` — padrões Django, models, views, autenticação, migrations
- `/django-patterns` — token de verificação, TTL via DateTimeField, idempotência de reenvio
- `/bora-ali-backend` — convenções do projeto (UserProfile, RegisterView, exceptions)

---

## Dependências

```bash
pip install resend
# adicionar ao requirements.txt
```

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/config/settings.py` | Adicionar `RESEND_API_KEY` e `EMAIL_FROM` |
| `backend/accounts/models.py` | Adicionar `email_verification_token` + `email_verification_sent_at` em `UserProfile` |
| `backend/accounts/views.py` | Enviar email no registro; adicionar endpoints `POST /api/auth/verify-email/` e `POST /api/auth/resend-verification/` |
| `backend/accounts/urls.py` | Registrar novas rotas |
| `backend/accounts/serializers.py` | Serializer para `verify-email` |

> **Migrations**: após editar `models.py`, rodar `python manage.py makemigrations accounts` manualmente.

---

## Implementação passo a passo

### 1. `settings.py` — configuração Resend

```python
# backend/config/settings.py
import resend as _resend

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", "Bora Ali <noreply@boraali.com.br>")
EMAIL_VERIFICATION_TIMEOUT_HOURS = int(os.getenv("EMAIL_VERIFICATION_TIMEOUT_HOURS", "24"))

_resend.api_key = RESEND_API_KEY
```

> Configurar `resend.api_key` no módulo `settings.py` garante que esteja definido
> antes de qualquer import — mesmo padrão do exemplo oficial do Django + Resend.

### 2. `models.py` — campos de verificação em `UserProfile`

```python
# backend/accounts/models.py
import secrets

class UserProfile(models.Model):
    # ... campos existentes (email_verified já existe) ...

    email_verification_token = models.CharField(
        max_length=64, blank=True, default="", db_index=True
    )
    email_verification_sent_at = models.DateTimeField(null=True, blank=True)
```

### 3. `views.py` — enviar email no registro

```python
# backend/accounts/views.py
import logging
import secrets

import resend
from django.conf import settings
from django.utils import timezone

_log = logging.getLogger("accounts.views")


def _send_verification_email(user, profile):
    token = secrets.token_urlsafe(32)
    profile.email_verification_token = token
    profile.email_verification_sent_at = timezone.now()
    profile.save(update_fields=["email_verification_token", "email_verification_sent_at"])

    verification_url = f"{settings.PUBLIC_BASE_URL}/verify-email?token={token}"
    try:
        resend.Emails.send({
            "from": settings.EMAIL_FROM,
            "to": [user.email],
            "subject": "Confirme seu email — Bora Ali",
            "html": (
                f"<p>Olá! Acesse o link abaixo para verificar seu email:</p>"
                f"<p><a href='{verification_url}'>{verification_url}</a></p>"
                f"<p>O link expira em {settings.EMAIL_VERIFICATION_TIMEOUT_HOURS} horas.</p>"
            ),
        })
    except Exception:
        # Não bloquear o registro se o email falhar, mas logar para rastreio
        _log.exception("Falha ao enviar email de verificação para %s", user.email)


# Chamar _send_verification_email() após criar o usuário no RegisterView
```

### 4. `views.py` — endpoints de verificação e reenvio

```python
# backend/accounts/views.py
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError

from core.views import MutationMixin
from accounts.models import UserProfile


class VerifyEmailView(MutationMixin, APIView):
    permission_classes = [AllowAny]  # público — token é o segredo

    def post(self, request):
        token = request.data.get("token", "").strip()
        if not token:
            raise ValidationError({"token": "Token obrigatório."})

        # Filtrar por token não-vazio evita match acidental no default=""
        profile = UserProfile.objects.filter(
            email_verification_token=token,
            email_verification_sent_at__isnull=False,
        ).first()
        if not profile:
            raise ValidationError({"token": "Token inválido ou expirado."})

        timeout = timedelta(hours=settings.EMAIL_VERIFICATION_TIMEOUT_HOURS)
        if timezone.now() - profile.email_verification_sent_at > timeout:
            raise ValidationError({"token": "Token expirado. Solicite um novo."})

        profile.email_verified = True
        profile.email_verification_token = ""
        profile.save(update_fields=["email_verified", "email_verification_token"])
        return Response({"detail": "Email verificado com sucesso."})


class ResendVerificationEmailView(MutationMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = request.user.profile
        if profile.email_verified:
            return Response({"detail": "Email já verificado."})
        _send_verification_email(request.user, profile)
        return Response({"detail": "Email de verificação reenviado."})
```

### 5. `urls.py` — registrar as novas rotas

```python
# backend/accounts/urls.py
from django.urls import path
from accounts.views import VerifyEmailView, ResendVerificationEmailView

urlpatterns = [
    # ... rotas existentes ...
    path("verify-email/", VerifyEmailView.as_view(), name="verify-email"),
    path("resend-verification/", ResendVerificationEmailView.as_view(), name="resend-verification"),
]
```

### 6. (Opcional) Bloquear acesso enquanto não verificado

```python
# backend/accounts/authentication.py — em SingleSessionJWTAuthentication.authenticate()
# Após validar o token JWT, verificar se email está confirmado.
# Contas Google (GoogleIdentity relacionada) são isentas — email já validado pelo Google.
from accounts.models import GoogleIdentity

is_google = GoogleIdentity.objects.filter(user=user).exists()
if not user.profile.email_verified and not is_google:
    raise EmailNotVerifiedException()
```

> **Trade-off**: bloquear acesso imediatamente é mais seguro mas pode frustrar usuários
> que não receberam o email. Recomendado: exibir aviso no frontend sem bloquear, e
> bloquear somente após 7 dias sem verificação.

### 7. Variáveis de ambiente necessárias

```bash
# .env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=Bora Ali <noreply@boraali.com.br>
EMAIL_VERIFICATION_TIMEOUT_HOURS=24
```

> Em desenvolvimento, o Resend oferece `onboarding@resend.dev` como remetente de teste
> (sem domínio verificado). Para produção, verificar o domínio `boraali.com.br` no
> painel Resend antes de usar `noreply@boraali.com.br`.

---

## Verificação

```bash
scripts/dev-check.sh backend
```

Teste manual:
1. Registrar conta → verificar email recebido via Resend
2. Chamar `POST /api/auth/verify-email/` com o token → `email_verified = True`
3. Token expirado → retornar erro 400
4. Chamar `POST /api/auth/verify-email/` com token vazio `""` → erro 400 (não 500)
5. Chamar `POST /api/auth/resend-verification/` autenticado → novo token gerado e email reenviado
6. Conta Google → `email_verified` deve ser `True` no registro (Google já validou)
