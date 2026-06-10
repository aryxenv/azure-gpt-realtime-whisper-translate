FROM mcr.microsoft.com/devcontainers/javascript-node:24-bookworm AS node-base

FROM node-base AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tailwind.config.ts postcss.config.js components.json ./
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY public ./public
COPY src ./src

RUN npm run build

FROM node-base AS runtime

ENV PORT=80
WORKDIR /app

COPY web/server.mjs ./server.mjs
COPY --from=build /app/dist ./dist

EXPOSE 80

CMD ["node", "server.mjs"]
