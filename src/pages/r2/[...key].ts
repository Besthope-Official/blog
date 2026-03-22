import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { SITE } from "../../config";

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

// Proxy /r2/* to the configured site origin when CF bindings are unavailable
// (astro dev). Override PUBLIC_SITE_URL to target a different origin, such as
// a local wrangler dev instance.
const getDevProxyOrigin = () => {
  const siteUrl = import.meta.env.PUBLIC_SITE_URL ?? SITE.website;
  if (!siteUrl) return null;
  try {
    return new URL(siteUrl).origin;
  } catch {
    return null;
  }
};

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

const negotiateFormat = (
  accept: string | null,
): "image/avif" | "image/webp" | null => {
  if (!accept) return null;
  if (accept.includes("image/avif")) return "image/avif";
  if (accept.includes("image/webp")) return "image/webp";
  return null;
};

const encodeKey = (key: string) =>
  key
    .split("/")
    .map(segment => encodeURIComponent(segment))
    .join("/");

const fetchFromDevProxy = async (key: string, method: "GET" | "HEAD") => {
  const origin = getDevProxyOrigin();
  if (!origin) return null;
  try {
    return await fetch(`${origin}/r2/${encodeKey(key)}`, { method });
  } catch {
    return null;
  }
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

// In astro dev (Vite), cloudflare:workers bindings are shimmed as undefined.
// In wrangler dev or production, they are real objects.
const workerEnv = env as Partial<Env>;
const hasBucket = !!workerEnv.BLOG_BUCKET;

export const GET: APIRoute = async ({ params, request }) => {
  const key = normalizeKey(params.key);
  if (!key) return notFound();

  // astro dev: no real CF bindings — proxy to PUBLIC_SITE_URL
  if (!hasBucket) {
    const proxiedResponse = await fetchFromDevProxy(key, "GET");
    return proxiedResponse ?? notFound();
  }

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

  if (!hasBucket) {
    const proxiedResponse = await fetchFromDevProxy(key, "HEAD");
    return proxiedResponse ?? notFound();
  }

  const object = await env.BLOG_BUCKET.head(key);
  if (!object) return notFound();

  return buildPassthroughResponse(object, "HEAD");
};
