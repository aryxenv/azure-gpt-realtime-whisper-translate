FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends nodejs npm \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && npx playwright install --with-deps chromium

COPY server/pyproject.toml server/uv.lock ./server/
WORKDIR /app/server
RUN uv sync --frozen --no-dev --no-install-project

WORKDIR /app
COPY scripts ./scripts
COPY server ./server

WORKDIR /app/server

EXPOSE 8000

CMD ["uv", "run", "--no-sync", "fastapi", "run", "main.py", "--host", "0.0.0.0", "--port", "8000"]
