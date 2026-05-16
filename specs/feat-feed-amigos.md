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
- `/bora-ali-backend` — PublicIdModel, MutationMixin, convenções de viewset e URL

Frontend:
- `/bora-ali-frontend` — React Query infinite scroll, serviços de API
- `/frontend-design` — Card, Avatar, Badge, Button (shadcn/ui)

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
| `frontend/src/services/social.service.ts` | `follow()`, `unfollow()`, `getFeed()` (novo) |
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
        unique_together = [("follower", "following")]
        indexes = [
            models.Index(fields=["follower", "created_at"]),
        ]

    def clean(self):
        if self.follower_id == self.following_id:
            raise ValidationError("Usuário não pode seguir a si mesmo.")
```

> Rodar `python manage.py makemigrations accounts` após criar o model.

### 2. `accounts/views.py` — `FollowView`

```python
# backend/accounts/views.py
from core.views import MutationMixin

class FollowView(MutationMixin, APIView):
    permission_classes = [IsAuthenticated]

    def _get_target(self, username):
        profile = get_object_or_404(UserProfile, username=username, is_public=True)
        if profile.user == self.request.user:
            raise ValidationError({"detail": "Você não pode seguir a si mesmo."})
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
        following_ids = Follow.objects.filter(
            follower=request.user
        ).values_list("following_id", flat=True)

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

### 7. Frontend — `services/social.service.ts`

```typescript
// frontend/src/services/social.service.ts
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
    api.get<{ results: FeedItem[]; next: string | null }>("/api/feed/", {
      params: cursor ? { cursor } : {},
    }),
};
```

### 8. Frontend — `FeedPage.tsx` com infinite scroll

```tsx
// frontend/src/routes/FeedPage.tsx
export function FeedPage() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["feed"],
    queryFn: ({ pageParam }) => socialService.getFeed(pageParam as string | undefined),
    getNextPageParam: (last) => last.next ?? undefined,
  });

  const items = data?.pages.flatMap((p) => p.results) ?? [];

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">{t("feed.title")}</h1>
      {items.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-8">
          {t("feed.empty")}
        </p>
      )}
      {items.map((item) => (
        <Card key={item.public_id} className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>@{item.author_username}</span>
            <span>·</span>
            <span>{formatRelativeDate(item.created_at)}</span>
          </div>
          <Badge>{item.category}</Badge>
          <p className="font-medium">{item.name}</p>
          <p className="text-sm text-muted-foreground">{item.address}</p>
        </Card>
      ))}
      {hasNextPage && (
        <Button variant="ghost" className="w-full" onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}>
          {isFetchingNextPage ? t("feed.loading") : t("feed.load_more")}
        </Button>
      )}
    </div>
  );
}
```

### 9. `PublicProfilePage.tsx` — botão follow/unfollow

```tsx
// frontend/src/routes/PublicProfilePage.tsx
const { user } = useAuth();
const queryClient = useQueryClient();

const followMutation = useMutation({
  mutationFn: (isFollowing: boolean) =>
    isFollowing ? socialService.unfollow(username!) : socialService.follow(username!),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile", username] }),
});

{user && (
  <Button
    variant={data?.is_following ? "outline" : "default"}
    onClick={() => followMutation.mutate(data?.is_following ?? false)}
  >
    {data?.is_following ? t("profile.unfollow") : t("profile.follow")}
  </Button>
)}
```

### 10. Traduções i18n (pt-BR)

```json
"feed.title": "Feed",
"feed.empty": "Siga outras pessoas para ver o que elas estão descobrindo",
"feed.loading": "Carregando...",
"feed.load_more": "Ver mais",
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
