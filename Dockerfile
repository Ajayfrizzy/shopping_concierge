FROM node:22-bookworm-slim AS build
WORKDIR /app
# .dockerignore permits only build inputs and reviewed usage ledgers.
COPY . .
RUN npm ci --include=dev --workspace=@youcam/api --include-workspace-root=false \
    && npm run build:api \
    && test -s apps/api/dist/runtime/server.js

FROM node:22-bookworm-slim AS runtime-dependencies
WORKDIR /app
COPY . .
RUN npm ci --omit=dev --workspace=@youcam/api --include-workspace-root=false

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production API_HOST=0.0.0.0
COPY --from=runtime-dependencies /app/node_modules ./node_modules
COPY --from=runtime-dependencies /app/packages ./packages
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/migrations ./apps/api/migrations
# Preserve historical caps; do not initialize fresh ledgers during startup.
COPY --chown=node:node --from=build /app/artifacts/m7-live-budget.json ./artifacts/m7-live-budget.json
COPY --chown=node:node --from=build /app/docs/evidence/youcam-live/render-reservations.jsonl ./docs/evidence/youcam-live/render-reservations.jsonl
RUN chown node:node artifacts docs/evidence/youcam-live \
    && test -s apps/api/dist/runtime/server.js
USER node
CMD ["node", "apps/api/dist/runtime/server.js"]
