from fastapi import APIRouter
from ..utils.diagnostics import get_server_health_status

router = APIRouter()


@router.get("/health")
async def health():
    status = get_server_health_status()
    return status
