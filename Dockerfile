# syntax=docker/dockerfile:1
# datasteg global-network: the Next.js standalone server (app/), the Oreum design system (design/) and the built data
# (data/, written by scripts/build.py from money-flow's release store and trade-flow's data folder, copied
# into the build context before the image is built). The image holds nothing private: data/ carries money-flow's gated
# aggregates and trade-flow's derived records only; the app has no data route (app/lib/data.ts).
FROM --platform=$BUILDPLATFORM node:24.22.0-alpine AS build
WORKDIR /repo/app
RUN npm install -g pnpm@11.18.0 >/dev/null
COPY app/package.json app/pnpm-lock.yaml ./
RUN pnpm fetch
COPY design /repo/design
COPY app /repo/app
# The static pages (economies, pairs) are prerendered at build time, so the build stage needs the data too
# (lib/data.ts reads ../data from app/ when DATA_DIR is unset).
COPY data /repo/data
RUN pnpm install --offline --frozen-lockfile
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION NEXT_TELEMETRY_DISABLED=1
RUN BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) pnpm build

FROM node:24.22.0-alpine
WORKDIR /srv
ARG APP_VERSION=dev
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1 APP_VERSION=$APP_VERSION
# outputFileTracingRoot is the repo root (global-network/), so the standalone server lands at app/server.js, as in money-flow.
COPY --from=build /repo/app/.next/standalone ./
COPY --from=build /repo/app/.next/static ./app/.next/static
COPY --from=build /repo/app/public ./app/public
# The built data: brotli JSON per view, read by app/lib/data.ts from DATA_DIR at run time.
COPY data ./data
ENV DATA_DIR=/srv/data
# A fixed non-root uid of its own, so no two datasteg containers share one.
USER 10073:10073
EXPOSE 8080
CMD ["node", "app/server.js"]
