const DEFAULT_API_ORIGIN = "https://security-header-checker.vercel.app";
const API_ORIGIN_STORAGE_KEY = "apiOrigin";
const CACHE_TTL_MS = 2 * 60 * 1000;

const GRADE_BADGE_STYLE = {
  A: { text: "A", color: "#10b981" },
  B: { text: "B", color: "#84cc16" },
  C: { text: "C", color: "#f59e0b" },
  D: { text: "D", color: "#fb7185" },
  F: { text: "F", color: "#ef4444" }
};

const scanCache = new Map();
const inFlightScans = new Map();

function normalizeApiOrigin(value) {
  if (typeof value !== "string") return DEFAULT_API_ORIGIN;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_API_ORIGIN;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return DEFAULT_API_ORIGIN;
    }
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_API_ORIGIN;
  }
}

async function getApiOrigin() {
  const stored = await chrome.storage.sync.get(API_ORIGIN_STORAGE_KEY);
  return normalizeApiOrigin(stored[API_ORIGIN_STORAGE_KEY]);
}

async function setApiOrigin(value) {
  const normalized = normalizeApiOrigin(value);
  await chrome.storage.sync.set({ [API_ORIGIN_STORAGE_KEY]: normalized });
  return normalized;
}

function toScanTarget(value) {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function setBadge(tabId, badge) {
  chrome.action.setBadgeText({ tabId, text: badge.text });
  chrome.action.setBadgeBackgroundColor({ tabId, color: badge.color });
  if (chrome.action.setBadgeTextColor) {
    chrome.action.setBadgeTextColor({ tabId, color: "#0f172a" });
  }
}

function clearBadge(tabId) {
  chrome.action.setBadgeText({ tabId, text: "" });
}

async function runScan(url) {
  const normalizedUrl = toScanTarget(url);
  if (!normalizedUrl) {
    return { ok: false, error: "Unsupported page URL." };
  }

  const cached = scanCache.get(normalizedUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, report: cached.report, fromCache: true };
  }

  if (inFlightScans.has(normalizedUrl)) {
    return inFlightScans.get(normalizedUrl);
  }

  const scanPromise = (async () => {
    try {
      const apiOrigin = await getApiOrigin();
      const response = await fetch(`${apiOrigin}/api/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: normalizedUrl })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          payload && typeof payload.error === "string" ? payload.error : "Could not scan this URL right now.";
        return { ok: false, error: message };
      }
      if (!payload || typeof payload !== "object" || typeof payload.grade !== "string" || !Array.isArray(payload.results)) {
        return { ok: false, error: "Unexpected API response." };
      }
      scanCache.set(normalizedUrl, {
        report: payload,
        expiresAt: Date.now() + CACHE_TTL_MS
      });
      return { ok: true, report: payload, fromCache: false };
    } catch {
      return { ok: false, error: "Network error while calling /api/check." };
    } finally {
      inFlightScans.delete(normalizedUrl);
    }
  })();

  inFlightScans.set(normalizedUrl, scanPromise);
  return scanPromise;
}

async function updateBadgeForTab(tabId, tabUrl) {
  const target = toScanTarget(tabUrl);
  if (!target) {
    clearBadge(tabId);
    return;
  }

  setBadge(tabId, { text: "...", color: "#334155" });
  const scanResult = await runScan(target);
  if (!scanResult.ok) {
    setBadge(tabId, { text: "!", color: "#64748b" });
    return;
  }

  const normalizedGrade = String(scanResult.report.grade || "F").trim().toUpperCase();
  const style = GRADE_BADGE_STYLE[normalizedGrade] || GRADE_BADGE_STYLE.F;
  setBadge(tabId, style);
}

async function refreshActiveTabBadge() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab || typeof activeTab.id !== "number") return;
  await updateBadgeForTab(activeTab.id, activeTab.url);
}

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    const stored = await chrome.storage.sync.get(API_ORIGIN_STORAGE_KEY);
    if (typeof stored[API_ORIGIN_STORAGE_KEY] !== "string" || !stored[API_ORIGIN_STORAGE_KEY].trim()) {
      await setApiOrigin(DEFAULT_API_ORIGIN);
    }
    await refreshActiveTabBadge();
  })();
});

chrome.runtime.onStartup.addListener(() => {
  void refreshActiveTabBadge();
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  if (!tab || typeof tab.id !== "number") return;
  await updateBadgeForTab(tab.id, tab.url);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!tab.active) return;
  void updateBadgeForTab(tabId, tab.url);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object" || typeof message.type !== "string") {
    sendResponse({ ok: false, error: "Invalid message." });
    return false;
  }

  if (message.type === "RUN_SCAN") {
    void (async () => {
      const result = await runScan(message.url);
      const senderTabId = sender.tab && typeof sender.tab.id === "number" ? sender.tab.id : null;
      if (senderTabId !== null && result.ok) {
        const normalizedGrade = String(result.report.grade || "F").trim().toUpperCase();
        const style = GRADE_BADGE_STYLE[normalizedGrade] || GRADE_BADGE_STYLE.F;
        setBadge(senderTabId, style);
      }
      sendResponse(result);
    })();
    return true;
  }

  if (message.type === "GET_API_ORIGIN") {
    void (async () => {
      const apiOrigin = await getApiOrigin();
      sendResponse({ ok: true, apiOrigin });
    })();
    return true;
  }

  if (message.type === "SET_API_ORIGIN") {
    void (async () => {
      const apiOrigin = await setApiOrigin(message.value);
      scanCache.clear();
      sendResponse({ ok: true, apiOrigin });
    })();
    return true;
  }

  sendResponse({ ok: false, error: "Unknown message type." });
  return false;
});
