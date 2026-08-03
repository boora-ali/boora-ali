---
name: Boora Ali
description: Diário pessoal de lugares, direto, memorável e neo-brutalista.
colors:
  primary: "#E03A3E"
  primary-dark: "#B92D31"
  light-background: "#FFFFFF"
  light-text: "#000000"
  dark-background: "#000000"
  dark-text: "#FFFFFF"
  success: "#16A34A"
  warning: "#F59E0B"
  danger: "#DC2626"
typography:
  display:
    fontFamily: "Impact, Arial Black, system-ui, sans-serif"
    fontSize: "clamp(3.25rem, 6.5vw, 7rem)"
    fontWeight: 900
    lineHeight: 0.86
  body:
    fontFamily: "Arial, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.45
rounded:
  sm: "0"
  md: "0"
  lg: "0"
  xl: "0"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.dark-text}"
    rounded: "0"
    border: "3px solid currentColor"
    shadow: "6px 6px 0 currentColor"
---

# Design System: Boora Ali

## North Star

**Um cartaz de rua para o seu caderno de lugares.** A landing e a porta de entrada comunicam com peso, contraste e memória visual. O produto continua pessoal e útil, sem parecer catálogo de reviews ou dashboard SaaS.

## Themes

| Tema | Fundo | Texto e borda | Ação |
| --- | --- | --- | --- |
| Claro | branco puro | preto puro | vermelho de marca `#E03A3E` |
| Escuro | preto puro | branco puro | vermelho de marca `#E03A3E` |

O toggle claro/escuro permanece disponível. Ele inverte papel e tinta, mas não troca a cor de ação: vermelho é a assinatura da marca nos dois modos.

## Color Rules

- Vermelho de marca é CTA, foco e ação principal. Não usar como preenchimento decorativo aleatório.
- Preto e branco criam a estrutura, com contraste máximo.
- Sem gradientes, transparências decorativas ou sombras difusas.
- Imagens de lugares dão materialidade à landing; sempre com moldura de borda rígida.

## Typography

- Headings e números de seção usam uma sans pesada, compacta e em caixa alta quando apropriado.
- Corpo, links e descrições usam uma sans legível e pesada.
- Hierarquia vem de escala extrema, peso e espaço, não de cards arredondados.
- Limitar texto corrido a 65–75 caracteres por linha quando possível.

## Shape and Elevation

- `border-radius: 0` em todos os elementos da landing, autenticação e primitivos de formulário.
- Borda sólida de `3px` para navegação, seções, CTAs, imagens e controles.
- Elevação é mecânica: `box-shadow: 6px 6px 0 currentColor` (ou menor no pressionado).
- Hover de CTA desloca o elemento, reduzindo a sombra. Nunca animar layout.

## Layout

- A landing é organizada por faixas de largura total, separadas por bordas visíveis.
- Hero em duas colunas: manifesto e CTA à esquerda, cena de memórias à direita.
- Seções alternam papel, tinta e vermelho para criar ritmo sem repetir cards.
- No celular, as colunas empilham e os números de seção viram uma faixa horizontal.

## Components

### Navigation

- Barra reta, branca ou preta conforme o tema, com borda de 3px.
- Toggle de tema quadrado e com borda rígida.
- CTA de cadastro em vermelho, borda preta/branca e sombra sólida.

### Buttons and links

- Ações de navegação são links semânticos, estilizados como botões quando necessário.
- CTA primário: vermelho, texto branco, borda de 3px e sombra sólida.
- Focus visível é obrigatório e usa o contraste do tema.

### Authentication and form primitives

- Login e cadastro são uma porta em duas faixas: manifesto vermelho e formulário em papel ou tinta.
- `Button`, `Input`, `PasswordInput`, `Switch`, seleção de idioma e provedores externos compartilham cantos retos, borda de 3px e sombra mecânica.
- Essa base é global. Telas existentes que usam esses primitivos recebem o mesmo tratamento sem forks de componentes.

### Images

- Usar fotografia ou mídia real do produto; nunca substituir imagem por painel decorativo.
- Moldura reta de 3px e sombra sólida. Sem cantos arredondados.

## Do not

- Não usar cantos arredondados na landing, autenticação ou nos primitivos compartilhados.
- Não usar cartões shadcn arredondados, glassmorphism, gradiente ou sombra borrada.
- Não remover funcionalidades existentes, como o modo claro/escuro, para atingir o estilo.
- Não usar amarelo como cor principal da marca. O vermelho é a cor de ação do Boora Ali.
