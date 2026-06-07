/** Base URL of the demo server. Defaults to the local FastAPI dev server;
 * override per-environment with VITE_SERVER_URL (e.g. in .env.local). */
const serverUrl = import.meta.env.VITE_SERVER_URL ?? "http://localhost:8000";

export const SERVER_URL = serverUrl.replace(/\/$/, "");

export interface HealthStatus {
  status: string;
}

export interface FileExportResult {
  blob: Blob;
  filename: string;
}

/** A failed fetch (connection refused / server down) surfaces as a TypeError,
 * unlike an HTTP error response which carries a status message. */
export function describeServerError(error: unknown): string {
  if (error instanceof TypeError) {
    return "Server unavailable — start the server with `uv run fastapi dev`.";
  }

  return error instanceof Error ? error.message : "Request failed.";
}

/** Calls the server's GET /health route. */
export async function fetchHealth(signal?: AbortSignal): Promise<HealthStatus> {
  const response = await fetch(`${SERVER_URL}/health`, { signal });

  if (!response.ok) {
    throw new Error(`Server responded ${response.status}`);
  }

  return (await response.json()) as HealthStatus;
}

function readFilename(response: Response, fallback: string) {
  const disposition = response.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? fallback;
}

async function readErrorMessage(response: Response) {
  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await response.json()) as { detail?: unknown };
    return typeof body.detail === "string"
      ? body.detail
      : `Server responded ${response.status}`;
  }

  const text = await response.text();
  return text || `Server responded ${response.status}`;
}

export async function exportPdf(
  url: string,
  signal?: AbortSignal,
): Promise<FileExportResult> {
  const response = await fetch(`${SERVER_URL}/exports/pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return {
    blob: await response.blob(),
    filename: readFilename(response, "webslides.pdf"),
  };
}

export async function exportPptx(
  url: string,
  signal?: AbortSignal,
): Promise<FileExportResult> {
  const response = await fetch(`${SERVER_URL}/exports/pptx`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return {
    blob: await response.blob(),
    filename: readFilename(response, "webslides.pptx"),
  };
}
