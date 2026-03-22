import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const DEFAULT_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

// Images binding cannot process vector/container formats — serve them as-is
const PASSTHROUGH_EXTENSIONS = new Set(["svg", "ico"]);

const CONTENT_TYPES = new Map<string, string>([
  ["avif", "image/avif"],
  ["gif", "image/gif"],
  ["ico", "image/x-icon"],
  ["jpeg", "image/jpeg"],
  ["jpg", "image/jpeg"],
  ["png", "image/png"],
  ["svg", "image/svg+xml"],
  ["webp", "image/webp"],
]);

const notFound = () => new Response("Not Found", { status: 404 });

const normalizeKey = (rawKey: string | undefined) => {
  if (!rawKey) return null;

  try {
    const key = decodeURIComponent(rawKey).replace(/^\/+/, "");
    const segments = key.split("/");

    if (
      !key ||
      key.endsWith("/") ||
      segments.some(segment => !segment || segment === "." || segment === "..")
    ) {
      return null;
    }

    return key;
  } catch {
    return null;
  }
};

const getExtension = (key: string) =>
  key.split(".").pop()?.toLowerCase() ?? "";

const getContentType = (key: string) =>
  CONTENT_TYPES.get(getExtension(key)) ?? "application/octet-stream";

// Negotiate the best output format based on the Accept header.
// Returns null if the original format should be preserved.
const negotiateFormat = (
  accept: string | null,
): "image/avif" | "image/webp" | null => {
  if (!accept) return null;
  if (accept.includes("image/avif")) return "image/avif";
  if (accept.includes("image/webp")) return "image/webp";
  return null;
};

// Build a stable cache request incorporating the negotiated format so that
// AVIF, WebP, and original variants are stored as separate cache entries.
const buildCacheRequest = (
  requestUrl: string,
  format: "image/avif" | "image/webp" | null,
) => {
  const url = new URL(requestUrl);
  if (format) {
    url.searchParams.set("_fmt", format.split("/")[1]);
  }
  return new Request(url.toString());
};

const buildPassthroughResponse = (
  object: R2Object | R2ObjectBody,
  method: "GET" | "HEAD",
) => {
  const headers = new Headers();
  object.writeHttpMetadata(headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", getContentType(object.key));
  }
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", DEFAULT_CACHE_CONTROL);
  }

  headers.set("ETag", object.httpEtag);
  headers.set("Last-Modified", object.uploaded.toUTCString());
  headers.set("Content-Length", object.size.toString());
  headers.set("Vary", "Accept");

  return new Response(
    method === "HEAD" ? null : (object as R2ObjectBody).body,
    { headers },
  );
};

export const GET: APIRoute = async ({ params, request }) => {
  const key = normalizeKey(params.key);
  if (!key) return notFound();

  const ext = getExtension(key);
  const canTranscode = !PASSTHROUGH_EXTENSIONS.has(ext) && !!env.IMAGES;
  const targetFormat = canTranscode
    ? negotiateFormat(request.headers.get("Accept"))
    : null;

  // Check Cloudflare cache before hitting R2 or Images binding
  // caches.default is Cloudflare Workers-specific (not in standard DOM types)
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheReq = buildCacheRequest(request.url, targetFormat);
  const cached = await cache.match(cacheReq);
  if (cached) return cached;

  const object = await env.BLOG_BUCKET.get(key);
  if (!object) return notFound();

  let response: Response;

  if (targetFormat) {
    try {
      const result = await env.IMAGES.input(object.body).output({
        format: targetFormat,
        quality: 85,
      });

      const imageResp = result.response();
      const headers = new Headers(imageResp.headers);
      headers.set("Cache-Control", DEFAULT_CACHE_CONTROL);
      headers.set("Vary", "Accept");

      response = new Response(imageResp.body, { status: 200, headers });
    } catch {
      // Images binding failed (unsupported format, corrupt file, etc.) — fall back to passthrough
      const fallback = await env.BLOG_BUCKET.get(key);
      if (!fallback) return notFound();
      response = buildPassthroughResponse(fallback, "GET");
    }
  } else {
    response = buildPassthroughResponse(object, "GET");
  }

  await cache.put(cacheReq, response.clone());
  return response;
};

export const HEAD: APIRoute = async ({ params }) => {
  const key = normalizeKey(params.key);
  if (!key) return notFound();

  const object = await env.BLOG_BUCKET.head(key);
  if (!object) return notFound();

  return buildPassthroughResponse(object, "HEAD");
};
