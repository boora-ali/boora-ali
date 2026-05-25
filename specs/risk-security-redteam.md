# Risk — Security Red Team: Endpoints  IMPLEMENTADO

## Contexto

Revisão red team completa de todos os endpoints da API. Cobre accounts, places, core media,
image service e feature de place-sharing. Alguns itens já foram corrigidos (marcados ✅).

---

## Status dos Fixes

| # | Severidade | Problema | Status |
|---|-----------|----------|--------|
| 1 | 🔴 CRITICAL | Crypto DoS em `PlaceShareMediaView` | ✅ Corrigido |
| 2 | 🟠 HIGH | TOCTOU race em `PlaceShareImportView` | ✅ Corrigido |
| 3 | 🟠 HIGH | Token flood em `PlaceShareCreateView` | ✅ Corrigido |
| 4 | 🟠 HIGH | `status` exposto no `PlaceShareDetailView` | ✅ Corrigido |
| 5 | 🟠 HIGH | `ImageService.decrypt` fallback silencioso | ✅ Corrigido — fallback legado mantido |
| 6 | 🟠 HIGH | `DeleteAccountView` sem re-auth de senha | ✅ Corrigido |
| 7 | 🟡 MEDIUM | href injection no `SharePage.tsx` | ✅ Corrigido |
| 8 | 🟡 MEDIUM | `Cache-Control: immutable` em mídia privada | ✅ Corrigido |
| 9 | 🟡 MEDIUM | `ResendVerificationEmailView` throttle frouxo | ✅ Corrigido |
| 10 | 🟡 MEDIUM | `VerifyEmailView` sem throttle explícito | ✅ Corrigido |
| 11 | 🔵 LOW | HMAC usando `SECRET_KEY` compartilhada | ✅ Corrigido (→ `MEDIA_ENCRYPTION_KEY`) |
| 12 | 🔵 LOW | HMAC separator collision | ✅ Corrigido (→ `json.dumps`) |
| 13 | 🔵 LOW | `ImageService._derive_key` — chaves em memória | ⚠️ Pendente |
| 14 | 🔵 LOW | Account enumeration via register | ⚠️ Pendente |
| 15 | 🔵 LOW | `TokenRefreshView` sem throttle | ✅ Corrigido |
| 16 | ⚪ INFO | `serve_user_media` user_id timing | ⚠️ Aceitar |
| 17 | ⚪ INFO | `PlaceShareDetailView` expõe coordenadas | ⚠️ Aceitar (by spec) |

---

## Findings Pendentes — Detalhes

---

### 🟠 HIGH #5 — `ImageService.decrypt` fallback silencioso para `SECRET_KEY` ✅

**Nota de compatibilidade:** o fallback para `SECRET_KEY` precisa continuar existindo enquanto
houver mídia de usuários já gravada antes de `MEDIA_ENCRYPTION_KEY`. O fix não remove o
fallback; ele só limita o fallback ao caso esperado (`InvalidToken`) e deixa falhas inesperadas
propagarem.

**Arquivo:** `backend/core/image_service.py:52`

**Problema:**

```python
def decrypt(data: bytes, user_id: int) -> bytes:
    try:
        return ImageService._media_key(user_id).decrypt(data)
    except Exception:          # captura TUDO — não só InvalidToken
        legacy = ImageService._derive_key(user_id, settings.SECRET_KEY)
        return legacy.decrypt(data)
```

`except Exception` é amplo demais. Captura storage corrompido, I/O error, wrong key,
qualquer falha. Dois riscos:

1. **Erros reais viram silenciosos**: corrupção de dado, key rotation parcial → erro mascarado,
   dado errado retornado sem nenhum log de alerta
2. **Downgrade attack teórico**: se atacante substituir bytes no storage por conteúdo encriptado
   com `SECRET_KEY` (possível após leak de config/logs), o fallback decripta e serve
   silenciosamente sem nenhum indicador de anomalia

**Fix:**

```python
from cryptography.fernet import InvalidToken

@staticmethod
def decrypt(data: bytes, user_id: int) -> bytes:
    try:
        return ImageService._media_key(user_id).decrypt(data)
    except InvalidToken:
        # Fallback apenas para imagens encriptadas antes de MEDIA_ENCRYPTION_KEY existir
        legacy = ImageService._derive_key(user_id, settings.SECRET_KEY)
        return legacy.decrypt(data)  # propaga InvalidToken se falhar aqui também
```

**Esforço:** 3 linhas. Importar `InvalidToken` de `cryptography.fernet`.

---

### 🟠 HIGH #6 — `DeleteAccountView` sem re-autenticação de senha ✅

**Arquivo:** `backend/accounts/views.py:175`

**Problema:**

```python
class DeleteAccountView(MutationMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]  # só JWT válido

    def post(self, request):
        profile.deletion_requested_at = timezone.now()
```

JWT roubado (XSS, rede compartilhada, shoulder surfing, token em log) = atacante agenda
exclusão imediata da conta da vítima. A vítima tem 7 dias para perceber e logar para cancelar.
Sem confirmação de senha, a operação mais destrutiva do app requer apenas um token válido.

