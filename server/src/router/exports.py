import shutil
import subprocess
from pathlib import Path
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

router = APIRouter(prefix="/exports", tags=["exports"])

REPO_ROOT = Path(__file__).resolve().parents[3]
EXPORTS_DIR = REPO_ROOT / "exports"
PDF_PATH = EXPORTS_DIR / "webslides.pdf"
PPTX_PATH = EXPORTS_DIR / "webslides.pptx"
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "0.0.0.0"}


class LocalExportRequest(BaseModel):
    url: str


def ensure_local_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or parsed.hostname not in LOCAL_HOSTS:
        raise HTTPException(
            status_code=400,
            detail="Local exports can only render a local development URL.",
        )

    return url


def run_npm_export(
    *,
    script_name: str,
    url: str,
    output_path: Path,
    export_label: str,
) -> None:
    npm = shutil.which("npm")
    if not npm:
        raise HTTPException(
            status_code=500,
            detail=f"npm was not found on PATH, so the local {export_label} export could not run.",
        )

    try:
        completed = subprocess.run(
            [
                npm,
                "run",
                script_name,
                "--",
                "--url",
                url,
                "--output",
                str(output_path),
            ],
            cwd=REPO_ROOT,
            capture_output=True,
            check=False,
            text=True,
            timeout=120,
        )
    except subprocess.TimeoutExpired as error:
        raise HTTPException(
            status_code=504,
            detail=f"{export_label} export timed out while rendering the local deck.",
        ) from error

    if completed.returncode != 0:
        details = "\n".join(
            part.strip()
            for part in (completed.stderr, completed.stdout)
            if part.strip()
        )
        raise HTTPException(
            status_code=500,
            detail=details
            or f"{export_label} export failed without additional output.",
        )


@router.post("/pdf")
def export_pdf(request: LocalExportRequest):
    url = ensure_local_url(request.url)
    run_npm_export(
        script_name="export:pdf",
        url=url,
        output_path=PDF_PATH,
        export_label="PDF",
    )

    return FileResponse(
        PDF_PATH,
        media_type="application/pdf",
        filename=PDF_PATH.name,
    )


@router.post("/pptx")
def export_pptx(request: LocalExportRequest):
    url = ensure_local_url(request.url)
    run_npm_export(
        script_name="export:pptx",
        url=url,
        output_path=PPTX_PATH,
        export_label="PPTX",
    )

    return FileResponse(
        PPTX_PATH,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename=PPTX_PATH.name,
    )
