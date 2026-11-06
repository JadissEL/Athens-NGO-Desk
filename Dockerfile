# Greece NGO Desk — Phase B API for Google Cloud Run
# Build context: repository root (needs server/, scripts/, schemas/, data/ngos/, docs/ for repoRoot paths).

FROM node:20-bookworm-slim

WORKDIR /app

COPY server/package.json server/package-lock.json ./server/
COPY server/prisma ./server/prisma
COPY server/src ./server/src
COPY server/public ./server/public
COPY server/tsconfig.json ./server/tsconfig.json
COPY server/docker-entrypoint.sh /entrypoint.sh

COPY scripts ./scripts
COPY schemas ./schemas
COPY data/ngos ./data/ngos
COPY docs ./docs

WORKDIR /app/server
RUN npm ci \
  && npx prisma generate \
  && npm run build \
  && npm prune --omit=dev \
  && chmod +x /entrypoint.sh

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

EXPOSE 8080

CMD ["/entrypoint.sh"]
