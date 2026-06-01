# Compliance — LGPD Greenfield

## Objetivo

Adequar o Boora Ali ao padrão greenfield de LGPD (Lei 13.709/2018) com base no gap analysis de
2026-05-29. O projeto já tem base sólida (exclusão com graça, hash Argon2, criptografia de mídia,
`simple_history`) mas carece de: portabilidade, ledger de consentimento completo, DPAs, runbook
de incidentes, ROPA e ajustes na política de privacidade.

Implementação dividida em 4 grupos por criticidade.

---

## Skills a invocar antes de implementar

Backend:
- `/django-expert` — novo model, migrations, views, serializers
- `/bora-ali-backend` — convenções do projeto (public_id, exceptions, MutationMixin)

Frontend:
- `/bora-ali-frontend` — serviços de API, hooks, formulários RHF+Zod, i18n
- `/frontend-design` — shadcn components

---

## Arquivos que serão criados ou modificados

### Grupo 1 — Críticos (implementar primeiro)

| Arquivo | O que muda |
|---------|-----------|
| `backend/accounts/models.py` | Adicionar `ConsentHistory` |
| `backend/accounts/migrations/` | Nova migration para `ConsentHistory` |
| `backend/accounts/serializers.py` | Capturar IP + UA no registro e no `TermsAcceptView`; utilitário `_get_client_ip` |
| `backend/accounts/views.py` | `DataExportView`, `WithdrawConsentView` |
| `backend/accounts/urls.py` | Novas rotas: `me/export/`, `me/withdraw-consent/` |
| `backend/accounts/services.py` | `build_export_payload(user)` |
| `.lgpd/incidents/log.md` | Arquivo de registro de incidentes (5 anos — Art. 10 Res. 15/2024) |
| `.lgpd/incidents/runbook.md` | Runbook de resposta a incidentes |
| `.lgpd/STATUS.md` | Estado da auditoria |
| `.lgpd/gaps.md` | Lista de não-conformidades |
| `frontend/src/routes/AccountPage.tsx` | Seção "Central de Privacidade" com export |
| `frontend/src/services/auth.service.ts` | `exportData()`, `withdrawConsent()` |
| `frontend/src/locales/pt-BR/translation.json` | Chaves de i18n para privacidade |
| `frontend/src/locales/en/translation.json` | Chaves de i18n para privacidade |

### Grupo 2 — Importantes

| Arquivo | O que muda |
|---------|-----------|
| `backend/accounts/views.py` | `GoogleLoginView` — gravar `ConsentHistory` no primeiro login |
| `frontend/src/routes/PrivacyPolicyPage.tsx` | Base legal por atividade, retenção, contato ANPD, Resend como operador |
| `.lgpd/ROPA.md` | Registro de atividades de tratamento (Art. 37) |
| `.lgpd/legal-basis.md` | Base legal por atividade |
| `.lgpd/encarregado.md` | Designação e canal de contato |
| `frontend/src/components/layout/Footer.tsx` | Link "Encarregado de Dados" + canal do encarregado |

### Grupo 3 — Médios

| Arquivo | O que muda |
|---------|-----------|
| `backend/accounts/tasks.py` | `purge_orphan_history()` — limpa `HistoricalRecords` de usuários deletados |
| `backend/config/settings.py` | `LGPD_R2_PREFIX = "lgpd"` |
| `backend/core/lgpd_storage.py` | **Novo** — `LGPDStorageService`: upload/download/list de artefatos `.lgpd/` no R2 |
| `backend/core/management/commands/lgpd_artifacts.py` | **Novo** — management command `lgpd_artifacts` (push/pull/list) |
| `.gitignore` | Adicionar `.lgpd/` — pasta local é cache; canonical store é R2 |
| R2: `lgpd/vendors/dpa-cloudflare.md` | Registro de DPA com Cloudflare |
| R2: `lgpd/vendors/dpa-resend.md` | Registro de DPA com Resend |
| R2: `lgpd/transfers/` | Avaliação de transferência internacional (Contabo Alemanha) |

### Grupo 4 — Menores

| Arquivo | O que muda |
|---------|-----------|
| `frontend/src/routes/PrivacyPolicyPage.tsx` | Seção 6: mencionar endpoint de exclusão + portabilidade |
| `frontend/src/routes/RegisterPage.tsx` | Verificar que `terms_version` chega corretamente (sem mudança de código) |

> **Migrations**: rodar `python manage.py makemigrations accounts` após cada mudança de model.

---

## Implementação — Grupo 1 (Críticos)

### 1. `ConsentHistory` model

