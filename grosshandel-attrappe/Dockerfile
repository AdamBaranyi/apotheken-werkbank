# syntax=docker/dockerfile:1

# Grosshandel-Attrappe für vps1. Node 24 führt TypeScript direkt aus (Type
# Stripping): kein Build, nur Pakete. Gebaut wird aus dem Wurzelordner, weil
# bun.lock dort für alle Workspaces liegt:
#
#   docker build -f grosshandel-attrappe/Dockerfile -t werkbank-grosshandel .

FROM node:24-bookworm-slim AS bun
COPY --from=oven/bun:1.3.14-slim /usr/local/bin/bun /usr/local/bin/bun

# ---------------------------------------------------------------- Pakete ---
FROM bun AS pakete
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
# Alle Workspaces müssen da sein, sonst passt bun.lock nicht; installiert wird
# nur die Attrappe, ohne Entwicklungspakete. --frozen-lockfile: genau die
# Fassungen aus bun.lock, die Wartezeit aus bunfig.toml lässt sich so nicht
# umgehen.
COPY grosshandel-attrappe/package.json grosshandel-attrappe/
COPY web/package.json web/
RUN bun install --frozen-lockfile --production --filter '@werkbank/grosshandel-attrappe'

# --------------------------------------------------------------- Laufzeit ---
FROM node:24-bookworm-slim AS laufzeit
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3501
WORKDIR /app
COPY --from=pakete /app/node_modules ./node_modules
COPY --from=pakete /app/grosshandel-attrappe/node_modules ./grosshandel-attrappe/node_modules
COPY grosshandel-attrappe/package.json ./grosshandel-attrappe/
COPY grosshandel-attrappe/src ./grosshandel-attrappe/src
COPY daten ./daten
# Nicht als root, und der Code gehört nicht dem Laufzeitbenutzer: Er kann ihn
# lesen, aber nicht ändern.
USER node
WORKDIR /app/grosshandel-attrappe
EXPOSE 3501
CMD ["node", "src/start.ts"]
