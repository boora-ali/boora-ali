# Critérios de Aceite e Fora de Escopo

## MVP funcional quando

```
usuário consegue se cadastrar
usuário consegue logar (email/senha e Google)
cadastro rejeita bot simples via honeypot oculto
rota privada bloqueia usuário sem token
novo login invalida sessão anterior (banner exibido)
usuário cria, edita e exclui lugar (com confirmação)
usuário lista lugares com paginação e filtro por status
usuário cria visita com ratings, notas e itens consumíveis
itens consumíveis com nome, tipo, preço, avaliação
foto de lugar/visita/item armazenada criptografada e servida autenticada
usuário não acessa dados de outro usuário
ratings inválidos rejeitados (0–10)
preço negativo rejeitado
logout invalida refresh token
delete de lugar/visita abre confirmação antes de executar
testes de backend passando
testes de frontend (unit) passando
testes E2E negativos passando (mocks)
```

## Fora de escopo

```
microserviços
filas / workers assíncronos
websockets
feeds sociais (likes, comentários, seguir)
Google Places API / geolocalização automática
upload público sem autenticação
importação automática do Instagram
pagamentos / assinatura
PWA / app stores
Facebook OAuth, Apple OAuth
```

## Comandos de verificação final

```bash
# Backend
cd backend && source .venv/bin/activate
pytest                    # todos os testes
ruff format --check . && ruff check .  # qualidade

# Frontend
cd frontend
npm run test              # unit
npm run lint              # eslint
npx playwright test "auth-negative|crud-negative|responsive"  # E2E mock

# Build
npm run build             # deve completar sem erros
```