```python
# backend/accounts/models.py — adicionar ao arquivo existente

class ConsentHistory(models.Model):
    """
    Ledger imutável de consentimentos. Nunca atualizar registros — apenas INSERT.
    Art. 7, I + Art. 8, §1 LGPD — ônus da prova do consentimento é do controlador.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="consent_history",
    )
    terms_version = models.CharField(max_length=20)
    accepted_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True, default="")
    method = models.CharField(
        max_length=20,
        default="register",
        help_text="register | google_oauth | re_accept",
    )

    class Meta:
        db_table = "accounts_consent_history"
        ordering = ["-accepted_at"]
```

`UserProfile` já tem `terms_accepted_at` e `terms_version` para estado atual. `ConsentHistory` é o ledger de prova.

### 2. Capturar IP + UA

Adicionar utilitário em `serializers.py`:

```python
def _get_client_ip(request) -> str | None:
    if request is None:
        return None
    x_forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded:
        return x_forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")
```

No `RegisterSerializer.create()`, após criar o profile, inserir:

```python
request = self.context.get("request")
ConsentHistory.objects.create(
    user=user,
    terms_version=CURRENT_TERMS_VERSION,
    ip_address=_get_client_ip(request),
    user_agent=request.META.get("HTTP_USER_AGENT", "")[:512] if request else "",
    method="register",
)
```

No `TermsAcceptView.post()`, após `AccountLifecycleService.accept_terms(...)`, inserir `ConsentHistory` com `method="re_accept"` usando a mesma lógica.

### 3. `DataExportView` — portabilidade (Art. 18, V)

View padrão `APIView` em `views.py` com `permission_classes = [IsAuthenticated]` e `throttle_classes = [AuthRateThrottle]`. Método `get` chama `build_export_payload(request.user)` e retorna `Response` com header `Content-Disposition: attachment; filename="meus-dados-boora-ali.json"`.

O payload é construído por `build_export_payload` em `services.py`:

```python
def build_export_payload(user) -> dict:
    """
    Constrói o payload de portabilidade. Usa Prefetch aninhado para evitar N+1:
    .filter() dentro de loop quebra o cache do prefetch — usar .all() após Prefetch filtrado.
    """
    from django.db.models import Prefetch
    from places.models import Place, Visit, VisitItem
    from .models import ConsentHistory

    profile = getattr(user, "profile", None)

    places_qs = Place.objects.filter(user=user, deleted_at__isnull=True).prefetch_related(
        Prefetch(
            "visits",
            queryset=Visit.objects.filter(deleted_at__isnull=True).prefetch_related(
                Prefetch("items", queryset=VisitItem.objects.filter(deleted_at__isnull=True))
            ),
        )
    )

    places_data = []
    for place in places_qs:
        visits_data = []
        for visit in place.visits.all():
            visits_data.append({
                "visited_at": visit.visited_at.isoformat(),
                "overall_rating": str(visit.overall_rating) if visit.overall_rating else None,
                "environment_rating": str(visit.environment_rating) if visit.environment_rating else None,
                "service_rating": str(visit.service_rating) if visit.service_rating else None,
                "would_return": visit.would_return,
                "general_notes": visit.general_notes,
                "photo_path": visit.photo_path or None,
                "items": [
                    {
                        "name": item.name,
                        "type": item.type,
                        "rating": str(item.rating) if item.rating else None,
                        "price": str(item.price) if item.price else None,
                        "would_order_again": item.would_order_again,
                        "notes": item.notes,
                    }
                    for item in visit.items.all()
                ],
            })
        places_data.append({
            "name": place.name,
            "category": place.category,
            "address": place.address,
            "status": place.status,
            "notes": place.notes,
            "latitude": str(place.latitude) if place.latitude else None,
            "longitude": str(place.longitude) if place.longitude else None,
            "visits": visits_data,
        })

    consents = ConsentHistory.objects.filter(user=user).values(
        "terms_version", "accepted_at", "method"
    )

    return {
        "exported_at": timezone.now().isoformat(),
        "profile": {
            "username": user.username,
            "email": user.email,
            "display_name": user.display_name,
            "nickname": profile.nickname if profile else "",
            "terms_accepted_at": profile.terms_accepted_at.isoformat() if profile and profile.terms_accepted_at else None,
            "terms_version": profile.terms_version if profile else "",
        },
        "consent_history": list(consents),
        "places": places_data,
    }
```

### 4. `WithdrawConsentView` — revogação (Art. 18, IX)

