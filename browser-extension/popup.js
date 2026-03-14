const GRADE_CLASSNAMES = new Set(["grade--A", "grade--B", "grade--C", "grade--D", "grade--F", "grade--neutral"]);

const state = {
  activeUrl: null,
  apiOrigin: null
};

const urlTextEl = document.getElementById("urlText");
const gradePillEl = document.getElementById("gradePill");
const summaryTextEl = document.getElementById("summaryText");
const summaryMetaEl = document.getElementById("summaryMeta");
const headerCountEl = document.getElementById("headerCount");
const resultsListEl = document.getElementById("resultsList");
const cookieCountEl = document.getElementById("cookieCount");
const cookieSummaryTextEl = document.getElementById("cookieSummaryText");
const cookieListEl = document.getElementById("cookieList");
const fullReportLinkEl = document.getElementById("fullReportLink");
const rescanButtonEl = document.getElementById("rescanButton");
const apiOriginInputEl = document.getElementById("apiOriginInput");
const saveApiOriginButtonEl = document.getElementById("saveApiOriginButton");

function setGrade(grade) {
  for (const className of GRADE_CLASSNAMES) {
    gradePillEl.classList.remove(className);
  }
  const normalized = typeof grade === "string" ? grade.trim().toUpperCase() : "--";
  if (["A", "B", "C", "D", "F"].includes(normalized)) {
    gradePillEl.classList.add(`grade--${normalized}`);
    gradePillEl.textContent = normalized;
    return;
  }
  gradePillEl.classList.add("grade--neutral");
  gradePillEl.textContent = "--";
}

function toDisplayUrl(value) {
  if (!value) return "No active page URL";
  return value.length > 64 ? `${value.slice(0, 61)}...` : value;
}

function setLoading() {
  setGrade("--");
  summaryTextEl.textContent = "Scanning current page…";
  summaryMetaEl.textContent = "Calling /api/check";
  headerCountEl.textContent = "0 headers";
  resultsListEl.innerHTML = "";
  cookieCountEl.textContent = "0 cookies";
  cookieSummaryTextEl.textContent = "Checking Set-Cookie security…";
  cookieListEl.innerHTML = "";
  const item = document.createElement("li");
  item.className = "result-item";
  item.innerHTML = '<span class="result-label">Working...</span><span class="status-chip">pending</span>';
  resultsListEl.append(item);
}

function createStatusChip(status) {
  const normalized = typeof status === "string" ? status.trim().toLowerCase() : "missing";
  const chip = document.createElement("span");
  chip.className = `status-chip status-chip--${normalized === "good" || normalized === "weak" ? normalized : "missing"}`;
  chip.textContent = normalized;
  return chip;
}

function renderResults(report) {
  setGrade(report.grade);
  const score = Number.isFinite(report.score) ? report.score : 0;
  const fallbackTotal = Array.isArray(report.results) ? report.results.length * 2 : 0;
  const total = Number.isFinite(report.maxScore) ? report.maxScore : fallbackTotal;
  summaryTextEl.textContent = `Grade ${report.grade} · ${score}/${total}`;
  summaryMetaEl.textContent = `Status ${report.statusCode} · ${new Date(report.checkedAt).toLocaleTimeString()}`;

  const results = Array.isArray(report.results) ? report.results : [];
  headerCountEl.textContent = `${results.length} headers`;
  resultsListEl.innerHTML = "";

  if (results.length === 0) {
    const item = document.createElement("li");
    item.className = "result-item";
    item.innerHTML = '<span class="result-label">No header breakdown available.</span>';
    resultsListEl.append(item);
    return;
  }

  for (const result of results) {
    const item = document.createElement("li");
    item.className = "result-item";
    const label = document.createElement("span");
    label.className = "result-label";
    label.textContent = typeof result.label === "string" ? result.label : "Unknown header";
    item.append(label, createStatusChip(result.status));
    resultsListEl.append(item);
  }

  const cookieAnalysis =
    report && typeof report.cookieAnalysis === "object" && report.cookieAnalysis
      ? report.cookieAnalysis
      : null;
  const cookies = cookieAnalysis && Array.isArray(cookieAnalysis.cookies) ? cookieAnalysis.cookies : [];
  cookieCountEl.textContent = `${cookies.length} cookies`;
  cookieSummaryTextEl.textContent =
    cookieAnalysis && typeof cookieAnalysis.summary === "string"
      ? cookieAnalysis.summary
      : "No Set-Cookie headers were returned by this response.";
  cookieListEl.innerHTML = "";

  if (cookies.length === 0) {
    const item = document.createElement("li");
    item.className = "result-item";
    item.innerHTML = '<span class="result-label">No cookies found in this response.</span>';
    cookieListEl.append(item);
    return;
  }

  for (const cookie of cookies.slice(0, 6)) {
    const item = document.createElement("li");
    item.className = "result-item";
    const label = document.createElement("span");
    label.className = "result-label";
    const name = typeof cookie.name === "string" && cookie.name.trim() ? cookie.name : "Unnamed cookie";
    const grade = typeof cookie.grade === "string" ? cookie.grade : "?";
    label.textContent = `${name} (Grade ${grade})`;
    item.append(label, createStatusChip(cookie.status));
    cookieListEl.append(item);
  }

  if (cookies.length > 6) {
    const moreItem = document.createElement("li");
    moreItem.className = "result-item";
    const remaining = cookies.length - 6;
    moreItem.innerHTML = `<span class="result-label">+${remaining} more cookie${remaining === 1 ? "" : "s"} in full report</span>`;
    cookieListEl.append(moreItem);
  }
}

