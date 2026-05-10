# Bora Ali Frontend

Frontend webapp built with React + TypeScript + Vite.

## Setup

```bash
npm install
npm run dev
```

## Main Scripts

```bash
# quality
npm run lint
npm run build

# local preview for performance runs
npm run perf:preview

# lighthouse reports
npm run perf:lighthouse:mobile
npm run perf:lighthouse:desktop
```

Reports are generated at:

- `lighthouse-report-mobile.html`
- `lighthouse-report-desktop.html`

## Recent Implementations

### Performance and Lighthouse

- Added Lighthouse tooling (`lighthouse` as dev dependency).
- Added scripts for mobile and desktop Lighthouse runs.
- Routes were code-split with `React.lazy` + `Suspense` in `src/App.tsx` to reduce initial JS payload.
- Result: mobile `unused-javascript` estimate dropped from around `109 KiB` to around `32 KiB` while keeping high performance score.

### SEO

- Added `public/robots.txt`.
- Added meta description in `index.html`.
- Lighthouse SEO score on `/login` reached `1.00` in latest run.

### Accessibility

- Updated login UI contrast (text and primary color usage) to remove color-contrast failures.
- Latest Lighthouse accessibility score on `/login`: `1.00`.

### Render Blocking

- Removed remote Google Fonts stylesheet from `index.html` and moved to system font stack fallbacks in Tailwind/CSS, reducing external render-blocking dependency.

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router
- i18next
