# Risco — Exclusão de conta sem período de carência

## Problema

Não existe fluxo de exclusão de conta no produto. Um usuário que queira deletar sua conta não
tem como fazê-lo. Quando implementado, uma deleção imediata (sem carência) é irreversível e
pode ser acionada por acidente ou por acesso indevido à conta.

**Comportamento desejado**:
- Usuário solicita exclusão → conta entra em estado "pendente de deleção" por 7 dias
- Se o usuário logar novamente dentro de 7 dias → conta é reativada automaticamente
- Após 7 dias sem acesso → task Celery deleta permanentemente user + todos os dados

---

## Objetivo

1. Adicionar `deletion_requested_at` em `UserProfile`
2. Endpoint `POST /api/auth/me/delete/` para solicitar exclusão
3. Lógica de reativação automática no login
4. Task Celery periódica que executa a deleção permanente
5. Frontend: botão "Excluir conta" na `AccountPage` com modal de confirmação

---

## Skills a invocar antes de implementar

Backend:
- `/django-expert` — padrões Django, models, views, tasks, migrations
- `/bora-ali-backend` — convenções do projeto (UserProfile, SingleSessionTokenObtainPairSerializer, MutationMixin)

Frontend:
- `/bora-ali-frontend` — convenções do frontend (serviços de API, i18n, testes)
- `/frontend-design` — componentes shadcn/ui (`AlertDialog`, `Card`, `Button`)

> Pré-requisito: implementar `feat-notifications.md` antes (notificação de conta agendada usada no passo 2).

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/accounts/models.py` | Adicionar `deletion_requested_at` em `UserProfile` |
| `backend/accounts/views.py` | Adicionar `DeleteAccountView`; lógica de reativação no login |
| `backend/accounts/urls.py` | Registrar `DELETE /api/auth/me/delete/` |
| `backend/accounts/tasks.py` | Adicionar task `purge_deleted_accounts` |
| `backend/accounts/token_serializers.py` | Reativar conta no login se dentro da carência |
| `frontend/src/routes/AccountPage.tsx` | Adicionar seção "Zona de perigo" com modal de confirmação |
| `frontend/src/api/account.ts` | Chamada `deleteAccount()` |

> **Migrations**: após editar `models.py`, rodar `python manage.py makemigrations accounts` manualmente.

---

## Implementação passo a passo

### 1. `models.py` — `deletion_requested_at` em `UserProfile`

```python
# backend/accounts/models.py
class UserProfile(models.Model):
    # ... campos existentes ...
    deletion_requested_at = models.DateTimeField(null=True, blank=True)
```

### 2. `views.py` — endpoint de solicitação de exclusão

```python
# backend/accounts/views.py
from django.utils import timezone
from notifications.service import notify, NotificationType

class DeleteAccountView(MutationMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        profile = request.user.profile
        if profile.deletion_requested_at:
            return Response({"detail": "Exclusão já solicitada."}, status=400)

        profile.deletion_requested_at = timezone.now()
        profile.save(update_fields=["deletion_requested_at"])

        # Notifica o usuário sobre a exclusão agendada
        notify(
            user=request.user,
            type=NotificationType.ACCOUNT_DELETION,
            title="Conta agendada para exclusão",
            body="Sua conta será excluída permanentemente em 7 dias. "
                 "Faça login antes disso para cancelar.",
        )

        return Response({"detail": "Conta agendada para exclusão em 7 dias."})
```

### 3. `token_serializers.py` — reativação automática no login

```python
# backend/accounts/token_serializers.py
from django.utils import timezone

class SingleSessionTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)

        # Reativar conta se dentro do período de carência
        profile = self.user.profile
        if profile.deletion_requested_at is not None:
            profile.deletion_requested_at = None
            profile.save(update_fields=["deletion_requested_at"])
            # Informar o frontend que a conta foi reativada
            data["account_reactivated"] = True

        return data
```

> O campo `account_reactivated` no response do login permite o frontend exibir um aviso:
> "Sua conta foi reativada. Bem-vindo de volta!"

### 4. `tasks.py` — purge permanente de contas expiradas

```python
# backend/accounts/tasks.py
import logging
from celery import shared_task
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

_log = logging.getLogger("accounts.tasks")
User = get_user_model()

ACCOUNT_DELETION_GRACE_DAYS = 7


