# syntax=docker/dockerfile:1

# ---- Build stage: full dependency tree, builds the client and bundles the server ----
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime stage: production dependencies and build output only ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server

# The official node image ships an unprivileged "node" user.
USER node
EXPOSE 8080
CMD ["node", "dist-server/server.js"]
