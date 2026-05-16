# Feat — Promoção de Estabelecimento no Feed

## Problema

Após pagar (`feat-estabelecimento-pagamento.md`), o estabelecimento precisa aparecer
no feed dos usuários como card rico patrocinado. Atualmente o feed (`feat-feed-amigos.md`)
só mostra places de pessoas seguidas — não há slot para conteúdo pago.

---

## Objetivo

1. Feed de usuários tipo `PERSON` exibe cards patrocinados de campanhas ACTIVE
2. Card rico: cover photo, nome, categoria, descrição, link de cardápio, "Como chegar"
3. Badge "Patrocinado" visualmente distinto dos cards orgânicos
4. Máximo 1 card patrocinado a cada 5 cards orgânicos (não poluir o feed)

---

## Skills a invocar antes de implementar

Backend:
- `/django-expert` — queryset, serializers, paginação
- `/bora-ali-backend` — convenções de views, PublicIdModel

Frontend:
- `/bora-ali-frontend` — React Query, infinite scroll, i18n
- `/frontend-design` — Card, Badge, Button (shadcn/ui)

> **Dependências**: `feat-estabelecimento-perfil.md` + `feat-estabelecimento-pagamento.md`
> + `feat-feed-amigos.md` (feed base precisa existir).

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/establishments/serializers.py` | `SponsoredCardSerializer` |
| `backend/establishments/views.py` | `SponsoredFeedView` |
| `backend/establishments/urls.py` | Registrar `/feed/sponsored/` |
| `frontend/src/services/social.service.ts` | Adicionar `getSponsored()` |
| `frontend/src/routes/FeedPage.tsx` | Intercalar cards patrocinados |
| `frontend/src/components/SponsoredCard.tsx` | Card rico de estabelecimento (novo) |

---

## Implementação passo a passo

### 1. `serializers.py` — card rico patrocinado

```python
# backend/establishments/serializers.py
class SponsoredCardSerializer(serializers.ModelSerializer):
    """Dados do card patrocinado — sem informações sensíveis."""
    username = serializers.CharField(source="user.profile.username")
    # campaign_ends_at anotado no view — evita N+1 no serializer
    campaign_ends_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = EstablishmentProfile
        fields = [
            "public_id", "username", "business_name", "description",
            "category", "menu_url", "website_url", "phone", "campaign_ends_at",
        ]
```

### 2. `views.py` — `SponsoredFeedView`

```python
# backend/establishments/views.py
from django.db.models import Subquery, OuterRef

class SponsoredFeedView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()

        # Subquery para ends_at da campanha ACTIVE — evita N+1
        active_ends_at = PromotionCampaign.objects.filter(
            establishment=OuterRef("pk"),
            status=CampaignStatus.ACTIVE,
            ends_at__gt=now,
        ).order_by("-ends_at").values("ends_at")[:1]

        profiles = EstablishmentProfile.objects.filter(
            is_public=True,
            campaigns__status=CampaignStatus.ACTIVE,
            campaigns__ends_at__gt=now,
        ).select_related("user__profile").annotate(
            campaign_ends_at=Subquery(active_ends_at)
        ).distinct().order_by("?")[:10]

        return Response(SponsoredCardSerializer(profiles, many=True).data)
```

> `order_by("?")` aleatório no PostgreSQL é aceitável para volume baixo de patrocinadores.
> Se crescer, trocar por `order_by(random seed diário)` para consistência na sessão.

### 3. `urls.py`

```python
# backend/establishments/urls.py (adicionar)
path("feed/sponsored/", SponsoredFeedView.as_view()),
```

### 4. Frontend — `SponsoredCard.tsx`

```tsx
// frontend/src/components/SponsoredCard.tsx
interface Props {
  establishment: SponsoredEstablishment;
}

export function SponsoredCard({ establishment }: Props) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="relative">
        {/* cover photo — sem criptografia: usar placeholder até ter endpoint público */}
        <div className="h-36 bg-muted flex items-center justify-center">
          <Store className="h-10 w-10 text-muted-foreground" />
        </div>
        <Badge
          variant="secondary"
          className="absolute top-2 right-2 text-xs"
        >
          {t("feed.sponsored")}
        </Badge>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <Badge variant="outline" className="mb-1">{establishment.category}</Badge>
          <h3 className="font-semibold">{establishment.business_name}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {establishment.description}
          </p>
        </div>

        <div className="flex gap-2">
          {establishment.menu_url && (
            <Button asChild size="sm" className="flex-1">
              <a href={establishment.menu_url} target="_blank">
                {t("feed.view_menu")}
              </a>
            </Button>
          )}
          {establishment.website_url && (
            <Button asChild size="sm" variant="outline" className="flex-1">
              <a href={establishment.website_url} target="_blank">
                {t("feed.visit_site")}
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 5. `FeedPage.tsx` — intercalar patrocinados

```tsx
// frontend/src/routes/FeedPage.tsx
const { data: sponsored } = useQuery({
  queryKey: ["feed", "sponsored"],
  queryFn: socialService.getSponsored,
  staleTime: 5 * 60 * 1000, // revalidar a cada 5 min
});

// Intercalar: a cada 5 items orgânicos, inserir 1 patrocinado
function buildFeedItems(
  organic: FeedItem[],
  sponsored: SponsoredEstablishment[]
): (FeedItem | SponsoredEstablishment & { _type: "sponsored" })[] {
  const result = [];
  let sponsoredIdx = 0;

  organic.forEach((item, i) => {
    result.push(item);
    if ((i + 1) % 5 === 0 && sponsoredIdx < sponsored.length) {
      result.push({ ...sponsored[sponsoredIdx++], _type: "sponsored" as const });
    }
  });

  return result;
}

// Na renderização:
{buildFeedItems(items, sponsored ?? []).map((item, i) =>
  "_type" in item && item._type === "sponsored"
    ? <SponsoredCard key={`sp-${item.public_id}`} establishment={item} />
    : <PlaceFeedCard key={item.public_id} item={item as FeedItem} />
)}
```

### 6. `services/social.service.ts` — adicionar `getSponsored`

```typescript
// frontend/src/services/social.service.ts — adicionar ao objeto existente
getSponsored: () =>
  api.get<SponsoredEstablishment[]>("/api/feed/sponsored/"),
```

### 7. Traduções i18n (pt-BR)

```json
"feed.sponsored": "Patrocinado",
"feed.view_menu": "Ver cardápio",
"feed.visit_site": "Ver site"
```

---

## O que este feature não inclui (YAGNI)

- Impressões / cliques registrados por campanha (analytics)
- Segmentação por localização ou categoria do usuário
- Limite de frequência por usuário (não ver o mesmo patrocinador 2x seguidas)
- Cover photo pública no card (requer endpoint de mídia sem auth — extensão futura)

---

## Verificação

```bash
scripts/dev-check.sh backend
scripts/dev-check.sh frontend
```

Teste manual:
1. Criar campanha ativa via shell (`status=ACTIVE`, `ends_at` no futuro)
2. `GET /api/feed/sponsored/` como usuário PERSON → retorna estabelecimento
3. Frontend: feed com 10+ items orgânicos → card patrocinado aparece na posição 5
4. Badge "Patrocinado" visível no card
5. Campanha expirada → some do endpoint
