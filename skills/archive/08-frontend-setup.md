# Frontend: Setup

## Criar projeto

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install
npm install react-router-dom axios react-i18next i18next
npm install -D tailwindcss postcss autoprefixer
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D @playwright/test
npx tailwindcss init -p
npx playwright install chromium
```

## tailwind.config.js

```js
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#EA1D2C",
        "primary-dark": "#B91422",
        background: "#FAFAFA",
        surface: "#FFFFFF",
        text: "#1F2937",
        muted: "#6B7280",
        border: "#E5E7EB",
        success: "#16A34A",
        warning: "#F59E0B",
        danger: "#DC2626",
      },
      fontFamily: {
        fraunces: ["Fraunces", "serif"],
      },
    },
  },
};
```

## .env.example

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_GOOGLE_OAUTH_CLIENT_ID=
```

## i18n — src/i18n.ts

```typescript
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ptBR from "./locales/pt-BR/translation.json";

i18n.use(initReactI18next).init({
  lng: localStorage.getItem("boraali_lang") ?? "pt-BR",
  fallbackLng: "pt-BR",
  resources: { "pt-BR": { translation: ptBR } },
  interpolation: { escapeValue: false },
});
export default i18n;
```

## Estrutura de pastas

```
frontend/src/
  routes/          LoginPage, RegisterPage, PlacesPage, PlaceDetailPage,
                   NewPlacePage, EditPlacePage, NewVisitPage, EditVisitPage,
                   AccountPage
  components/
    ui/            Button, Input, Card, Badge, RatingInput, Select, Textarea,
                   DateTimePicker, Modal, MapModal, EmptyState, LoadingState,
                   BackButton, ErrorMessage, AuthImage
    auth/          GoogleSignInButton
    places/        PlaceCard, PlaceForm
    visits/        VisitCard, VisitForm, VisitItemForm
  services/        api.ts, api-errors.ts, auth.service.ts, places.service.ts,
                   visits.service.ts, visit-items.service.ts, form-data.ts
  types/           user.ts, place.ts, visit.ts, visit-item.ts
  contexts/        AuthContext.tsx
  utils/           constants.ts, formatters.ts, url.ts
  locales/pt-BR/   translation.json
```