function updateFullReportLink() {
  if (!state.apiOrigin || !state.activeUrl) {
    fullReportLinkEl.removeAttribute("href");
    fullReportLinkEl.setAttribute("aria-disabled", "true");
    return;
  }
  const url = `${state.apiOrigin}/?rescan=${encodeURIComponent(state.activeUrl)}`;
  fullReportLinkEl.href = url;
  fullReportLinkEl.removeAttribute("aria-disabled");
}

function normalizePageUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function readApiOrigin() {
  const response = await chrome.runtime.sendMessage({ type: "GET_API_ORIGIN" });
  if (!response || !response.ok || typeof response.apiOrigin !== "string") {
    return null;
  }
  return response.apiOrigin;
}

async function scanActivePage() {
  if (!state.activeUrl) {
    setGrade("--");
    summaryTextEl.textContent = "Unsupported page";
    summaryMetaEl.textContent = "Only http/https pages can be scanned.";
    resultsListEl.innerHTML = "";
    headerCountEl.textContent = "0 headers";
    cookieCountEl.textContent = "0 cookies";
    cookieSummaryTextEl.textContent = "Cookie scan unavailable.";
    cookieListEl.innerHTML = "";
    return;
  }

  setLoading();
  const response = await chrome.runtime.sendMessage({ type: "RUN_SCAN", url: state.activeUrl });
  if (!response || !response.ok) {
    setGrade("--");
    summaryTextEl.textContent = "Scan failed";
    summaryMetaEl.textContent =
      response && typeof response.error === "string" ? response.error : "Could not complete scan.";
    resultsListEl.innerHTML = "";
    cookieCountEl.textContent = "0 cookies";
    cookieSummaryTextEl.textContent = "Cookie scan unavailable.";
    cookieListEl.innerHTML = "";
    const item = document.createElement("li");
    item.className = "result-item";
    item.innerHTML = '<span class="result-label">Try again or verify API endpoint settings.</span>';
    resultsListEl.append(item);
    return;
  }

  renderResults(response.report);
}

async function bootstrap() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.activeUrl = normalizePageUrl(activeTab && activeTab.url);
  urlTextEl.textContent = toDisplayUrl(state.activeUrl);

  state.apiOrigin = await readApiOrigin();
  if (state.apiOrigin) {
    apiOriginInputEl.value = state.apiOrigin;
  }
  updateFullReportLink();
  await scanActivePage();
}

saveApiOriginButtonEl.addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({
    type: "SET_API_ORIGIN",
    value: apiOriginInputEl.value
  });
  if (!response || !response.ok || typeof response.apiOrigin !== "string") {
    summaryMetaEl.textContent = "Could not save API origin.";
    return;
  }
  state.apiOrigin = response.apiOrigin;
  apiOriginInputEl.value = response.apiOrigin;
  updateFullReportLink();
  summaryMetaEl.textContent = "API origin updated.";
  await scanActivePage();
});

rescanButtonEl.addEventListener("click", async () => {
  await scanActivePage();
});

void bootstrap();
