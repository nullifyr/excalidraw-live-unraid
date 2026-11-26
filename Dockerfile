# syntax=docker/dockerfile:1
# Upstream is a Git submodule pinned in the repository tree. One build-time source
# patch (below) adapts it to zod 4; the build fails if the patch no longer applies.
FROM node:24-bookworm-slim@sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530 AS build
WORKDIR /app
COPY build/package*.json ./
RUN npm ci && npm audit --audit-level=moderate
COPY vendor/mcp_excalidraw/ ./
COPY build/package*.json ./
# zod 4 requires an explicit key schema for z.record (zod 3 accepted one argument).
RUN grep -q 'z.record(z.any())' src/core/mcp-dispatch.ts \
    && sed -i 's/z\.record(z\.any())/z.record(z.string(), z.any())/' src/core/mcp-dispatch.ts \
    && ! grep -rq 'z.record(z.any())' src
RUN npm run build && npm run type-check && npm run type-check:frontend
RUN node scripts/check-mcp-stdio.mjs && node scripts/check-local-bind.mjs \
    && node scripts/check-state-integrity.mjs && node scripts/check-durable-state.mjs \
    && node scripts/check-render.mjs && node scripts/check-share-url.mjs \
    && node scripts/check-file-paths.mjs && node scripts/check-selection.mjs
COPY docs/excalidraw-MIT.txt /licenses/excalidraw-MIT.txt
RUN mkdir -p /licenses && cp LICENSE /licenses/mcp-excalidraw-MIT.txt \
    && cp assets/fonts/LICENSES.md /licenses/fonts-OFL.md \
    && cp -a node_modules/@excalidraw/excalidraw/dist/prod/fonts /tmp/browser-fonts \
    && npm prune --omit=dev && npm audit --omit=dev --audit-level=moderate && npm cache clean --force \
    && mkdir -p node_modules/@excalidraw/excalidraw/dist/prod \
    && mv /tmp/browser-fonts node_modules/@excalidraw/excalidraw/dist/prod/fonts

FROM node:24-bookworm-slim@sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530 AS runtime
ARG VERSION=1.0.2
ARG REVISION=unknown
LABEL org.opencontainers.image.title="Excalidraw Live" \
      org.opencontainers.image.description="Persistent Excalidraw canvas and stdio MCP, packaged for Unraid" \
      org.opencontainers.image.source="https://github.com/nullifyr/excalidraw-live-unraid" \
      org.opencontainers.image.url="https://github.com/nullifyr/excalidraw-live-unraid" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version=$VERSION \
      org.opencontainers.image.revision=$REVISION \
      io.excalidraw.upstream.revision="81720ac819d2325177cd6137c6ad41d52d0f5374"
RUN useradd --uid 99 --gid 100 --no-create-home --home-dir /nonexistent excalidraw \
    && mkdir /data && chown 99:100 /data
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/assets ./assets
COPY --from=build /app/package.json ./package.json
COPY --from=build /licenses /licenses
COPY LICENSE /licenses/package-MIT.txt
COPY scripts/excalidraw-mcp /usr/local/bin/excalidraw-mcp
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 \
    EXCALIDRAW_DATA_DIR=/data XDG_STATE_HOME=/tmp/state LOG_FILE_PATH=/tmp/excalidraw.log \
    EXCALIDRAW_NO_AUTOSTART=1 EXPRESS_SERVER_URL=http://127.0.0.1:3000 ENABLE_CANVAS_SYNC=true
USER 99:100
EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(async r=>{const h=await r.json();process.exit(r.ok&&h.service==='mcp-excalidraw-canvas'&&h.durable_state_enabled===true?0:1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
