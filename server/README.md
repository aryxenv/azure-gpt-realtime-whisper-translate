# Server

This is a server layer for your demos within the slides.
CORS is open, not a production grade set up, but for demos.

## Get started

setup with uv:

```pwsh
uv sync
```

start server (dev mode):

```pwsh
uv run fastapi dev
```

## Structure

Keeping it simple:

- Keep shared utils in `src/utils`
- Keep routes in `src/routes`
- use `main.py` as entry point with routes added here
