from pathlib import Path

from dotenv import load_dotenv

# Load local config before importing routers that may read environment values.
load_dotenv(Path(__file__).with_name(".env"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.router.diagnostics import router as diagnostics_router
from src.router.exports import router as exports_router
from src.router.realtime import router as realtime_router

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Hello World"}

app.include_router(diagnostics_router)
app.include_router(exports_router)
app.include_router(realtime_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
