# PeopleDesk for a VPS. Build: docker compose build app   (see deploy/README.md)
FROM node:22-bookworm-slim

# Prisma needs OpenSSL
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
# npm's download cache is not needed once the packages are installed (it was about 0.4 GB of the image)
RUN npm ci && npm cache clean --force

COPY . .
# The build only needs these to exist; the real database is set when the container starts.
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV DATABASE_URL=$DATABASE_URL DATABASE_URL_UNPOOLED=$DATABASE_URL NEXT_TELEMETRY_DISABLED=1
# chown in the same layer: doing it in a later layer stores a second full copy of .next in the image
RUN npm run build && chown -R node:node .next

# Shown to Admin and HR in the sidebar. Set after the build so they do not bust its cache. deploy/update.sh passes them in.
ARG GIT_SHA=dev
ARG BUILD_DATE=
ENV APP_COMMIT=$GIT_SHA APP_BUILT=$BUILD_DATE

ENV NODE_ENV=production
USER node
EXPOSE 3000

# Apply any new migrations, then start. A failed migration stops the container instead of serving a half-updated database.
CMD ["sh", "-c", "npx prisma migrate deploy && exec npm start"]