Revogar consentimento = encerrar a conta (único fundamento de tratamento é contrato/consentimento — Art. 7, I e V). A view segue o mesmo padrão do `DeleteAccountView` mas sem exigir senha: checa se `profile.deletion_requested_at` já está preenchido (409 se sim), seta `deletion_requested_at = timezone.now()` e retorna 200 explicando o período de graça de 7 dias. Usar `MutationMixin`, `IsAuthenticated`, `AuthRateThrottle`.

### 5. URLs

Adicionar em `backend/accounts/urls.py`:

```python
path("me/export/", DataExportView.as_view()),
path("me/withdraw-consent/", WithdrawConsentView.as_view()),
```

### 6. Frontend — `auth.service.ts`

Adicionar dois métodos ao service existente:

- `exportData()`: GET `/auth/me/export/` com `responseType: "blob"`, cria URL temporária e dispara download do arquivo `meus-dados-boora-ali.json`.
- `withdrawConsent()`: POST `/auth/me/withdraw-consent/`, retorna `{ detail: string }`.

### 7. Frontend — `AccountPage.tsx` — Seção "Central de Privacidade"

Novo `Card` após o card de senha, antes do card de exclusão. Conteúdo: título "Seus dados" + descrição curta; botão "Exportar" (com `LoadingSpinner` durante loading); linha de texto mostrando versão e data do último consentimento (se `profile.terms_accepted_at` existe).

Handler:

```tsx
const [isExporting, setIsExporting] = useState(false);

const handleExport = async () => {
  setIsExporting(true);
  try {
    await authService.exportData();
  } catch {
    toast.error(t("account.privacy.export.error"));
  } finally {
    setIsExporting(false);
  }
};
```

### 8. i18n

Adicionar em ambos os arquivos de locale (`pt-BR/translation.json` e `en/translation.json`) dentro do objeto `account` existente:

```json
"privacy": {
  "title": "Seus dados",
  "description": "Acesse e gerencie seus dados pessoais conforme a LGPD.",
  "export": {
    "title": "Baixar meus dados",
    "description": "Exporta um arquivo JSON com todos os seus dados armazenados.",
    "button": "Exportar",
    "error": "Erro ao exportar dados. Tente novamente."
  },
  "consentInfo": "Termos v{{version}} aceitos em {{date}}."
}
```

---

## Implementação — Grupo 2 (Importantes)

### 9. Google OAuth — capturar consentimento no primeiro login

Em `GoogleLoginView.post()`, `GoogleAuthService.resolve_user(claims)` retorna `(user, created)`. Se `created` for `True`, criar `ConsentHistory` com `method="google_oauth"` usando `_get_client_ip(request)` e `request.META.get("HTTP_USER_AGENT", "")[:512]`.

### 10. `PrivacyPolicyPage.tsx` — elementos faltantes (Art. 9 LGPD)

Adicionar/atualizar as seguintes seções na página existente:

**Seção 3 — Base legal explícita por atividade** (Art. 9, §2): lista com: autenticação/conta → contrato (Art. 7, V); conteúdo do diário → contrato (Art. 7, V); e-mails transacionais → contrato (Art. 7, V); proteção anti-bot via Turnstile → legítimo interesse (Art. 7, IX); foto de perfil → consentimento (Art. 7, I), campo opcional.

**Seção 4 — Operadores**: adicionar Resend (WorkOS Inc.) para e-mails transacionais.

**Nova seção 5 — Retenção de dados** (Art. 9 obrigatório): conta ativa → enquanto ativa; pós-exclusão → 7 dias de graça, depois exclusão permanente; logs de acesso → até 12 meses; registros de consentimento → até 5 anos após encerramento (obrigação legal).

**Seção de direitos**: adicionar item sobre recurso à ANPD via `gov.br/anpd` (Art. 18, §1).

**Seção 6**: mencionar que exclusão pode ser feita nas configurações da conta (não apenas por e-mail).

### 11. `Footer.tsx` — canal do encarregado

Adicionar link `mailto:samuelviana.dev@gmail.com` antes dos links de termos/privacidade, com texto via chave i18n `footer.dpo` ("Encarregado de Dados" / "Data Protection Officer").

---

## Implementação — Grupo 3 (Médios)

### 12. Purge de `HistoricalRecords` órfãos

```python
# backend/accounts/tasks.py — adicionar

@shared_task
def purge_orphan_history():
    """
    Remove HistoricalRecords de usuários já deletados.
    Roda mensalmente — Art. 15 LGPD (manter apenas o necessário).
    history_user=None significa que o usuário autor da mudança foi deletado.
    """
    from places.models import HistoricalPlace, HistoricalVisit, HistoricalVisitItem
    from accounts.models import HistoricalUserProfile

    cutoff = timezone.now() - timedelta(days=30)
    for HistModel in [HistoricalPlace, HistoricalVisit, HistoricalVisitItem, HistoricalUserProfile]:
        HistModel.objects.filter(
            history_user__isnull=True,
            history_date__lt=cutoff,
        ).delete()
```

