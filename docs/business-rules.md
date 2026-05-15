# Business Rules — Bora Ali

Diário pessoal de lugares: o usuário registra locais, visitas e itens consumidos.

---

## Modelo de domínio

```
User
 └─ Place (1–N)
     └─ Visit (1–N)
         └─ VisitItem (1–N)
```

Toda entidade tem `public_id` (UUID) exposto na API. O `id` interno nunca é exposto.

---

## Autenticação

### Sessão única (SingleSession)

- Cada usuário possui exatamente **um** `UserSession` ativo.
- O JWT carrega um campo `session_key`. A cada request autenticada o backend valida `session_key` contra o cache Valkey (TTL 270 s).
- `ROTATE_REFRESH_TOKENS=True`: a cada refresh o `session_key` é rotacionado e o cache é invalidado — logins em outros dispositivos são derrubados imediatamente.

### Tokens

| Token       | TTL    | Ação no logout        |
|-------------|--------|-----------------------|
| access      | 30 min | descartado            |
| refresh     | —      | blacklisted no logout |

### Registro

- `username` + `email` + `password`.
- Requer aceitação dos Termos (`terms_accepted_at` + `terms_version` em `UserProfile`).
- Cloudflare Turnstile obrigatório (widget no frontend, validado no backend).
- Throttle: 10 req/min por IP (CIDRs privados isentos).

### Google OAuth

- `POST /api/auth/google/` com `id_token`.
- Cria ou recupera usuário (pelo `google_sub`). Campo `is_google_account=True`.
- Usuários Google **não podem alterar senha** (bloqueio no serializer).

### Troca de senha

- Apenas usuários não-Google.
- Requer `old_password` + `new_password`. Throttle de auth aplicado.

### Perfil (`/api/auth/me/`)

- `GET` e `PATCH` apenas (PUT bloqueado — evita sobrescrita acidental de campos opcionais).
- Campos editáveis: `nickname`, `profile_photo`.

---

## Place

### Status

| Valor             | Significado              |
|-------------------|--------------------------|
| `want_to_visit`   | Quero visitar (padrão)   |
| `visited`         | Já visitei               |
| `favorite`        | Favorito                 |
| `would_not_return`| Não voltaria             |

### Campos obrigatórios

- `name` (max 200)
- `status` (default `want_to_visit`)

### Campos opcionais

- `category` (max 100)
- `address` (max 300)
- `instagram_url`
- `maps_url` (max 2000) — dispara resolução de coordenadas
- `notes`
- `cover_photo` (imagem; processada via `ImageService`)
- `latitude` / `longitude` (Decimal 10,7)

### Coordenadas

- `coords_status`: `pending` → `resolved` | `failed`
- Quando `maps_url` é salvo: task Celery `resolve_place_coords` é enfileirada **após** commit (`transaction.on_commit`).
- A task extrai lat/lng via regex da URL do Google Maps.
- Retry: 3 tentativas com backoff exponencial (60 s, 120 s, 240 s).
- `coords_status` default: `resolved` (sem maps_url).

### Soft delete

- `deleted_at` não nulo = excluído (soft delete).
- Excluir um `Place` faz soft delete em cascata de todos os seus `Visit` e `VisitItem` (dentro de `transaction.atomic()`).
- Lugares excluídos ficam na **Lixeira** (`GET /api/places/trash/`).
- **Restaurar** (`POST /api/places/{id}/restore/`) limpa `deleted_at` em cascata.
- **Excluir permanentemente** (`DELETE /api/places/{id}/permanent/`) só funciona em lugares já soft-deletados.

### Filtros e busca

- Busca textual: `name`, `category`, `address`.
- Filtro por `status`.
- Ordenação: `created_at`, `updated_at`, `name`.

### Imagem (cover_photo)

- Path: `users/{user_id}/places/covers/{sha256[:16]}_{timestamp_ms}` (sem extensão).
- Criptografia Fernet por usuário (chave derivada do `SECRET_KEY` + `user_id`).
- `GET /api/media/<path>` autentica JWT, verifica `user_id` no path, retorna 404 se não autorizado (nunca 403).
- Update: imagem antiga é deletada antes de salvar a nova.

### Isolamento

Todos os querysets são filtrados por `request.user`. Um usuário jamais vê dados de outro.

---

## Visit

### Campos obrigatórios

- `visited_at` (datetime)

### Campos opcionais

