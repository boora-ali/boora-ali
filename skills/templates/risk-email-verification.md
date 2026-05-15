# Risco #5 — Registro sem verificação de email

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

Implementar o fluxo completo: enviar email de verificação no registro,
endpoint para confirmar o token, e (opcional) bloquear acesso enquanto não verificado.

---

## Skills a invocar antes de implementar

- `/django-expert` — padrões Django, models, views, autenticação, migrations
- `/bora-ali-backend` — convenções do projeto (UserProfile, RegisterView, exceptions)

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/config/settings.py` | Configurar `EMAIL_BACKEND` para produção |
| `backend/accounts/models.py` | Adicionar `email_verification_token` + `email_verification_sent_at` em `UserProfile` |
| `backend/accounts/views.py` | Enviar email no registro; adicionar endpoint `POST /api/auth/verify-email/` e `POST /api/auth/resend-verification/` |
| `backend/accounts/urls.py` | Registrar novas rotas |
| `backend/accounts/serializers.py` | Serializer para `verify-email` |

> **Migrations**: após editar `models.py`, rodar `python manage.py makemigrations accounts` manualmente.

---

## Implementação passo a passo

### 1. `settings.py` — backend de email

```python
# backend/config/settings.py
EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend"  # console em dev, SMTP em prod
)
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True") == "True"
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "noreply@boraali.com.br")
EMAIL_VERIFICATION_TIMEOUT_HOURS = int(os.getenv("EMAIL_VERIFICATION_TIMEOUT_HOURS", "24"))
```

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
import secrets
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone

def _send_verification_email(user, profile):
    token = secrets.token_urlsafe(32)
    profile.email_verification_token = token
    profile.email_verification_sent_at = timezone.now()
    profile.save(update_fields=["email_verification_token", "email_verification_sent_at"])

    verification_url = f"{settings.PUBLIC_BASE_URL}/verify-email?token={token}"
    send_mail(
        subject="Confirme seu email — Bora Ali",
        message=f"Acesse para verificar: {verification_url}",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=True,  # não bloquear registro se email falhar
    )

# Chamar _send_verification_email() após criar o usuário no RegisterView
```

### 4. `views.py` — endpoint de verificação

```python
# backend/accounts/views.py
class VerifyEmailView(APIView):
    permission_classes = []  # público — token é o segredo

    def post(self, request):
        token = request.data.get("token", "")
        if not token:
            raise ValidationError({"token": "Token obrigatório."})

        profile = UserProfile.objects.filter(email_verification_token=token).first()
        if not profile:
            raise ValidationError({"token": "Token inválido ou expirado."})

        timeout = timedelta(hours=settings.EMAIL_VERIFICATION_TIMEOUT_HOURS)
        if timezone.now() - profile.email_verification_sent_at > timeout:
            raise ValidationError({"token": "Token expirado. Solicite um novo."})

        profile.email_verified = True
        profile.email_verification_token = ""
        profile.save(update_fields=["email_verified", "email_verification_token"])
        return Response({"detail": "Email verificado com sucesso."})
```

### 5. (Opcional) Bloquear acesso enquanto não verificado

```python
# backend/accounts/authentication.py — em SingleSessionJWTAuthentication.authenticate()
# Após validar o token, verificar se email está confirmado:
if not user.profile.email_verified and not user.is_google_account:
    raise EmailNotVerifiedException()
```

> **Trade-off**: bloquear acesso imediatamente é mais seguro mas pode frustrar usuários
> que não receberam o email. Recomendado: exibir aviso no frontend sem bloquear, e
> bloquear somente após 7 dias sem verificação.

---

## Verificação

```bash
scripts/dev-check.sh backend
```

Teste manual:
1. Registrar conta → verificar email no console (dev) ou caixa de entrada (prod)
2. Chamar `POST /api/auth/verify-email/` com o token → `email_verified = True`
3. Token expirado → retornar erro 400
