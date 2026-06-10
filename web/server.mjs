import { createReadStream, existsSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const localDistRoot = path.join(appRoot, "..", "dist");
const containerDistRoot = path.join(appRoot, "dist");
const distRoot = existsSync(containerDistRoot) ? containerDistRoot : localDistRoot;
const port = Number(process.env.PORT ?? "8080");
const serverUrl = (
  process.env.VITE_SERVER_URL ??
  process.env.WEBSLIDES_SERVER_URL ??
  ""
).replace(/\/$/, "");

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json"],
]);

writeFileSync(
  path.join(distRoot, "env-config.js"),
  `window.__WEBSLIDES_CONFIG__ = ${JSON.stringify({ serverUrl })};\n`,
);

function resolveAssetPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0] ?? "/");
  const relativePath =
    decodedPath === "/" ? "index.html" : decodedPath.slice(1);
  const candidate = path.resolve(distRoot, relativePath);

  if (!candidate.startsWith(distRoot)) {
    return null;
  }

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }

  if (!path.extname(candidate)) {
    return path.join(distRoot, "index.html");
  }

  return null;
}

createServer((request, response) => {
  const assetPath = resolveAssetPath(request.url ?? "/");
  if (!assetPath) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const contentType =
    mimeTypes.get(path.extname(assetPath)) ?? "application/octet-stream";
  response.writeHead(200, {
    "Cache-Control": assetPath.endsWith("env-config.js")
      ? "no-store"
      : "public, max-age=300",
    "Content-Type": contentType,
  });
  createReadStream(assetPath).pipe(response);
}).listen(port, "0.0.0.0", () => {
  console.log(`webslides web container listening on port ${port}`);
});
