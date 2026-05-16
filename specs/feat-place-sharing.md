# Feat — Compartilhamento de Places entre usuários

## Problema

Não há como compartilhar um place com outra pessoa. O app é 100% privado — um usuário não
consegue enviar uma recomendação de lugar para um amigo nem importar recomendações recebidas.

---

## Objetivo

1. Dono gera um link público com token opaco (permanente, revogável)
2. Destinatário abre o link sem precisar de conta — vê nome, categoria, endereço, mapa e cover photo
3. Se logado, pode importar o place para a própria conta com um clique
4. Import copia dados textuais e re-criptografa a cover photo com a chave do importador via Celery

---

## Skills a invocar antes de implementar

Backend:
- `/django-expert` — serializers, viewsets, DRF APIView, Celery tasks
- `/bora-ali-backend` — convenções do projeto (ImageService, MutationMixin, PublicIdModel, SingleSession)

Frontend:
- `/bora-ali-frontend` — serviços de API, React Query, roteamento, i18n
- `/frontend-design` — componentes shadcn/ui (Button, Badge, Sheet)

> **Dependências**:
> - `ImageService.read_decrypted()` precisa ser criado junto (bloqueia o Celery task de import)
> - `feat-notifications.md` — opcional, pode notificar o dono quando alguém importa. Não bloqueia MVP.

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/places/models.py` | Adicionar `PlaceShare` |
| `backend/places/views.py` | `PlaceShareCreateView`, `PlaceShareDetailView`, `PlaceShareMediaView`, `PlaceShareImportView` |
| `backend/places/urls.py` | Registrar `/share/`, `/places/{id}/share/` |
| `backend/places/tasks.py` | Adicionar `copy_shared_place_photo` |
| `backend/core/image_service.py` | Adicionar `ImageService.read_decrypted()` |
| `backend/places/migrations/` | `makemigrations places` após criar `PlaceShare` |
| `frontend/src/routes/SharePage.tsx` | Página pública (nova) |
| `frontend/src/services/share.service.ts` | `createShare()`, `getShare()`, `importShare()` |
| `frontend/src/routes/PlaceDetailPage.tsx` | Adicionar `ShareButton` |
| `frontend/src/App.tsx` | Registrar rota `/share/:token` fora do `PrivateRoute` |

---

## Implementação passo a passo

### 1. `models.py` — `PlaceShare`

```python
# backend/places/models.py
import secrets

class PlaceShare(models.Model):
    # IMPORTANTE: passar a função sem chamar — secrets.token_urlsafe(32) chamaria uma vez
    # e todos os registros teriam o mesmo token.
    token = models.CharField(
        max_length=64, unique=True, db_index=True, default=secrets.token_urlsafe
    )
    place = models.ForeignKey(
        Place, on_delete=models.CASCADE, related_name="shares"
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="place_shares"
    )
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "places_place_share"
        indexes = [
            models.Index(fields=["token", "is_active"], name="share_token_active_idx"),
        ]
```

> Rodar `python manage.py makemigrations places` após criar o model.

### 2. `image_service.py` — `read_decrypted()`

```python
# backend/core/image_service.py
@staticmethod
def read_decrypted(image_field, owner_pk: int) -> bytes:
    """Lê e descriptografa uma imagem usando a chave do owner."""
    fernet = ImageService._get_fernet(owner_pk)
    raw = image_field.read()
    return fernet.decrypt(raw)
```

### 3. `views.py` — endpoints

```python
# backend/places/views.py
import hmac, hashlib, time
from django.conf import settings

def _make_signed_media_url(share_token: str, image_path: str, ttl: int = 3600) -> str:
    exp = int(time.time()) + ttl
    msg = f"{share_token}:{image_path}:{exp}".encode()
    sig = hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()
    return f"{settings.PUBLIC_BASE_URL}/api/share/{share_token}/media/{image_path}?sig={sig}&exp={exp}"


