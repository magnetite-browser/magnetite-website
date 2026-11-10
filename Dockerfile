# The website as one small image: built here, then served as static files
# by Caddy with the security headers the pages are written for (Caddyfile).
# Both images are pinned by digest (the multi-arch index of the tag); bump
# tag and digest together.
FROM docker.io/library/node:26-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS build
WORKDIR /src
COPY package.json pnpm-lock.yaml ./
# pnpm in the version package.json names (packageManager); Node no longer ships corepack.
RUN npm install --global "$(node -p 'require("./package.json").packageManager')"
RUN pnpm install --frozen-lockfile
COPY . .
# Types, the build, and the checks on the built pages (scripts/check-links.mjs).
RUN pnpm build

FROM docker.io/library/caddy:2-alpine@sha256:78bd35025c7ba85961dd149ae670315129954e77abe2383ac47c89106b35ade9
ARG REVISION=unknown
LABEL org.opencontainers.image.title="magnetite-website" \
      org.opencontainers.image.description="magnetitebrowser.org, the website of the Magnetite browser" \
      org.opencontainers.image.licenses="EUPL-1.2" \
      org.opencontainers.image.source="https://github.com/magnetite-browser/magnetite-website" \
      org.opencontainers.image.revision="${REVISION}"
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/dist /srv
# Caddy writes nothing (Caddyfile): any user will do, and the root file system can be read-only.
USER 10001:10001
EXPOSE 8080
