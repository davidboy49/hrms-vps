# PeopleDesk for a VPS. Build: docker compose build app   (see deploy/README.md)
FROM node:22-bookworm-slim

# Prisma needs OpenSSL
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
# The build only needs these to exist; the real database is set when the container starts.
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV DATABASE_URL=$DATABASE_URL DATABASE_URL_UNPOOLED=$DATABASE_URL NEXT_TELEMETRY_DISABLED=1
RUN npm run build

ENV NODE_ENV=production
RUN chown -R node:node .next
USER node
EXPOSE 3000

# Apply any new migrations, then start. A failed migration stops the container instead of serving a half-updated database.
CMD ["sh", "-c", "npx prisma migrate deploy && exec npm start"]
