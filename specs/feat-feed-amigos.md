# Feat — Feed de Amigos

## Problema

Não há forma de descobrir places de outras pessoas ou acompanhar o que amigos estão
adicionando/visitando. O app é 100% isolado por usuário. Usuários precisam trocar links
manualmente (`feat-place-sharing.md`) sem contexto de quem recomendou o quê.

---

## Objetivo

1. Usuário segue/deixa de seguir outros usuários com perfil público
2. Feed cronológico exibe places públicos recém-adicionados por quem o usuário segue
3. Feed paginado com cursor (sem offset — evita drift em tempo real)
4. Botão de follow visível na `PublicProfilePage`

---

## Skills a invocar antes de implementar

Backend:
- `/django-expert` — M2M, cursor pagination, queryset com select_related, annotate
- `/django-patterns` — CursorPagination, Follow queryset, índices de performance
- `/bora-ali-backend` — PublicIdModel, MutationMixin, convenções de viewset e URL

Frontend:
- `/bora-ali-frontend` — React Query infinite scroll, serviços de API
- `/frontend-design` — Card, Avatar, Badge, Button (shadcn/ui)
- `/impeccable` — feed com divide-y, formatação de data relativa, empty e error states
- `/design-taste-frontend` — follow/unfollow optimistic update, feed item layout

> **Dependências**: `feat-perfil-publico.md` — obrigatório.
> `is_public` em Place e UserProfile precisam existir antes deste feature.

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/accounts/models.py` | Adicionar model `Follow` |
| `backend/accounts/views.py` | `FollowView` (POST/DELETE), `FeedView` (GET) |
| `backend/accounts/serializers.py` | `FeedItemSerializer` |
| `backend/accounts/urls.py` | Registrar `/u/:username/follow/` e `/feed/` |
| `backend/accounts/migrations/` | `makemigrations accounts` após criar `Follow` |
| `frontend/src/services/social.service.ts` | `follow()`, `unfollow()`, `getFeed()` + tipos `FeedItem` (novo) |
| `frontend/src/services/auth.service.ts` | `PublicProfile` extendido com `is_following: boolean` |
| `frontend/src/routes/FeedPage.tsx` | Feed com infinite scroll (nova) |
| `frontend/src/routes/PublicProfilePage.tsx` | Botão follow/unfollow |
| `frontend/src/App.tsx` | Registrar rota `/feed` dentro do `PrivateRoute` |

---

## Implementação passo a passo

### 1. `accounts/models.py` — model `Follow`

```python
# backend/accounts/models.py
class Follow(models.Model):
    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="following"
    )
    following = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="followers"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounts_follow"
        # unique_together está deprecated no Django 4.2+ — usar UniqueConstraint
        constraints = [
            models.UniqueConstraint(
                fields=["follower", "following"],
                name="follow_unique_follower_following",
            ),
            # clean() NÃO é chamado por get_or_create()/save() — garantia fica no DB
            models.CheckConstraint(
                check=~models.Q(follower=models.F("following")),
                name="follow_no_self_follow",
            ),
        ]
        indexes = [
            models.Index(fields=["follower", "created_at"]),
            # índice inverso: lookups "quem segue X" e contagem de seguidores
            models.Index(fields=["following", "created_at"]),
        ]
```

> Rodar `python manage.py makemigrations accounts` após criar o model.

### 2. `accounts/views.py` — `FollowView`

```python
# backend/accounts/views.py
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from core.views import MutationMixin
from .models import UserProfile, Follow
from places.models import Place

class FollowView(MutationMixin, APIView):
    permission_classes = [IsAuthenticated]

    def _get_target(self, username):
        # select_related("user") evita query extra em profile.user logo abaixo
        profile = get_object_or_404(
            UserProfile.objects.select_related("user"),
            username=username,
            is_public=True,
        )
        if profile.user == self.request.user:
            raise DRFValidationError({"detail": "Você não pode seguir a si mesmo."})
        return profile.user

    def post(self, request, username):
        target = self._get_target(username)
        Follow.objects.get_or_create(follower=request.user, following=target)
        return Response(status=201)

    def delete(self, request, username):
        target = self._get_target(username)
        Follow.objects.filter(follower=request.user, following=target).delete()
        return Response(status=204)