---

## Artefatos `.lgpd/` — R2 como store canônico

Documentos de governança (não código). **Store canônico: R2** sob o prefixo `lgpd/`.
A pasta `.lgpd/` na raiz do projeto é gitignored e serve como cache local para edição.

Workflow:
1. Editar localmente em `.lgpd/`
2. `python manage.py lgpd_artifacts push` → sobe para R2
3. `python manage.py lgpd_artifacts pull` → baixa do R2 para local
4. `python manage.py lgpd_artifacts list` → lista objetos no R2

### `LGPDStorageService` — `backend/core/lgpd_storage.py`

```python
import logging

import boto3
from botocore.exceptions import ClientError
from django.conf import settings

logger = logging.getLogger(__name__)

_PREFIX = getattr(settings, "LGPD_R2_PREFIX", "lgpd")


def _client():
    return boto3.client(
        "s3",
        endpoint_url=settings.AWS_S3_ENDPOINT_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=getattr(settings, "AWS_S3_REGION_NAME", "auto"),
    )


class LGPDStorageService:
    """Artefatos de governança LGPD (.lgpd/) no R2. Mesmo bucket da mídia, prefixo "lgpd/"."""

    @staticmethod
    def upload(relative_path: str, content: str | bytes) -> str:
        key = f"{_PREFIX}/{relative_path.lstrip('/')}"
        body = content.encode() if isinstance(content, str) else content
        _client().put_object(
            Bucket=settings.AWS_STORAGE_BUCKET_NAME,
            Key=key,
            Body=body,
            ContentType="text/markdown; charset=utf-8",
        )
        logger.info("lgpd_storage: uploaded %s", key)
        return key

    @staticmethod
    def download(relative_path: str) -> str:
        key = f"{_PREFIX}/{relative_path.lstrip('/')}"
        resp = _client().get_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=key)
        return resp["Body"].read().decode()

    @staticmethod
    def exists(relative_path: str) -> bool:
        key = f"{_PREFIX}/{relative_path.lstrip('/')}"
        try:
            _client().head_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=key)
            return True
        except ClientError:
            return False

    @staticmethod
    def list_artifacts() -> list[str]:
        prefix = f"{_PREFIX}/"
        resp = _client().list_objects_v2(
            Bucket=settings.AWS_STORAGE_BUCKET_NAME, Prefix=prefix
        )
        return [obj["Key"].removeprefix(prefix) for obj in resp.get("Contents", [])]
```

### Management command — `backend/core/management/commands/lgpd_artifacts.py`

```python
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from core.lgpd_storage import LGPDStorageService

# BASE_DIR aponta para backend/; .lgpd/ fica na raiz do projeto (um nível acima)
LGPD_LOCAL = Path(settings.BASE_DIR).parent / ".lgpd"


class Command(BaseCommand):
    help = "Sincroniza artefatos .lgpd/ com R2 (push | pull | list)"

    def add_arguments(self, parser):
        parser.add_argument("action", choices=["push", "pull", "list"])

    def handle(self, *args, **options):
        action = options["action"]
        if action == "list":
            artifacts = LGPDStorageService.list_artifacts()
            if not artifacts:
                self.stdout.write("Nenhum artefato em R2.")
                return
            for path in sorted(artifacts):
                self.stdout.write(f"  lgpd/{path}")

        elif action == "push":
            if not LGPD_LOCAL.exists():
                raise CommandError(f".lgpd/ não encontrado em {LGPD_LOCAL}")
            count = 0
            for f in LGPD_LOCAL.rglob("*"):
                if f.is_file():
                    rel = str(f.relative_to(LGPD_LOCAL))
                    LGPDStorageService.upload(rel, f.read_bytes())
                    self.stdout.write(f"  push: {rel}")
                    count += 1
            self.stdout.write(self.style.SUCCESS(f"{count} arquivo(s) enviado(s) para R2."))

        elif action == "pull":
            artifacts = LGPDStorageService.list_artifacts()
            if not artifacts:
                self.stdout.write("Nenhum artefato em R2.")
                return
            for rel in artifacts:
                content = LGPDStorageService.download(rel)
                dest = LGPD_LOCAL / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_text(content)
                self.stdout.write(f"  pull: {rel}")
            self.stdout.write(self.style.SUCCESS(f"{len(artifacts)} arquivo(s) baixado(s) para .lgpd/."))
```

### settings.py e .gitignore