- `environment_rating` (0–10, 2 casas decimais)
- `service_rating` (0–10, 2 casas decimais)
- `overall_rating` (0–10, 2 casas decimais)
- `would_return` (boolean, default `True`)
- `general_notes`
- `photo` (imagem; path `visits/photos/`)

### Soft delete

- `deleted_at` não nulo = excluído.
- Excluir uma `Visit` faz soft delete em cascata de todos os seus `VisitItem`.

### Ordenação padrão

`-visited_at` (mais recente primeiro).

---

## VisitItem

Item consumido durante uma visita (prato, bebida, etc.).

### Tipos

`sweet` · `savory` · `drink` · `coffee` · `juice` · `dessert` · `other`

### Campos obrigatórios

- `name` (max 200)
- `type` (default `other`)

### Campos opcionais

- `rating` (0–10)
- `price` (≥ 0; API retorna string, frontend converte com `String(price)`)
- `would_order_again` (boolean, default `True`)
- `notes`
- `photo` (imagem; path `visit_items/photos/`)

### Soft delete

- `deleted_at` não nulo = excluído (sem cascata).

---

## API — Endpoints

```
GET  /api/health/

POST /api/auth/register/
POST /api/auth/login/
POST /api/auth/refresh/
POST /api/auth/logout/
GET  /api/auth/me/
PATCH /api/auth/me/
POST /api/auth/google/
POST /api/auth/password/change/
POST /api/auth/terms/accept/

GET  /api/places/                    lista (filtro/busca/paginação)
POST /api/places/                    cria
GET  /api/places/trash/              lixeira
GET  /api/places/{id}/               detalhe
PATCH /api/places/{id}/              edita
DELETE /api/places/{id}/             soft delete
POST /api/places/{id}/restore/       restaura da lixeira
DELETE /api/places/{id}/permanent/   exclui permanentemente

GET  /api/places/{id}/visits/        lista visitas do lugar
POST /api/places/{id}/visits/        cria visita no lugar

GET  /api/visits/{id}/               detalhe da visita
PATCH /api/visits/{id}/              edita visita
DELETE /api/visits/{id}/             soft delete

POST /api/visits/{id}/items/         adiciona item à visita
PATCH /api/visit-items/{id}/         edita item
DELETE /api/visit-items/{id}/        soft delete

GET  /api/media/<path>               serve mídia autenticada
```

---

## Frontend — Páginas e fluxos

| Rota                    | Página               | Fluxo principal                                      |
|-------------------------|----------------------|------------------------------------------------------|
| `/login`                | LoginPage            | email + senha → JWT → redirect /places               |
| `/register`             | RegisterPage         | cadastro + Turnstile → auto-login                    |
| `/places`               | PlacesPage           | lista paginada (4/página), busca, filtro por status, mapa toggle |
| `/places/new`           | NewPlacePage         | formulário de criação de lugar                       |
| `/places/:id`           | PlaceDetailPage      | detalhe + lista de visitas                           |
| `/places/:id/edit`      | EditPlacePage        | edição de lugar                                      |
| `/places/:id/visits/new`| NewVisitPage         | criar visita + items inline                          |
| `/visits/:id/edit`      | EditVisitPage        | editar visita + items                                |
| `/account`              | AccountPage          | perfil, foto, senha, termos                          |
| `/trash`                | TrashPage            | lixeira de lugares                                   |

### Autenticação no frontend

- `AuthContext` fornece `user`, `login`, `logout`.
- `api.ts`: Bearer token no header, 401 → tenta refresh → se falhar, logout.
- Sessão expirada detectada por código específico → redirect `/login`.

### Formulários

- Todos usam **React Hook Form + Zod**.
- Erros de API mapeados para campos via `applyApiErrors`.
- `cover_photo` / `photo`: estado local `File | null`, nunca campo RHF, adicionado no submit.

### Listagem de lugares

- Paginação via **Carousel** (swipe + `PaginationDots`).
- Cache de páginas em memória (`pageCache`) — não refaz fetch de páginas já visitadas.
- Filtros (status + busca) resetam cache e voltam para página 1.
- Mapa: carrega todos os lugares (sem paginação) para exibir pins.

---

## Invariantes globais

1. Todo queryset filtrado por `request.user` — sem vazamento entre usuários.
2. `public_id` exposto; `id` interno jamais exposto.
3. Exceções de negócio via `core.exceptions`.
4. Imagens sempre via `core.image_service.ImageService`.
5. Migrations não são criadas automaticamente pela LLM.
6. Formulários frontend sempre React Hook Form + Zod.
7. Histórico de alterações via `simple_history` em todos os modelos principais.