```

### 3. `accounts/views.py` — `FeedView`

```python
# backend/accounts/views.py
from rest_framework.pagination import CursorPagination

class FeedCursorPagination(CursorPagination):
    page_size = 20
    ordering = "-created_at"
    cursor_query_param = "cursor"


class FeedView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # values_list lazy → Django combina numa única query com subselect
        following_ids = Follow.objects.filter(
            follower=request.user
        ).values_list("following_id", flat=True)

        # Atenção: Place.objects.live() assume PlaceQuerySet com método live().
        # Verificar em places/managers.py. Se não existir, substituir pelo
        # filtro equivalente (ex: .filter(deletion_requested_at__isnull=True)).
        places = Place.objects.live().filter(
            user__in=following_ids,
            is_public=True,
        ).select_related("user__profile").order_by("-created_at")

        paginator = FeedCursorPagination()
        page = paginator.paginate_queryset(places, request)
        serializer = FeedItemSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
```

### 4. `accounts/serializers.py` — `FeedItemSerializer`

```python
# backend/accounts/serializers.py
class FeedItemSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source="user.profile.username")
    # cover_photo não exposta — place público não tem signed URL aqui (MVP)
    # Extensão futura: thumbnail pública via campo separado

    class Meta:
        model = Place
        fields = [
            "public_id", "name", "category", "address", "status",
            "maps_url", "instagram_url", "created_at", "author_username",
        ]
```

### 5. `accounts/urls.py` — registrar rotas

```python
# backend/accounts/urls.py
path("u/<str:username>/follow/", FollowView.as_view()),
path("feed/", FeedView.as_view()),
```

### 6. `PublicProfileView` — incluir `is_following`

```python
# backend/accounts/views.py — em PublicProfileView.get()
is_following = False
if request.user.is_authenticated:
    is_following = Follow.objects.filter(
        follower=request.user, following=profile.user
    ).exists()

data = PublicProfileSerializer(profile.user).data
data["is_following"] = is_following
return Response(data)
```

### 7. `auth.service.ts` — atualizar tipo `PublicProfile`

> `feat-perfil-publico.md` define `PublicProfile`. Agora que `PublicProfileView` retorna
> `is_following`, o tipo precisa ser extendido:

```typescript
// frontend/src/services/auth.service.ts — atualizar interface PublicProfile
export interface PublicProfile {
  username: string;
  bio: string;
  places: PublicPlace[];
  is_following: boolean;  // adicionado em feat-feed-amigos
}
```

### 8. Frontend — `services/social.service.ts`

```typescript
// frontend/src/services/social.service.ts
import { api } from "@/lib/api";

export interface FeedItem {
  public_id: string;
  name: string;
  category: string;
  address: string;
  status: string;
  maps_url: string | null;
  instagram_url: string | null;
  created_at: string;
  author_username: string;
}

export const socialService = {
  follow: (username: string) => api.post(`/api/u/${username}/follow/`),
  unfollow: (username: string) => api.delete(`/api/u/${username}/follow/`),
  getFeed: (cursor?: string) =>
    api.get<{ results: FeedItem[]; next: string | null; previous: string | null }>(
      "/api/feed/",
      { params: cursor ? { cursor } : {} },
    ),
};
```

### 9. Frontend — `FeedPage.tsx` com infinite scroll

```tsx
// frontend/src/routes/FeedPage.tsx
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { socialService } from "@/services/social.service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatRelativeDate(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
}

