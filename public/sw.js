const STATIC_CACHE = "shc-static-v1";
const SHELL_CACHE = "shc-shell-v1";

const APP_SHELL_PATHS = [
  "/",
  "/compare",
  "/bulk",
  "/pricing",
  "/docs",
  "/docs/api",
  "/docs/ci-cd",
  "/security-headers-guide",
  "/about",
  "/manifest.webmanifest",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg"
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
            .filter((key) => key !== STATIC_CACHE && key !== SHELL_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

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

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.mode === "navigate" && url.origin === self.location.origin && !url.pathname.startsWith("/api/")) {
    event.respondWith(navigationNetworkFirst(request));
    return;
  }

  if (isCacheableStaticAsset(request, url)) {
    event.respondWith(cacheFirst(request));
  }
});