@shared_task
def purge_deleted_accounts():
    """Deleta permanentemente contas com deletion_requested_at > 7 dias."""
    cutoff = timezone.now() - timedelta(days=ACCOUNT_DELETION_GRACE_DAYS)

    expired = User.objects.filter(
        profile__deletion_requested_at__isnull=False,
        profile__deletion_requested_at__lt=cutoff,
    )

    count = expired.count()
    if count == 0:
        return {"deleted": 0}

    for user in expired.iterator():
        _log.info("purge_deleted_accounts: deletando user_id=%s", user.pk)
        user.delete()  # CASCADE via DB: Places, Visits, VisitItems, histórico, tokens

    _log.info("purge_deleted_accounts: %d conta(s) deletada(s)", count)
    return {"deleted": count}
```

> **Atenção**: `user.delete()` dispara CASCADE. Verificar que `Place`, `Visit`, `VisitItem`,
> tokens JWT e histórico têm `ForeignKey(..., on_delete=CASCADE)` vinculados ao User.
> Imagens no storage NÃO são removidas via CASCADE — se `Place.cover_photo` usa signals
> `post_delete`, eles disparam na deleção do Place via cascade do User.

### 5. Agendar via admin

1. Admin → **Operações** → **Tasks periódicas** → **Adicionar**
2. Nome: `Purge contas agendadas para deleção`
3. Task: `accounts.tasks.purge_deleted_accounts`
4. Schedule: crontab `0 3 * * *` (3h da manhã, 1x/dia)
5. Salvar

### 6. `urls.py` — registrar rota

```python
# backend/accounts/urls.py
from .views import DeleteAccountView

urlpatterns = [
    # ... rotas existentes ...
    path("me/delete/", DeleteAccountView.as_view()),
]
```

### 7. Frontend — `api/account.ts` (adicionar chamada)

```typescript
// frontend/src/api/account.ts (ou no arquivo de API existente)
export const deleteAccount = () =>
  api.post("/api/auth/me/delete/");
```

### 8. Frontend — `AccountPage.tsx` — seção "Zona de perigo"

Adicionar ao final da página, após o card de senha:

```tsx
// frontend/src/routes/AccountPage.tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteAccount } from "../api/account";

// Dentro do componente AccountPage:
const [deleteError, setDeleteError] = useState("");

async function onDeleteAccount() {
  try {
    await deleteAccount();
    // Redirecionar para logout após solicitar exclusão
    // A conta ainda existe — o usuário pode logar e cancelar
  } catch {
    setDeleteError(t("account.delete.error"));
  }
}

// JSX — adicionar após o card de senha:
<Card className="border-destructive/50">
  <CardContent className="pt-6">
    <div className="space-y-2">
      <h3 className="font-medium text-destructive">{t("account.delete.title")}</h3>
      <p className="text-sm text-muted-foreground">{t("account.delete.description")}</p>
      <p className="text-xs text-muted-foreground">{t("account.delete.grace")}</p>
      {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm">{t("account.delete.button")}</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("account.delete.confirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("account.delete.confirm.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={onDeleteAccount}
            >
              {t("account.delete.confirm.action")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </CardContent>
</Card>
```

### 9. Traduções i18n necessárias (pt-BR)

```json
"account.delete.title": "Zona de perigo",
"account.delete.description": "Ao excluir sua conta, todos os seus lugares, visitas e dados serão removidos permanentemente.",
"account.delete.grace": "Você tem 7 dias para mudar de ideia — basta fazer login novamente para cancelar.",
"account.delete.button": "Excluir minha conta",
"account.delete.error": "Erro ao solicitar exclusão. Tente novamente.",
"account.delete.confirm.title": "Excluir conta permanentemente?",
"account.delete.confirm.description": "Sua conta ficará agendada para exclusão em 7 dias. Se fizer login antes disso, ela será reativada automaticamente.",
"account.delete.confirm.action": "Sim, excluir minha conta"
```

---

## Verificação

```bash
scripts/dev-check.sh backend
scripts/dev-check.sh frontend
```

Teste manual:
1. `POST /api/auth/me/delete/` → `deletion_requested_at` preenchido, notificação criada
2. Login imediato → `deletion_requested_at` limpo, `account_reactivated: true` no response
3. Simular cutoff: ajustar `deletion_requested_at` para > 7 dias → rodar `purge_deleted_accounts.apply()` → user deletado
4. Frontend: modal aparece, confirmação chama endpoint, redireciona para logout
