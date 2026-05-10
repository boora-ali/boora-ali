# Backend: Autenticação

## Single-Session — accounts/authentication.py

Cada login gera uma nova `session_key` no `UserSession`. O JWT carrega esse valor. Todo request valida se a chave ainda bate.

```python
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from .models import UserSession

class SingleSessionJWTAuthentication(JWTAuthentication):
    def get_validated_token(self, raw_token):
        validated = super().get_validated_token(raw_token)
        user_id = validated.get("user_id")
        session_key = validated.get("session_key")
        try:
            session = UserSession.objects.get(user_id=user_id)
            if str(session.session_key) != str(session_key):
                raise InvalidToken({"code": "session_invalidated", "detail": "Sessão encerrada."})
        except UserSession.DoesNotExist:
            raise InvalidToken({"code": "session_expired", "detail": "Sessão expirada."})
        return validated
```

## Login — rotação de session_key

```python
# No LoginView, após validar credenciais:
session, _ = UserSession.objects.get_or_create(user=user)
session.session_key = uuid.uuid4()
session.save()

# Injetar no token:
token = RefreshToken.for_user(user)
token["session_key"] = str(session.session_key)
```

## Endpoints de auth

```
POST /api/auth/register/
POST /api/auth/login/
POST /api/auth/refresh/
POST /api/auth/logout/     ← blacklista refresh token
GET  /api/auth/me/
POST /api/auth/google/     ← verifica id_token, cria/encontra user
PATCH /api/auth/me/        ← update profile
POST /api/auth/password/   ← bloqueado para is_google_account=True
```

## Registro — proteção atual

- `RegisterSerializer` exige `username`, `email`, `password`, `confirm_password`.
- O cadastro inclui um honeypot oculto `website`.
- Se `website` vier preenchido, a API rejeita o cadastro com erro genérico de validação.
- `register`, `login`, `password` e `google login` usam `AuthRateThrottle`.

## Google OAuth — accounts/views.py

```python
from rest_framework import permissions
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

class GoogleLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = request.data.get("id_token")
        try:
            info = id_token.verify_oauth2_token(
                token, google_requests.Request(), settings.GOOGLE_OAUTH_CLIENT_ID
            )
        except ValueError:
            raise AuthenticationFailed({"code": "invalid_token", "detail": "Token inválido."})

        email = info["email"]
        user, created = User.objects.get_or_create(
            email=email,
            defaults={"username": email.split("@")[0]}
        )
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.is_google_account = True
        profile.save()

        # gerar tokens com session_key (mesmo padrão do login normal)
        ...
```

Requer: `pip install google-auth`

## Rate limit para auth

- `AuthRateThrottle` usa `ScopedRateThrottle` e respeita `THROTTLE_EXEMPT_CIDRS`.
- O limite atual vem de `DEFAULT_THROTTLE_RATES["auth"] = "30/minute"`.
- `RegisterView`, `ThrottledLoginView`, `PasswordChangeView` e `GoogleLoginView` aplicam esse throttle.

## Frontend — banner de sessão encerrada

`api.ts` detecta `code: "session_invalidated"` ou `code: "session_expired"` na resposta 401 e grava `localStorage.setItem("boraali_session_invalidated", "true")`. `LoginPage` lê isso e exibe banner amber.
