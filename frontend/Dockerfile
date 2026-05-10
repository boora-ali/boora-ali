FROM node:22-alpine AS builder

WORKDIR /app

ENV CI=true

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .
ARG VITE_API_URL=""
ARG VITE_GOOGLE_OAUTH_CLIENT_ID=""
ARG VITE_TURNSTILE_SITE_KEY=""
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_OAUTH_CLIENT_ID=$VITE_GOOGLE_OAUTH_CLIENT_ID
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
RUN npm run build


FROM nginx:1.30.0-alpine3.23-slim AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
