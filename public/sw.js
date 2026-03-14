const STATIC_CACHE = "shc-static-v3";
const SHELL_CACHE = "shc-shell-v3";
const API_CACHE = "shc-api-v1";
const API_CACHE_KEY_PREFIX = "/__offline/api-check";

const APP_SHELL_PATHS = [
  "/",
  "/compare",
  "/bulk",
  "/fixes",
  "/dashboard",
  "/pricing",
  "/docs",
  "/docs/api",
  "/docs/ci-cd",
  "/security-headers-guide",
  "/about",
  "/manifest.webmanifest",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_PATHS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== SHELL_CACHE && key !== API_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function normalizeTargetUrl(value) {
  const target = typeof value === "string" ? value.trim() : "";
  if (!target) return null;

  try {
    const withProtocol = target.startsWith("http://") || target.startsWith("https://") ? target : `https://${target}`;
    const parsed = new URL(withProtocol);
    parsed.hash = "";
    const normalizedPath = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");
    return `${parsed.origin}${normalizedPath}${parsed.search}`;
  } catch {
    return target.toLowerCase();
  }
}

function buildApiCacheRequest(targetUrl, options) {
  const cacheUrl = new URL(API_CACHE_KEY_PREFIX, self.location.origin);
  cacheUrl.searchParams.set("url", targetUrl);
  if (options && typeof options === "object") {
    const normalizedOptions = JSON.stringify(options);
    cacheUrl.searchParams.set("options", normalizedOptions);
  }
  return new Request(cacheUrl.toString(), { method: "GET" });
}

function isCacheableStaticAsset(request, url) {
  if (request.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;

  return (
    url.pathname.startsWith("/_next/static/") ||
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "image" ||
    request.destination === "font" ||
    request.destination === "manifest"
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function navigationNetworkFirst(request) {
  const shellCache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      shellCache.put(request, response.clone());
    }
    return response;
  } catch {
    const cachedRoute = await shellCache.match(request);
    if (cachedRoute) {
      return cachedRoute;
    }
    const cachedHome = await shellCache.match("/");
    if (cachedHome) {
      return cachedHome;
    }
    throw new Error("Offline and no cached page available.");
  }
}

async function apiNetworkFirstWithOfflineFallback(request) {
  const apiCache = await caches.open(API_CACHE);
  let cacheRequest = null;

  try {
    const requestPayload = await request.clone().json();
    if (requestPayload && typeof requestPayload === "object" && "url" in requestPayload) {
      const normalizedTarget = normalizeTargetUrl(requestPayload.url);
      if (normalizedTarget) {
        const requestOptions =
          requestPayload && typeof requestPayload === "object" && "options" in requestPayload
            ? requestPayload.options
            : null;
        cacheRequest = buildApiCacheRequest(normalizedTarget, requestOptions);
      }
    }
  } catch {
    cacheRequest = null;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok && cacheRequest) {
      await apiCache.put(cacheRequest, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    if (cacheRequest) {
      const cachedResponse = await apiCache.match(cacheRequest);
      if (cachedResponse) {
        const body = await cachedResponse.clone().arrayBuffer();
        const headers = new Headers(cachedResponse.headers);
        headers.set("X-SHC-Offline", "1");
        headers.set("X-SHC-Offline-Source", "service-worker-cache");
        headers.set("Content-Type", headers.get("Content-Type") || "application/json");
        return new Response(body, {
          status: 200,
          statusText: "OK",
          headers
        });
      }
    }

    return new Response(
      JSON.stringify({
        error: "You are offline and no cached scan result is available yet for this URL."
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method === "POST" && url.origin === self.location.origin && url.pathname === "/api/check") {
    event.respondWith(apiNetworkFirstWithOfflineFallback(request));
    return;
  }

  if (request.mode === "navigate" && url.origin === self.location.origin && !url.pathname.startsWith("/api/")) {
    event.respondWith(navigationNetworkFirst(request));
    return;
  }

  if (isCacheableStaticAsset(request, url)) {
    event.respondWith(cacheFirst(request));
  }
});
