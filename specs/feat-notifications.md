# Feature — Sistema de Notificações ✅ IMPLEMENTADO

## Objetivo

Notificar o usuário de eventos importantes (lixeira prestes a expirar, conta agendada para deleção,
etc.) via painel in-app. Notificações não se acumulam: se já existe uma não lida do mesmo tipo,
a nova não é criada. Notificações não lidas ficam disponíveis por 7 dias; ao expirar sem leitura,
o evento que as gerou pode disparar uma nova notificação na próxima execução.

---

## Skills a invocar antes de implementar

Backend:
- `/django-expert` — padrões Django, novo app, models, views, serializers, migrations
- `/bora-ali-backend` — convenções do projeto (public_id, exceptions, estrutura de apps)

Frontend:
- `/bora-ali-frontend` — convenções do frontend (serviços de API, hooks, testes)
- `/frontend-design` — componentes shadcn/ui (`Popover`, `ScrollArea`, `Button`)

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/notifications/` | **Novo app Django** |
| `backend/notifications/models.py` | Model `Notification` |
| `backend/notifications/views.py` | `NotificationListView` + mark-read views |
| `backend/notifications/urls.py` | Rotas do app |
| `backend/notifications/serializers.py` | `NotificationSerializer` |
| `backend/notifications/service.py` | `notify()` — função de criação sem duplicatas |
| `backend/config/settings.py` | Adicionar `"notifications"` em `INSTALLED_APPS` |
| `backend/config/urls.py` | Incluir `notifications/urls.py` |
| `frontend/src/components/layout/` | `NotificationBell.tsx` + painel |
| `frontend/src/services/notifications.service.ts` | Chamadas à API |
| `frontend/src/hooks/useNotifications.ts` | Hook com polling via setInterval |

> **Migrations**: após criar `models.py`, rodar `python manage.py makemigrations notifications` manualmente.

---

## Implementação passo a passo

### 1. `models.py` — model `Notification`

Sem `@property` — `is_read` e `is_expired` são deriváveis em Python com `obj.read_at is not None`
e `obj.expires_at < timezone.now()`. Properties em models não são filtráveis no ORM e não trazem
benefício de índice; toda filtragem é feita diretamente no queryset.

```python
# backend/notifications/models.py
import uuid
from django.db import models
from django.conf import settings


class NotificationType(models.TextChoices):
    TRASH_EXPIRY = "trash_expiry", "Lixeira expirando"
    ACCOUNT_DELETION = "account_deletion", "Conta agendada para deleção"


class Notification(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    type = models.CharField(max_length=40, choices=NotificationType.choices)
    title = models.CharField(max_length=200)
    body = models.TextField()
    read_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "read_at", "expires_at"], name="notif_user_unread_idx"),
        ]
```

### 2. `service.py` — `notify()` sem duplicatas

`notification_type` em vez de `type` para não sombrear o builtin Python.

```python
# backend/notifications/service.py
from django.utils import timezone
from datetime import timedelta
from .models import Notification, NotificationType

NOTIFICATION_TTL_DAYS = 7


def notify(user, notification_type: NotificationType, title: str, body: str) -> Notification | None:
    """
    Cria notificação apenas se não houver outra não lida do mesmo tipo para o usuário.
    Retorna a notificação criada ou None se já existia uma pendente.
    """
    already_pending = Notification.objects.filter(
        user=user,
        type=notification_type,
        read_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).exists()

    if already_pending:
        return None

    return Notification.objects.create(
        user=user,
        type=notification_type,
        title=title,
        body=body,
        expires_at=timezone.now() + timedelta(days=NOTIFICATION_TTL_DAYS),
    )
```

### 3. `serializers.py`

`is_read` como `SerializerMethodField` — lógica de apresentação fica no serializer, não no model.

```python
# backend/notifications/serializers.py
from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id", read_only=True)
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ["id", "type", "title", "body", "is_read", "read_at", "expires_at", "created_at"]

    def get_is_read(self, obj):
        return obj.read_at is not None
