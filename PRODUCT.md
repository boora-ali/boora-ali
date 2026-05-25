# PRODUCT.md — Boora Ali

## Product Purpose

Boora Ali é um diário pessoal de lugares. O usuário anota onde quer ir, onde já esteve e o que consumiu — um caderno analógico, mas que não se perde na gaveta.

Não é rede social. Não é guia de restaurantes. É memória afetiva de lugares: "fui aqui com quem, comi o quê, achei quanto".

**Fluxo central:** Lugar → Visita → Item consumido (consumable) → avaliação + preço.

**Camada social leve (opt-in):** Usuários com perfil público partilham lugares no feed de quem os segue. Nenhum algoritmo, nenhum engagement metric. Quem não ativa `is_public` permanece 100% privado.

**Estabelecimentos:** Negócios podem criar um perfil público em `/e/:username` com cardápio e contato. Promoção paga (PIX via Abacate Pay) insere cards no feed orgânico de usuários. Não é diretório: o card aparece no feed de quem já usa o app, não em busca pública.

## Usuários

Samuel e pessoas como ele: brasileiros que gostam de comer bem e querem lembrar dos lugares que já foram. Curioso, afetivo, avesso a burocracia. Usa o celular pra tudo. Fala pt-BR mas não estranha inglês.

Contexto de uso real: em pé na fila do restaurante tentando lembrar o nome do prato que comeu da última vez. Ou em casa, planejando onde levar amigos. Raramente na mesa com laptop.

## Brand

**Nome:** Boora Ali — gíria brasileira. "Boora" = vamo, "ali" = naquele lugar específico. Coloquial, urgente, afetivo.

**Tom:** conversa de grupo de zap. Direto, sem frescura, com carinho. Não é app corporativo. Não é startup que quer parecer cool. É ferramenta pessoal que funciona.

**Anti-referências visuais:**
- Zomato / TripAdvisor: review platform com estrelas, rankings e ads
- Notion: minimalismo cinza asséptico
- Google Maps: utilitário sem alma
- Qualquer app que pareça ter sido feito com um template de SaaS dashboard

**O que não é:** feed infinito, gamificação, social proof, dark patterns.

## Paleta existente (tokens atuais)

```
primary:     #C1121F  (vermelho — ação, destaque)
accent:      #F4A261  (laranja — calor, comida)
background:  #FAF7F2  (creme quente)
surface:     #FFFFFF
text:        #1A1208  (marrom escuro quente)
muted:       #6F5D4D
border:      #E8E0D8
```

A paleta tem personalidade. O problema não é a cor — é como ela é aplicada.

## Register

**product** — o design serve o produto. A interface é ferramenta, não vitrine.

## Por que parece IA agora

1. **Tipografia sem caráter**: system-ui em tudo. Nenhuma escolha tipográfica que diga algo.
2. **Cards em grade idênticos**: cada list item é um card shadcn com padding uniforme. Sem ritmo, sem hierarquia.
3. **Shadcn defaults não tratados**: componentes usados no estilo base, só com override de cor.
4. **Espaçamento monotônico**: tudo `p-4` ou `gap-4`. Sem respiração nem tensão.
5. **Sem superfície de fundo**: o creme do background existe nos tokens mas não é usado como elemento vivo — é só o default do body.
6. **Ícones genéricos**: emojis (★, ✓, 👁) como affordances principais. Sem sistema coerente.
7. **Nenhuma textura ou materialidade**: tudo flat, sem elevação real, sem distinção entre camadas.

## Direção de design — o que mudar

O app deveria parecer um **caderno pessoal bem-cuidado** — não um diário fofo de papelaria, mas aquele caderno de capa dura que fica na bolsa. Funcional, particular, com marcas de uso.

- Tipografia: uma fonte com personalidade pra headings (algo com um pouco de irregularidade ou peso editorial), system-ui pode ficar pra body.
- Layout: listas ao invés de grids de cards. Hierarquia por tipografia, não por moldura.
- O background creme deve ser usado como cor ativa, não neutro.
- Distinção de camadas: surface elevada tem sombra real, não `shadow-sm`.
- Transições: entrada de conteúdo com fade leve, sem bounce.

## Features implementadas

### Compartilhamento de places (`feat-place-sharing`) — implementado
- **Backend:** `PlaceShare` model (token opaco, revogável), 5 endpoints (`/api/places/:id/share/`, `/api/share/:token/`, `/api/share/:token/import/`, etc.), HMAC-SHA256 para servir mídia sem autenticação, Celery task `copy_shared_place_photo` para re-encriptar foto no import.
- **Frontend:** `SharePage` (`/share/:token`) — página pública, foto hero que dissolve no creme, tipografia editorial (font-fraunces), CTA glass com botão Voltar + Adicionar. `ShareButton` no `PlaceDetailPage` — Web Share API com fallback popover (WhatsApp + copiar link). Context menu no `PlaceCard` (botão direito / long press): Abrir, Compartilhar, Apagar.
- **Erros específicos:** owner e duplicado retornam mensagem do backend diretamente (não genérico).
- **Testes:** 7 model + 23 view (backend), SharePage.test + ShareButton.test (frontend).

## Telas principais

**Usuário pessoal:**
1. **Login / Registro** — porta de entrada, impressão inicial
2. **Lista de Lugares** (`/places`) — tela principal, mais usada
3. **Detalhe do Lugar** (`/places/:id`) — hub de informação de um lugar
4. **Nova Visita / Editar Visita** — entrada de dados, deve ser rápida
5. **Coleções** (`/collections`) — curadoria pessoal
6. **Conta / Perfil** (`/account`) — configurações, username, bio, toggle público
7. **Lixeira** (`/places/trash`) — recuperação
8. **Compartilhamento** (`/share/:token`) — página pública de place compartilhado
9. **Feed de amigos** (`/feed`) — places públicos de quem o usuário segue
10. **Perfil público de usuário** (`/u/:username`) — visível sem login, botão follow
11. **404** — edge case com personalidade

**Estabelecimento:**
12. **Perfil público** (`/e/:username`) — cardápio, contato, sem autenticação
13. **Dashboard — Perfil** (`/dashboard/profile`) — editar dados e cover photo
14. **Dashboard — Cardápio** (`/dashboard/menu`) — CRUD de itens
15. **Dashboard — Promoções** (`/dashboard/promotions`) — planos PIX + QR code
