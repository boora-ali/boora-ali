# Feat — Compartilhamento de Collections (snapshot)

> **Status: draft**

## Problema

Collections hoje são privadas e vivas. O usuário consegue organizar places, mas não consegue
compartilhar uma coleção inteira como um recorte estável do que ela era naquele momento.

Isso cria dois problemas:

1. Não existe link público para mostrar uma coleção para outra pessoa.
2. Mesmo que exista um link, ele não pode depender da collection viva, porque a composição
   muda com o tempo.

Como o user pediu explicitamente, este share precisa ser um **snapshot**:

- a coleção compartilhada não pode refletir edições futuras da collection original
- a mídia e as capas dos places precisam ser congeladas
- o link público precisa ser revogável

---

## Objetivo

1. Dono gera um link público opaco para uma collection
2. O link abre uma página pública sem autenticação
3. A página mostra a collection como ela estava no momento do share
4. Places, capa, nome, categoria, endereço e demais campos públicos ficam congelados
5. O dono pode revogar o link depois

---

## Escopo funcional

### Inclui

- criar share de collection a partir de uma collection própria
- materializar um snapshot da collection
- copiar e congelar mídia/capas dos places do snapshot
- expor uma página pública do snapshot
- revogar o token

### Não inclui

- importar collection para a conta de outro usuário
- edição pública do snapshot
- comentários, likes, reações ou feed social
- tornar o share indexável por Google

---

## Contrato público

### 1. Criar share

`POST /api/collections/{public_id}/share/`

Auth: obrigatória.

Comportamento:
- valida que a collection pertence ao usuário autenticado
- cria um `CollectionShare` novo, mesmo que já exista outro share ativo para a mesma collection
- materializa os places da collection em registros snapshot
- copia as capas de cada place para storage próprio do share
- se qualquer etapa de snapshot/mídia falhar, a criação deve abortar sem publicar um link quebrado
- retorna token e URL pública

Resposta esperada:

```json
{
  "token": "p5P7...",
  "url": "https://booraali.com.br/share/collections/p5P7..."
}
```

### 2. Ler share público

`GET /api/share/collections/{token}/`

Auth: nenhuma.

Comportamento:
- valida token ativo
- devolve somente o snapshot congelado
- nunca expõe o model vivo da collection

Resposta esperada:

```json
{
  "name": "SP de café",
  "emoji": "☕",
  "description": "lugares para voltar depois",
  "place_count": 12,
  "places": [
    {
      "source_public_id": "3b8f...",
      "name": "Café X",
      "category": "cafe",
      "address": "Rua Y, 123",
      "maps_url": "https://maps.google.com/...",
      "instagram_url": "",
      "status": "want_to_visit",
      "cover_photo_url": "https://booraali.com.br/api/share/collections/{token}/media/..."
    }
  ]
}
```

### 3. Revogar share

`DELETE /api/collections/{public_id}/share/{token}/`

Auth: obrigatória.

Comportamento:
- valida ownership
- desativa o token
- o link público passa a responder 404

### 4. Servir mídia congelada

`GET /api/share/collections/{token}/media/{path}`

Auth: nenhuma.

Comportamento:
- valida `sig` e `exp`
- valida que o path pertence ao snapshot daquele token
- lê a mídia congelada do storage
- descriptografa quando necessário
- responde com bytes da imagem

---

## Modelo de dados

### `CollectionShare`

Campos esperados:
- `token`
- `owner`
- `source_collection`
- `snapshot_name`
- `snapshot_emoji`
- `snapshot_description`
- `is_active`
- `created_at`

### `CollectionSharePlaceSnapshot`

Campos esperados:
- `share`
- `source_place_public_id`
- `name`
- `category`
- `address`
- `instagram_url`
- `maps_url`
- `coords_status`
- `latitude`
- `longitude`
- `status`
- `notes` opcional, se for útil para exibição
- `cover_photo_path`
- `cover_photo_url` derivado
- `order_index`
- `created_at`

### Observação de desenho

O snapshot deve ser materializado na criação do share. Não deve depender do queryset da
collection original depois do token ser emitido.

---

## Estratégia de mídia

Como o user quer mídia e capas congeladas, o share não pode apontar para os paths vivos dos
places originais.

Estratégia proposta:

- copiar bytes da capa de cada place no momento do share
- salvar em um namespace próprio do share
- usar `ImageService` para salvar e, se preciso, recriptografar
- o snapshot usa somente esse storage próprio

Path sugerido:

- `collection_shares/<token>/places/<source_place_public_id>/covers/...`

Isso garante:

- editar o place original não altera o share
- trocar a capa do place original não altera o share
- apagar o place original não quebra o link público enquanto o share existir

---

## Regras de negócio

- a share collection é um snapshot, não um alias da collection viva
- cada share novo pode gerar um token novo mesmo para a mesma collection
- revogar um token não apaga a collection original
- o snapshot mantém a ordem dos places no momento da criação
- se um place não tiver capa, o snapshot continua válido sem mídia
- a criação do share é atômica: se a cópia de mídia ou a materialização de algum place falhar,
  nada deve ser publicado publicamente

---

## Rotas frontend

### Público

- `/share/collections/:token`

Regras:
- sem auth obrigatória
- `noindex`
- mostra os places congelados e a capa congelada

### Ação do dono