**Attack scenario:**
1. Atacante obtém JWT via XSS em page com `localStorage`
2. `POST /api/auth/delete/` → `200 OK`
3. Vítima perde conta em 7 dias se não perceber a notificação

**Fix:**

```python
def post(self, request):
    # Contas Google não têm senha — usar email token como alternativa
    if not getattr(request.user, "is_google_account", False):
        password = request.data.get("password", "")
        if not password or not request.user.check_password(password):
            return Response({"password": "Senha incorreta."}, status=400)
    
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    if profile.deletion_requested_at:
        return Response({"detail": "Exclusão já solicitada."}, status=400)
    # ... resto do fluxo
```

Para Google accounts: alternativa é exigir re-autenticação via Google OAuth ou enviar
email de confirmação antes de agendar (ver `feat-tipo-conta.md`).

**Esforço:** ~15 linhas. Atenção ao caso `is_google_account=True`.

---

### 🟡 MEDIUM #8 — `Cache-Control: immutable` em mídia privada ✅

**Arquivo:** `backend/core/media_views.py:58`

**Problema:**

```python
response["Cache-Control"] = "private, max-age=31536000, immutable"
```

1 ano de cache imutável em imagens privadas. Consequências:

- Usuário deleta cover photo → URL antiga servida do cache do browser por até 1 ano
- Conta excluída → fotos da conta aparecem no browser de qualquer dispositivo que já abriu
- Conta comprometida e recuperada → atacante retém acesso às imagens via cache local
- Cover photos de lugares privados ficam "vazadas" no storage do browser

`immutable` sinaliza que o recurso nunca muda — correto para assets com content hash na URL
(JS/CSS bundle), mas errado para mídia de usuário que pode ser substituída ou deletada.

**Fix:**

```python
response["Cache-Control"] = "private, max-age=3600, must-revalidate"
```

1 hora é suficiente para UX sem sacrificar segurança. `must-revalidate` força revalidação
após expirar. Remover `immutable` completamente para mídia de usuário.

**Esforço:** 1 linha.

---

### 🟡 MEDIUM #9 — `ResendVerificationEmailView` throttle frouxo ✅

**Arquivo:** `backend/accounts/views.py:224`

**Problema:**

Sem throttle explícito → herda `UserRateThrottle` global: **1000/hour ≈ 16 emails/minuto**.
Um usuário logado pode disparar centenas de emails de verificação por hora para seu próprio
endereço. Impactos:

1. **Custo**: Resend API cobra por email enviado
2. **Spam**: inbox da vítima (que pode ser outra pessoa com email cadastrado por engano) inundada
3. **Flood**: útil para annoyance attacks contra o próprio usuário

**Fix — opção 1 (throttle apertado):**

```python
class ResendVerificationEmailView(MutationMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"  # 30/min — explícito
```

**Fix — opção 2 (cooldown no DB, mais robusto):**

```python
def post(self, request):
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    if profile.email_verified:
        return Response({"detail": "Email já verificado."})
    
    cooldown = timedelta(minutes=1)
    if profile.email_verification_sent_at:
        elapsed = timezone.now() - profile.email_verification_sent_at
        if elapsed < cooldown:
            wait = int((cooldown - elapsed).total_seconds())
            return Response(
                {"detail": f"Aguarde {wait}s antes de solicitar novamente."},
                status=429,
            )
    
    _send_verification_email(request.user, profile)
    return Response({"detail": "Email de verificação reenviado."})
```

Opção 2 é preferível: persiste o cooldown no DB, funciona mesmo com múltiplos workers,
e é independente do cache de throttle.

**Esforço:** ~10 linhas.

---

### 🟡 MEDIUM #10 — `VerifyEmailView` sem throttle explícito ✅

**Arquivo:** `backend/accounts/views.py:199`

**Problema:**

```python
class VerifyEmailView(MutationMixin, APIView):
    permission_classes = [permissions.AllowAny]
    # sem throttle_classes → herda AnonRateThrottle = 100/hour
```

100 requests/hora por IP para endpoint público que faz `SELECT` por token no DB.
Token tem 256-bit entropia → brute force infeasível. Risco real é diferente:

- **DB query amplification**: 100 requests/hora por IP, mas sem custo computacional alto
- **Timing oracle teórico**: diferença de tempo entre token existente (faz SELECT + UPDATE)
  vs não-existente (só SELECT) pode, em teoria, confirmar existência de tokens em escala

**Fix:**

```python
class VerifyEmailView(MutationMixin, APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthRateThrottle]
    throttle_scope = "auth"  # 30/min — consistente com outros endpoints de auth
```

**Esforço:** 2 linhas.

---

### 🔵 LOW #13 — `ImageService._derive_key` — chaves Fernet em memória via `lru_cache`

**Arquivo:** `backend/core/image_service.py:24`

**Problema:**