```

### 4. `views.py` — list + mark-read

Todos os imports no topo do arquivo.

```python
# backend/notifications/views.py
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
            public_id=public_id, user=request.user, read_at__isnull=True
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
            user=request.user, read_at__isnull=True
        ).update(read_at=timezone.now())
        return Response({"detail": "Todas marcadas como lidas."})
```

### 5. `urls.py`

```python
# backend/notifications/urls.py
from django.urls import path
from .views import NotificationListView, NotificationMarkReadView, NotificationMarkAllReadView

urlpatterns = [
    path("", NotificationListView.as_view()),
    path("<uuid:public_id>/read/", NotificationMarkReadView.as_view()),
    path("read-all/", NotificationMarkAllReadView.as_view()),
]
```

### 6. `settings.py` + `urls.py`

```python
# settings.py — em INSTALLED_APPS:
"notifications",

# config/urls.py:
path("api/notifications/", include("notifications.urls")),
```

### 7. Frontend — `services/notifications.service.ts`

`baseURL` do axios já inclui `/api` — usar caminhos sem prefixo `/api/`.

```typescript
// frontend/src/services/notifications.service.ts
import { api } from "./api";

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  read_at: string | null;
  expires_at: string;
  created_at: string;
}

export const notificationsService = {
  list: () => api.get<Notification[]>("/notifications/"),
  markRead: (id: string) => api.post(`/notifications/${id}/read/`),
  markAllRead: () => api.post("/notifications/read-all/"),
};
```

### 8. Frontend — `useNotifications.ts`

O projeto não usa `@tanstack/react-query`. Hook com `useState` + `useEffect` + polling via
`setInterval`, seguindo o padrão dos outros hooks do projeto.

```typescript
// frontend/src/hooks/useNotifications.ts
import { useState, useEffect, useCallback } from "react";
import { notificationsService, type Notification } from "../services/notifications.service";

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await notificationsService.list();
      setNotifications(data);
    } catch {
      // falha silenciosa — bell mostra 0
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markRead = useCallback(async (id: string) => {
    await notificationsService.markRead(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationsService.markAllRead();
    setNotifications([]);
  }, []);

  return { notifications, unreadCount: notifications.length, markRead, markAllRead };
}
```

### 9. Frontend — `NotificationBell.tsx`

Requer shadcn `Popover` e `ScrollArea` instalados (`npx shadcn@latest add popover scroll-area`).

```tsx
// frontend/src/components/layout/NotificationBell.tsx
import { Bell } from "lucide-react";
import { useNotifications } from "../../hooks/useNotifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="font-medium">Notificações</span>
          {unreadCount > 0 && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={markAllRead}
            >
              Marcar todas como lidas
            </button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhuma notificação
            </p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className="cursor-pointer border-b px-4 py-3 hover:bg-muted/50"
                onClick={() => markRead(n.id)}
              >
                <p className="text-sm font-medium">{n.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
```

Adicionar `<NotificationBell />` ao layout principal (header/navbar) ao lado do `AccountMenu`.

---

## Como notificações são disparadas

Outros specs chamam `notify()` do `notifications.service`:

```python
# Exemplo — em places/tasks.py (purge_expired_trash):
from notifications.service import notify, NotificationType

notify(
    user=place.user,
    notification_type=NotificationType.TRASH_EXPIRY,
    title="Lugares serão excluídos permanentemente",
    body=f"{count} lugar(es) na lixeira será(ão) excluído(s) em breve.",
)
```

Se já existe notificação não lida do mesmo tipo, `notify()` retorna `None` sem criar duplicata.

---

## Verificação

```bash
scripts/dev-check.sh backend
scripts/dev-check.sh frontend
```

Teste manual:
1. Chamar `notify()` duas vezes para o mesmo usuário/tipo → verificar que só 1 notificação foi criada
2. `GET /api/notifications/` → lista somente não lidas e não expiradas
3. `POST /api/notifications/{id}/read/` → `read_at` preenchido, some da lista
4. No frontend: badge com contagem, clique marca como lida, "Marcar todas" limpa tudo
