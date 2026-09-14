/**
 * Deno 2 API Gateway and Web Server
 * Routes API traffic to Python Core Engine (Port 8000) and serves static web client from ./public.
 */

import { join, extname } from "jsr:@std/path";

const BACKEND_URL = Deno.env.get("BACKEND_URL") || "http://127.0.0.1:8000";
const GATEWAY_PORT = parseInt(Deno.env.get("GATEWAY_PORT") || "8080", 10);
const PUBLIC_DIR = join(Deno.cwd(), "public");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

console.log(`[Deno Gateway] Starting reverse proxy on port ${GATEWAY_PORT} -> ${BACKEND_URL}`);

Deno.serve({ port: GATEWAY_PORT }, async (req: Request) => {
  const url = new URL(req.url);

  // Gateway Health Endpoint
  if (url.pathname === "/gateway-health") {
    return new Response(
      JSON.stringify({
        status: "ok",
        runtime: "Deno " + Deno.version.deno,
        proxy_target: BACKEND_URL,
        timestamp: new Date().toISOString(),
      }),
      { headers: { "content-type": "application/json" } }
    );
  }

  // Proxy /api/*, /health, and /docs requests to Python FastAPI backend
  if (
    url.pathname.startsWith("/api") ||
    url.pathname === "/health" ||
    url.pathname.startsWith("/docs") ||
    url.pathname.startsWith("/openapi.json")
  ) {
    const targetUrl = new URL(url.pathname + url.search, BACKEND_URL);
    try {
      const proxyReq = new Request(targetUrl.toString(), {
        method: req.method,
        headers: req.headers,
        body: req.body,
        redirect: "manual",
      });

      const response = await fetch(proxyReq);
      return response;
    } catch (err) {
      console.error(`[Gateway Proxy Error] ${err}`);
      return new Response(
        JSON.stringify({
          error: "Backend Service Unavailable",
          details: String(err),
        }),
        {
          status: 503,
          headers: { "content-type": "application/json" },
        }
      );
    }
  }

  // Serve static files from ./public
  let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
  const fullPath = join(PUBLIC_DIR, filePath);

  try {
    const fileInfo = await Deno.stat(fullPath);
    if (fileInfo.isFile) {
      const fileBytes = await Deno.readFile(fullPath);
      const ext = extname(fullPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      return new Response(fileBytes, {
        headers: { "content-type": contentType },
      });
    }
  } catch (_e) {
    // Fallback to index.html for client-side navigation
    try {
      const indexBytes = await Deno.readFile(join(PUBLIC_DIR, "index.html"));
      return new Response(indexBytes, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    } catch (_err) {
      return new Response("Not Found", { status: 404 });
    }
  }

  return new Response("Not Found", { status: 404 });
});
