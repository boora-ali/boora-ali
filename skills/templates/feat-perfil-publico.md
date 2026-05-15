# Feat — Perfil Público de Usuário

## Problema

O app é 100% privado — não há como um usuário mostrar seus lugares para outra pessoa
a não ser via link de compartilhamento individual (`feat-place-sharing.md`).
Não existe conceito de "usuário com perfil público" ou "curador de lugares".

---

## Objetivo

1. Usuário define um `username` único (slug) e pode tornar o perfil público
2. Places podem ser marcados individualmente como `is_public`
3. Qualquer pessoa acessa `/u/:username` sem conta — vê nome, bio e places públicos
4. Base necessária para `feat-feed-amigos.md` (follows) e descoberta orgânica

---

## Skills a invocar antes de implementar

Backend:
- `/django-expert` — serializers, viewset público, validação de slug, migrations
- `/bora-ali-backend` — UserProfile, Place, PublicIdModel, convenções de URL

Frontend:
- `/bora-ali-frontend` — React Query, roteamento, i18n
- `/frontend-design` — Avatar, Badge, Card (shadcn/ui)

> **Dependências**: nenhuma. Bloqueia `feat-feed-amigos.md`.

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/accounts/models.py` | Adicionar `username`, `bio`, `is_public` em `UserProfile` |
| `backend/accounts/views.py` | `PublicProfileView` (GET `/api/u/:username/`) |
| `backend/accounts/serializers.py` | `PublicProfileSerializer`, `AccountSerializer` (expor novos campos) |
| `backend/accounts/urls.py` | Registrar rota pública `/u/:username/` |
| `backend/accounts/migrations/` | `makemigrations accounts` após editar `UserProfile` |
| `backend/places/models.py` | Adicionar `is_public` em `Place` |
| `backend/places/serializers.py` | `PublicPlaceSerializer` (sem dados sensíveis) |
| `backend/places/migrations/` | `makemigrations places` após editar `Place` |
| `frontend/src/routes/PublicProfilePage.tsx` | Página pública `/u/:username` (nova) |
| `frontend/src/routes/AccountPage.tsx` | Campos `username`, `bio`, toggle `is_public` |
| `frontend/src/api/profile.ts` | `getPublicProfile()`, `updateAccount()` com novos campos |
| `frontend/src/App.tsx` | Registrar rota `/u/:username` fora do `PrivateRoute` |

---

## Implementação passo a passo

### 1. `accounts/models.py` — campos em `UserProfile`

```python
# backend/accounts/models.py
import re

def _validate_username(value):
    if not re.match(r'^[a-z0-9_]{3,30}$', value):
        raise ValidationError(
            "Username deve ter 3-30 caracteres: letras minúsculas, números e _"
        )

class UserProfile(models.Model):
    # ... campos existentes ...
    username = models.CharField(
        max_length=30, unique=True, null=True, blank=True,
        db_index=True, validators=[_validate_username]
    )
    bio = models.TextField(max_length=300, blank=True, default="")
    is_public = models.BooleanField(default=False)
```

> Rodar `python manage.py makemigrations accounts` após editar o model.

### 2. `places/models.py` — campo `is_public` em `Place`

```python
# backend/places/models.py
class Place(PublicIdModel):
    # ... campos existentes ...
    is_public = models.BooleanField(default=False, db_index=True)
```

> Rodar `python manage.py makemigrations places` após editar o model.

### 3. `accounts/serializers.py` — serializer público

```python
# backend/accounts/serializers.py
class PublicPlaceSerializer(serializers.ModelSerializer):
    """Dados mínimos de um place público — sem notas nem avaliações privadas."""
    class Meta:
        model = Place
        fields = [
            "public_id", "name", "category", "address", "status",
            "maps_url", "instagram_url", "latitude", "longitude",
        ]


class PublicProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="profile.username")
    bio = serializers.CharField(source="profile.bio")
    places = serializers.SerializerMethodField()

    def get_places(self, obj):
        places = Place.objects.filter(
            user=obj,
            is_public=True,
            deleted_at__isnull=True,
        ).order_by("-created_at")[:50]
        return PublicPlaceSerializer(places, many=True).data

    class Meta:
        model = User
        fields = ["username", "bio", "places"]