```python
@functools.lru_cache(maxsize=128)
def _derive_key(user_id: int, _secret_key: str) -> Fernet:
```

128 objetos `Fernet` ficam no heap do processo. Cada objeto contém a chave derivada de
um usuário. Vetores de exposição:

- Crash dump / core dump enviado para diagnóstico
- Sentry memory snapshot em exceção não tratada
- `/proc/{pid}/mem` acessível por processo com mesmo UID
- `gc.get_objects()` via RCE no worker

Não exploitável remotamente. Relevante em cenários de comprometimento do servidor.

**Mitigação (sem quebrar performance):**

```python
# Substituir lru_cache por TTLCache — chaves expiram após N minutos
from cachetools import TTLCache
import threading

_key_cache: TTLCache = TTLCache(maxsize=64, ttl=300)  # 5 min TTL
_key_cache_lock = threading.Lock()

@staticmethod
def _derive_key(user_id: int, _secret_key: str) -> Fernet:
    cache_key = (user_id, hash(_secret_key))
    with _key_cache_lock:
        if cache_key not in _key_cache:
            hkdf = HKDF(...)
            raw = hkdf.derive(_secret_key.encode())
            _key_cache[cache_key] = Fernet(base64.urlsafe_b64encode(raw))
        return _key_cache[cache_key]
```

`cachetools` não está no requirements — alternativa simples é reduzir `maxsize=32` para
diminuir superfície sem mudar comportamento.

**Esforço:** médio. Requer `pip install cachetools` ou implementação manual de TTL cache.

---

### 🔵 LOW #14 — Account enumeration via `RegisterView`

**Arquivo:** `backend/accounts/serializers.py` (RegisterSerializer)

**Problema:**

`POST /api/auth/register/` com email já cadastrado retorna erro diferente de email novo.
Atacante pode confirmar se um email específico tem conta no Boora Ali.

Impacto: se usuários valorizam privacidade de cadastro (o app é diário pessoal), vazar
que um email tem conta é dado pessoal.

**Fix (se privacidade for prioridade):**

Retornar sempre `"Verifique seu email para confirmar o cadastro."` independente de o email
existir, e enviar email diferente para já-cadastrados:

```python
# Para email existente: enviar email de "alguém tentou criar conta com seu email"
# Para email novo: enviar email de verificação normal
# Response: sempre o mesmo
```

Atenção: isso complica o UX (usuário não sabe se já tem conta). Avaliar se vale o tradeoff.

**Esforço:** médio. Muda fluxo de registro e UX do frontend.

---

### 🔵 LOW #15 — `TokenRefreshView` sem throttle ✅

**Arquivo:** `backend/accounts/views.py:116`

**Problema:**

```python
throttle_classes = []  # refresh token is signed — brute force is infeasible
```

O comentário está correto para brute force. O risco residual é diferente:

Token de refresh roubado pode ser usado para gerar access tokens em loop sem nenhum limite
de velocidade — maximizando a janela de uso antes da sessão ser invalidada (SingleSession
garante que o owner original perde a sessão mas o atacante pode usar rapidamente).

**Fix:**
```python
throttle_classes = [AuthRateThrottle]
throttle_scope = "auth"
```

Rate de 30/min é mais que suficiente para uso legítimo (frontend refresha a cada 30min).

**Esforço:** 2 linhas.

---

## Items Aceitos (sem ação necessária)

### ⚪ INFO — `serve_user_media` user_id timing side channel

`/api/media/users/{id}/...` tem diferença de timing marginal entre user_id válido vs inválido.
IDs inteiros sequenciais já são semi-públicos (aparecem em URLs de resposta da API).
**Aceitar.**

### ⚪ INFO — `PlaceShareDetailView` expõe latitude/longitude

Coordenadas exatas do place privado são reveladas a qualquer holder do share link.
Por spec, o token é a autorização e o link é gerado intencionalmente pelo owner.
**Aceitar (by design).**

---

## Ordem de Implementação Recomendada

```
Semana atual:
  1. image_service.py → except InvalidToken           (3 linhas, HIGH)
  2. media_views.py   → Cache-Control max-age=3600    (1 linha, MEDIUM)
  3. accounts/views.py → throttle VerifyEmail         (2 linhas, MEDIUM)
  4. accounts/views.py → throttle TokenRefresh        (2 linhas, LOW)

Próxima semana:
  5. accounts/views.py → ResendVerification cooldown  (~10 linhas, MEDIUM)
  6. accounts/views.py → DeleteAccount senha confirm  (~15 linhas, HIGH)

Backlog:
  7. image_service.py → TTLCache para chaves          (médio, LOW)
  8. accounts/serializers.py → account enumeration   (médio, LOW)
```

---

## Referências

- Fixes já aplicados: PR na branch `dev` (commit do red team session 2026-05-23)
- `risk-refresh-token-security.md` — contexto sobre SingleSession e JWT
- `risk-email-verification.md` — contexto sobre fluxo de verificação de email
- `risk-account-deletion.md` — contexto sobre grace period de exclusão