class PlaceShareCreateView(MutationMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, public_id):
        place = get_object_or_404(Place, public_id=public_id, user=request.user)
        share = PlaceShare.objects.create(place=place, owner=request.user)
        return Response({"token": share.token, "url": f"{settings.PUBLIC_BASE_URL}/share/{share.token}"})


class PlaceShareRevokeView(MutationMixin, APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, public_id, token):
        share = get_object_or_404(PlaceShare, token=token, place__public_id=public_id, owner=request.user)
        share.is_active = False
        share.save(update_fields=["is_active"])
        return Response(status=204)


class PlaceShareDetailView(APIView):
    permission_classes = []

    def get(self, request, token):
        share = get_object_or_404(PlaceShare, token=token, is_active=True)
        place = share.place
        image_url = None
        if place.cover_photo:
            image_url = _make_signed_media_url(token, str(place.cover_photo))
        return Response({
            "name": place.name,
            "category": place.category,
            "address": place.address,
            "status": place.status,
            "instagram_url": place.instagram_url,
            "maps_url": place.maps_url,
            "latitude": place.latitude,
            "longitude": place.longitude,
            "cover_photo_url": image_url,
        })


class PlaceShareMediaView(APIView):
    permission_classes = []

    def get(self, request, token, path):
        sig = request.query_params.get("sig", "")
        exp = int(request.query_params.get("exp", 0))
        if time.time() > exp:
            return Response(status=404)
        expected = hmac.new(
            settings.SECRET_KEY.encode(),
            f"{token}:{path}:{exp}".encode(),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return Response(status=404)
        share = get_object_or_404(PlaceShare, token=token, is_active=True)
        # Descriptografa com chave do dono e faz stream
        # (usar padrão do media_views.py existente, passando owner=share.owner)
        ...


class PlaceShareImportView(MutationMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, token):
        share = get_object_or_404(PlaceShare, token=token, is_active=True)
        if share.owner == request.user:
            return Response({"detail": "Você já é dono deste lugar."}, status=400)

        place = share.place
        imported = Place.objects.create(
            user=request.user,
            name=place.name,
            category=place.category,
            address=place.address,
            instagram_url=place.instagram_url,
            maps_url=place.maps_url,
            latitude=place.latitude,
            longitude=place.longitude,
            coords_status=place.coords_status,
            status=PlaceStatus.WANT_TO_VISIT,
            notes="",
        )

        if place.cover_photo:
            copy_shared_place_photo.delay(
                source_place_pk=place.pk,
                source_owner_pk=share.owner.pk,
                target_place_pk=imported.pk,
                target_owner_pk=request.user.pk,
            )

        return Response({"public_id": str(imported.public_id)}, status=201)
```

### 4. `tasks.py` — re-criptografia da foto

```python
# backend/places/tasks.py
@shared_task(bind=True, max_retries=3)
def copy_shared_place_photo(self, source_place_pk, source_owner_pk, target_place_pk, target_owner_pk):
    try:
        source_place = Place.objects.get(pk=source_place_pk)
        target_place = Place.objects.get(pk=target_place_pk)

        raw_bytes = ImageService.read_decrypted(source_place.cover_photo, owner_pk=source_owner_pk)

        from django.core.files.base import ContentFile
        ImageService.save(target_place, ContentFile(raw_bytes), category="places/covers", owner_pk=target_owner_pk)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
```

> Se a task esgotar as tentativas, o place importado existe sem foto — não é crítico.

### 5. `urls.py` — registrar rotas

```python
# backend/places/urls.py
from .views import PlaceShareCreateView, PlaceShareRevokeView

# Autenticados (dentro do router de places)
path("places/<public_id>/share/", PlaceShareCreateView.as_view()),
path("places/<public_id>/share/<str:token>/", PlaceShareRevokeView.as_view()),

# Públicos (no urls.py raiz ou separado)
path("share/<str:token>/", PlaceShareDetailView.as_view()),
path("share/<str:token>/media/<path:path>", PlaceShareMediaView.as_view()),
path("share/<str:token>/import/", PlaceShareImportView.as_view()),
```

### 6. Frontend — `services/share.service.ts`

```typescript
// frontend/src/services/share.service.ts
export const shareService = {
  createShare: (placePublicId: string) =>
    api.post<{ token: string; url: string }>(`/api/places/${placePublicId}/share/`),

  getShare: (token: string) =>
    api.get<ShareDetail>(`/api/share/${token}/`),

  importShare: (token: string) =>
    api.post<{ public_id: string }>(`/api/share/${token}/import/`),
};
```

### 7. Frontend — `SharePage.tsx` (rota pública)

```tsx
// frontend/src/routes/SharePage.tsx
export function SharePage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["share", token],
    queryFn: () => shareService.getShare(token!),
  });
  const { user } = useAuth();
  const navigate = useNavigate();
  const [importing, setImporting] = useState(false);

  async function handleImport() {
    setImporting(true);
    try {
      const result = await shareService.importShare(token!);
      navigate(`/places/${result.public_id}`);
    } finally {
      setImporting(false);
    }
  }

  if (isError) return <NotFound />;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {data?.cover_photo_url && (
        <img src={data.cover_photo_url} className="w-full rounded-xl object-cover h-56" />
      )}
      <div>
        <Badge>{data?.category}</Badge>
        <h1 className="text-2xl font-semibold mt-1">{data?.name}</h1>
        <p className="text-muted-foreground text-sm">{data?.address}</p>
      </div>
      {data?.maps_url && <a href={data.maps_url}>{t("share.view_maps")}</a>}
      {data?.instagram_url && <a href={data.instagram_url}>{t("share.view_instagram")}</a>}

      {user ? (
        <Button onClick={handleImport} disabled={importing} className="w-full">
          {importing ? t("share.importing") : t("share.import_button")}
        </Button>
      ) : (
        <Button asChild className="w-full">
          <a href={`/login?next=/share/${token}`}>{t("share.login_to_import")}</a>
        </Button>
      )}
    </div>
  );
}
```

> Rota registrada fora do `PrivateRoute` em `App.tsx`.
> Adicionar `<meta name="robots" content="noindex">` na página para não indexar.

### 8. Frontend — `ShareButton` no PlaceDetail

```tsx
function ShareButton({ placePublicId }: { placePublicId: string }) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (!shareUrl) {
      const result = await shareService.createShare(placePublicId);
      setShareUrl(result.url);
      await navigator.clipboard.writeText(result.url);
    } else {
      await navigator.clipboard.writeText(shareUrl);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleShare}>
      <Share2 className="w-4 h-4 mr-2" />
      {copied ? t("share.copied") : t("share.button")}
    </Button>
  );
}
```

### 9. Traduções i18n (pt-BR)

```json
"share.button": "Compartilhar",
"share.copied": "Link copiado!",
"share.import_button": "Adicionar à minha lista",
"share.importing": "Adicionando...",
"share.login_to_import": "Entre para adicionar à sua lista",
"share.view_maps": "Ver no Maps",
"share.view_instagram": "Instagram"
```

---

## O que este feature não inclui (YAGNI)

- Compartilhamento de coleção / múltiplos places
- Expiração automática de links
- Analytics de visualizações
- Notificação ao dono quando alguém importa (pode ser adicionado após `feat-notifications`)
- Compartilhamento de Visit ou VisitItem

---

## Verificação

```bash
scripts/dev-check.sh backend
scripts/dev-check.sh frontend
```

Teste manual:
1. `POST /api/places/{id}/share/` → retorna `{ token, url }`
2. `GET /api/share/{token}/` sem auth → retorna dados do place + `cover_photo_url` com signed URL
3. Abrir `cover_photo_url` → imagem descriptografada servida corretamente
4. `POST /api/share/{token}/import/` com auth de outro usuário → place criado, Celery task dispara
5. Após task completar → place importado tem cover photo re-criptografada
6. `DELETE /api/places/{id}/share/{token}/` → `GET /api/share/{token}/` retorna 404
7. Frontend: botão "Compartilhar" copia link, página pública renderiza, botão de import redireciona para o place