```

### 4. `accounts/views.py` — `PublicProfileView`

```python
# backend/accounts/views.py
class PublicProfileView(APIView):
    permission_classes = []  # público

    def get(self, request, username):
        profile = get_object_or_404(UserProfile, username=username, is_public=True)
        serializer = PublicProfileSerializer(profile.user)
        return Response(serializer.data)
```

### 5. `accounts/urls.py` — registrar rota

```python
# backend/accounts/urls.py
path("u/<str:username>/", PublicProfileView.as_view()),
```

### 6. `AccountSerializer` — expor novos campos

```python
# backend/accounts/serializers.py
class AccountSerializer(serializers.ModelSerializer):
    # Expor username, bio, is_public via profile nested ou achatado:
    username = serializers.CharField(
        source="profile.username", required=False, allow_null=True, allow_blank=True
    )
    bio = serializers.CharField(source="profile.bio", required=False)
    is_public = serializers.BooleanField(source="profile.is_public", required=False)

    def validate_username(self, value):
        # Verificar unicidade excluindo o próprio usuário
        qs = UserProfile.objects.filter(username=value)
        if self.instance:
            qs = qs.exclude(user=self.instance)
        if qs.exists():
            raise ValidationError("Este username já está em uso.")
        return value
```

### 7. Frontend — `PublicProfilePage.tsx`

```tsx
// frontend/src/routes/PublicProfilePage.tsx
export function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { data, isError } = useQuery({
    queryKey: ["profile", username],
    queryFn: () => profileApi.getPublicProfile(username!),
  });

  if (isError) return <NotFound />;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-6">
      <Helmet>
        <title>{data?.username} — Bora Ali</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="text-center space-y-2">
        <Avatar className="mx-auto h-16 w-16">
          <AvatarFallback>{data?.username?.[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <h1 className="text-xl font-semibold">@{data?.username}</h1>
        {data?.bio && <p className="text-muted-foreground text-sm">{data.bio}</p>}
      </div>

      <div className="space-y-3">
        <h2 className="font-medium">{t("profile.public_places")}</h2>
        {data?.places.map((place) => (
          <PlaceCard key={place.public_id} place={place} />
        ))}
      </div>
    </div>
  );
}
```

### 8. `AccountPage.tsx` — campos de perfil público

```tsx
// Campos adicionados ao formulário de conta:
<Input label={t("account.username")} {...register("username")}
  placeholder="seu_username" />
<Textarea label={t("account.bio")} {...register("bio")} maxLength={300} />
<div className="flex items-center justify-between">
  <span className="text-sm">{t("account.is_public")}</span>
  <Switch {...register("is_public")} />
</div>

// Toggle por place no PlaceDetail:
<Switch
  checked={place.is_public}
  onCheckedChange={(v) => updatePlace.mutate({ is_public: v })}
  label={t("place.is_public")}
/>
```

### 9. Traduções i18n (pt-BR)

```json
"profile.public_places": "Lugares públicos",
"account.username": "Username",
"account.bio": "Bio",
"account.is_public": "Perfil público",
"place.is_public": "Visível no meu perfil público"
```

---

## O que este feature não inclui (YAGNI)

- Foto de perfil pública (profile_photo já existe mas é privado — deixar para extensão)
- Paginação de places públicos além de 50
- Verificação de conta / badge verificado
- Perfis de coleções públicas
- SEO/indexação de perfis (mantemos `noindex` por ora)

---

## Verificação

```bash
scripts/dev-check.sh backend
scripts/dev-check.sh frontend
```

Teste manual:
1. `PATCH /api/auth/me/` com `username=meuuser`, `is_public=true`
2. `GET /api/u/meuuser/` sem auth → retorna perfil + places públicos
3. Place com `is_public=false` → não aparece na resposta pública
4. `GET /api/u/meuuser/` com perfil `is_public=false` → 404
5. Frontend: `/u/meuuser` renderiza avatar, bio e cards de places