```python
# backend/config/settings.py
LGPD_R2_PREFIX = "lgpd"
```

```gitignore
# LGPD governance artifacts (store canônico é R2)
.lgpd/
```

---

## Artefatos a criar e fazer push

### `.lgpd/STATUS.md`

```markdown
# LGPD Audit Status

**Projeto**: Boora Ali
**Cenário**: B — Legacy retrofit
**Início**: 2026-05-29
**Última atualização**: 2026-05-29
**Encarregado**: Samuel Viana (samuelviana.dev@gmail.com) — designação informal

## Pipeline
- [ ] G1 — Portabilidade + ledger de consentimento
- [ ] G2 — Revogação de consentimento
- [ ] G3 — Google OAuth consent
- [ ] G4 — DPAs com Cloudflare e Resend (prazo Res. 19/2024 venceu ago/2025)
- [ ] G5 — Runbook de incidentes
- [ ] G6 — Política de privacidade atualizada
- [ ] G7 — Encarregado em destaque no site
- [ ] G8 — ROPA formal
- [ ] G9 — Retenção por categoria + purge de histórico órfão
- [ ] G10 — Audit log imutável (baixo risco — adiar)

## Próximo passo
Implementar Grupo 1 (G1, G2, G3) via esta spec.
```

### `.lgpd/incidents/log.md`

```markdown
# Registro de Incidentes de Segurança

> Manter por 5 anos (Art. 10, Res. CD/ANPD 15/2024).
> Registrar TODOS os incidentes, mesmo os não-notificáveis à ANPD.

| Data | Tipo | Descrição | Notificável? | Ação tomada | Responsável |
|------|------|-----------|-------------|-------------|-------------|
| — | — | Nenhum incidente registrado até o momento | — | — | — |
```

### `.lgpd/vendors/dpa-cloudflare.md`

```markdown
# DPA — Cloudflare Inc.

**Controlador**: Samuel Viana da Silva (Boora Ali)
**Operador**: Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, EUA
**Serviços**: CDN, DDoS protection, Cloudflare Turnstile, Cloudflare R2
**Dados tratados**: IPs de usuários (Turnstile), fotos de perfil e mídia (R2)
**Transferência internacional**: EUA — sem adequação ANPD, mas coberto pelos
  Termos de Serviço da Cloudflare (cláusulas contratuais padrão UE).
**DPA Cloudflare**: https://www.cloudflare.com/cloudflare-customer-dpa/
**Status**: DPA aceito via ToS. Cláusulas-padrão brasileiras (Res. 19/2024) — prazo venceu ago/2025. **PENDENTE**.
**Revisão**: 2026-05-29
```

### `.lgpd/vendors/dpa-resend.md`

```markdown
# DPA — Resend

**Controlador**: Samuel Viana da Silva (Boora Ali)
**Operador**: Resend (WorkOS Inc.), EUA
**Serviços**: E-mail transacional (verificação, recuperação de senha)
**Dados tratados**: e-mail e nome do usuário destinatário
**Transferência internacional**: EUA
**DPA Resend**: https://resend.com/legal/dpa
**Status**: Verificar se DPA da Resend está assinado. **PENDENTE**.
**Revisão**: 2026-05-29
```

---

## Verificação

```bash
# Backend
cd backend
pytest accounts/tests/ -v -k "export or consent or withdraw"
python manage.py check

# Artefatos LGPD no R2
python manage.py lgpd_artifacts push
python manage.py lgpd_artifacts list

# Frontend
cd frontend
npm run build && npm run lint
```

Teste manual:
1. `GET /api/auth/me/export/` → JSON com perfil + lugares + consentimentos
2. `POST /api/auth/me/withdraw-consent/` → `deletion_requested_at` preenchido
3. Registrar novo usuário → `ConsentHistory` criado com IP e UA
4. Login Google → `ConsentHistory` criado com `method="google_oauth"`
5. AccountPage → card "Seus dados" visível, botão "Exportar" faz download do JSON
6. Política de privacidade → seções de base legal e retenção presentes
7. `lgpd_artifacts list` → exibe `lgpd/STATUS.md`, `lgpd/incidents/log.md`, etc.

---

## O que está fora do escopo desta spec

- **Audit log imutável** (G10) — requer infraestrutura append-only ou serviço externo; adiar até escalar
- **Portal DSAR full-service** (G11) — rastreamento de status com SLA 15 dias; adiar até ter volume
- **Cláusulas-padrão brasileiras com Cloudflare/Resend** (G4) — ação jurídica, não de código
- **RIPD** — não há atividade de alto risco (sem decisão automatizada, vigilância pública ou dados sensíveis do Art. 11)