- botão “Compartilhar coleção” na detail page da collection
- modal ou sheet com URL e copy-link
- botão “Revogar link”

---

## Integração com o sistema atual

### Reuso

- `ImageService` para salvar / ler / descriptografar mídia
- `build_public_media_url` para montar URLs públicas assinadas
- padrão de `MutationMixin` e `APIView` usado no share de place
- `Collection` e `CollectionPlace` como fonte privada do snapshot

### Django patterns aplicados

O desenho deve seguir estas regras do projeto e do skill:

- lógica de negócio em `services.py`, não espremida na view
- view fina, responsável por autenticação, validação de request e resposta
- serialização separada para o contrato público do snapshot
- `transaction.atomic()` envolvendo a criação do share e a materialização dos snapshots
- queryset do detalhe público pré-carregado para evitar N+1 quando montar a lista de places
- `select_related` / `prefetch_related` em campos de snapshot e mídia, nunca dependência de lazy loading
- rotas públicas explícitas em `urls.py`, sem reutilizar o fluxo vivo de `Collection`
- a tarefa de cópia de mídia, se existir, deve ser idempotente e disparada só quando a atomização da criação exigir

### Boundary backend

O backend precisa separar claramente:

- `Collection` viva, privada, mutável
- `CollectionShare`, imutável e revogável
- `CollectionSharePlaceSnapshot`, contrato materializado do momento do share

Essa separação evita o erro clássico de “share vivo mascarado de snapshot”.

### Não reusar

- `Collection` viva como fonte do público
- `PlaceShare` de place como modelo direto para collection share

Essa feature precisa de um modelo próprio porque o comportamento é diferente:
o share de place é um token por place; o share de collection é um snapshot de um conjunto.

---

## Página pública do share

### Direção visual

Aplicando `impeccable`, a página pública não deve parecer uma lista genérica nem uma tabela
de administração disfarçada. O tom é editorial, de diário de lugares, com sensação de
recorte preservado.

### Princípios visuais

- hero com a identidade da collection, não com um card de dashboard
- hierarquia forte no nome da collection, com subtítulo curto e data/estado do snapshot
- grid de places assimétrico, evitando repetição mecânica de cards iguais
- capas congeladas com moldura clara, para reforçar que aquilo é um recorte fixo
- metadados úteis, mas discretos, sem poluir a leitura
- CTA secundária para copiar link, nunca CTA agressiva de edição
- estado vazio elegante quando a collection não tiver places no snapshot

### Composição sugerida

- topo com nome, emoji e descrição da collection
- faixa curta mostrando que o conteúdo é um snapshot congelado
- lista visual dos places com capa, nome, categoria e endereço
- cada place preserva sua imagem e suas informações públicas no momento do share
- rodapé simples com link de volta ao app e aviso de privacidade

### Evitar

- cards genéricos com mesma altura e mesma densidade
- visual de SaaS azul/cinza padrão
- hero numérico com métricas vazias
- modal como primeira resposta para qualquer ação
- gradientes chamativos sem função

### Acessibilidade e leitura

- contraste consistente no texto do snapshot
- foco visível nos botões do share
- labels claras para copy link e revogar
- carregamento de mídia com skeleton ou placeholder estável

### SEO / indexação

- a página pública do share deve continuar `noindex`
- o valor de SEO vem da landing e dos perfis públicos, não desse snapshot tokenizado
- a página precisa ser facilmente compartilhável por rede social, mas não indexável

---

## Arquivos que devem mudar

| Arquivo | O que muda |
|---|---|
| `backend/places/models.py` | `CollectionShare` + `CollectionSharePlaceSnapshot` |
| `backend/places/services.py` | serviço de snapshot, mídia congelada e revogação |
| `backend/places/views.py` | views de create/detail/media/revoke |
| `backend/places/urls.py` | rotas públicas de collection share |
| `backend/places/serializers.py` | serializers do snapshot público |
| `backend/places/tasks.py` | task opcional se a cópia de mídia precisar sair da request |
| `backend/places/tests/` | testes de contrato, snapshot e mídia |
| `frontend/src/services/` | service do share de collection |
| `frontend/src/routes/CollectionDetailPage.tsx` | ação de compartilhar collection |
| `frontend/src/routes/CollectionSharePage.tsx` | página pública do snapshot |
| `frontend/src/App.tsx` | rota pública da collection share |

---

## Critérios de aceitação

1. Criar share gera um token e URL pública
2. A URL pública mostra a coleção mesmo sem login
3. O conteúdo exibido corresponde ao estado do momento do share
4. Alterar a collection viva depois não muda o snapshot
5. Alterar capa de um place original depois não muda a capa do snapshot
6. Revogar o token faz o link passar a responder 404
7. Os testes garantem que o snapshot não depende da collection viva

---

## Testes esperados

### Backend

- cria share com snapshot completo
- retorna 404 para token revogado
- preserva ordem dos places
- preserva mídia congelada
- não quebra quando a collection original muda depois

### Frontend

- página pública abre sem autenticação
- mostra lista congelada
- mostra estado de loading da mídia
- não deixa o link indexável

---

## Decisão de produto

Escolha assumida neste spec:

- share de collection é **snapshot imutável**
- mídia e capas são congeladas
- não existe import de collection nesta fase

Se o produto quiser depois um “import collection”, isso deve virar uma feature separada.
