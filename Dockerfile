FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

FROM deps AS builder

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

WORKDIR /app

COPY . .

RUN npm run db:generate
RUN npm run build

FROM deps AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV STATIC_ROOT=/app/apps/web/dist

COPY . .
COPY --from=builder /app/apps/api/dist /app/apps/api/dist
COPY --from=builder /app/apps/web/dist /app/apps/web/dist
COPY --from=builder /app/node_modules /app/node_modules

RUN chmod +x /app/scripts/start-app.sh

EXPOSE 4000

CMD ["/app/scripts/start-app.sh"]