export function FeedPage() {
  const { t } = useTranslation();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ["feed"],
    queryFn: ({ pageParam }) => socialService.getFeed(pageParam as string | undefined),
    initialPageParam: undefined,  // obrigatório no React Query v5
    getNextPageParam: (last) => last.next ?? undefined,
  });

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2 p-4 border rounded-lg">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-36" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-lg mx-auto p-4">
        <p className="text-sm text-destructive text-center py-8">{t("feed.error")}</p>
      </div>
    );
  }

  const items = data?.pages.flatMap((p) => p.results) ?? [];

  return (
    <div className="max-w-lg mx-auto p-4">
      <h1 className="text-xl font-semibold mb-4">{t("feed.title")}</h1>

      {items.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-12">
          {t("feed.empty")}
        </p>
      )}

      {/* Lista com divide-y — sem Card idêntico repetido (impeccable: "identical card grids banned") */}
      <div className="divide-y">
        {items.map((item) => (
          <div key={item.public_id} className="py-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">@{item.author_username}</span>
              <span>·</span>
              <span>{formatRelativeDate(item.created_at)}</span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Badge variant="secondary" className="text-xs mb-1">{item.category}</Badge>
                <p className="font-medium truncate">{item.name}</p>
                <p className="text-sm text-muted-foreground truncate">{item.address}</p>
              </div>
              {item.maps_url && (
                <a
                  href={item.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-1"
                >
                  <MapPin className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasNextPage && (
        <Button variant="ghost" className="w-full mt-2" onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}>
          {isFetchingNextPage ? t("feed.loading") : t("feed.load_more")}
        </Button>
      )}
    </div>
  );
}
```

> `date-fns` e `date-fns/locale` devem estar em `package.json`. Verificar antes de implementar.
> Se não estiver, usar `npm install date-fns`.

### 10. `PublicProfilePage.tsx` — botão follow/unfollow

```tsx
// frontend/src/routes/PublicProfilePage.tsx
// Adicionar ao componente existente (junto com useQuery já presente)
const { user } = useAuth();
const queryClient = useQueryClient();

const followMutation = useMutation({
  mutationFn: (isFollowing: boolean) =>
    isFollowing ? socialService.unfollow(username!) : socialService.follow(username!),

  // Optimistic update — UI atualiza instantaneamente sem esperar o servidor
  onMutate: async (isFollowing) => {
    await queryClient.cancelQueries({ queryKey: ["profile", username] });
    const prev = queryClient.getQueryData(["profile", username]);
    queryClient.setQueryData(["profile", username], (old: any) => ({
      ...old,
      is_following: !isFollowing,
    }));
    return { prev };
  },
  onError: (_err, _vars, context) => {
    // Rollback em caso de erro
    queryClient.setQueryData(["profile", username], context?.prev);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ["profile", username] });
  },
});

// Inserir no header do perfil (no slot reservado em PublicProfilePage):
{user && (
  <Button
    variant={data?.is_following ? "outline" : "default"}
    size="sm"
    disabled={followMutation.isPending}
    onClick={() => followMutation.mutate(data?.is_following ?? false)}
  >
    {data?.is_following ? t("profile.unfollow") : t("profile.follow")}
  </Button>
)}
```

### 11. Traduções i18n (pt-BR)

```json
"feed.title": "Feed",
"feed.empty": "Siga outras pessoas para ver o que elas estão descobrindo",
"feed.loading": "Carregando...",
"feed.load_more": "Ver mais",
"feed.error": "Erro ao carregar o feed. Tente novamente.",
"profile.follow": "Seguir",
"profile.unfollow": "Deixar de seguir"
```

---

## O que este feature não inclui (YAGNI)

- Notificação quando alguém segue você (extensão via `feat-notifications.md`)
- Contador de seguidores/seguindo no perfil
- Sugestão de pessoas para seguir
- Feed com visitas (só places por ora)
- Foto de capa no feed item (requer endpoint de mídia pública)
- Busca de usuários por username

---

## Verificação

```bash
scripts/dev-check.sh backend
scripts/dev-check.sh frontend
```

Teste manual:
1. Usuário A com perfil público + 3 places públicos
2. Usuário B: `POST /api/u/user-a/follow/` → 201
3. `GET /api/feed/` como usuário B → 3 places de A no resultado
4. Usuário A torna place `is_public=false` → some do feed de B
5. `DELETE /api/u/user-a/follow/` → feed de B vazio novamente
6. Frontend: PublicProfilePage mostra botão follow; FeedPage lista cards com autor
