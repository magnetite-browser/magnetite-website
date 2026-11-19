# The website as one image: built here, then run by Node (server.mjs), which
# renders the pages for every request and sends the security headers they are
# written for. Both stages use one image, pinned by digest (the multi-arch
# index of the tag); bump tag and digest together.
FROM docker.io/library/node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS build
WORKDIR /src
COPY package.json pnpm-lock.yaml ./
# pnpm in the version package.json names (packageManager); Node no longer ships corepack.
RUN npm install --global "$(node -p 'require("./package.json").packageManager')"
RUN pnpm install --frozen-lockfile
COPY . .
# Types, the build, and the checks on the built pages (scripts/check-links.mjs).
RUN pnpm build
# The built server carries its own code; what is left to install is what server.mjs imports.
RUN pnpm prune --prod

FROM docker.io/library/node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5
ARG REVISION=unknown
LABEL org.opencontainers.image.title="magnetite-website" \
      org.opencontainers.image.description="magnetitebrowser.org, the website of the Magnetite browser" \
      org.opencontainers.image.licenses="EUPL-1.2" \
      org.opencontainers.image.source="https://github.com/magnetite-browser/magnetite-website" \
      org.opencontainers.image.revision="${REVISION}"
WORKDIR /srv
COPY --from=build /src/package.json /src/server.mjs ./
COPY --from=build /src/node_modules ./node_modules
COPY --from=build /src/dist ./dist
ENV NODE_ENV=production
# The server writes nothing: any user will do, and the root file system can be read-only.
USER 10001:10001
EXPOSE 8080
CMD ["node", "server.mjs"]
