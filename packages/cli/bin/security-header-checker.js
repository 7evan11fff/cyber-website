#!/usr/bin/env node

import chalk from "chalk";

const DEFAULT_API_BASE_URL = process.env.SHC_API_BASE_URL || "https://security-header-checker.vercel.app";
const DEFAULT_TIMEOUT_MS = 15000;
const ALLOWED_API_TIMEOUTS = new Set([5000, 10000, 15000]);

const GRADE_ORDER = {
  "A+": 13,
  A: 12,
  "A-": 11,
  "B+": 10,
  B: 9,
  "B-": 8,
  "C+": 7,
  C: 6,
  "C-": 5,
  "D+": 4,
  D: 3,
  "D-": 2,
  F: 1
};

function printUsage() {
  const usage = `
${chalk.bold("Security Header Checker CLI")}

${chalk.bold("Usage")}
  px @security-header-checker/cli <url> [options]

${chalk.bold("Options")}
  --json                  Output machine-readable JSON
  --fail-under <grade>    Exit non-zero if grade is below threshold (for CI)
  --api-key <key>         API key for authenticated requests
  --timeout <ms>          Request timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --api-base-url <url>    API base URL (default: ${DEFAULT_API_BASE_URL})
  -h, --help              Show this help message
`;

  process.stdout.write(usage);
}

function normalizeGrade(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function gradeRank(value) {
  return GRADE_ORDER[normalizeGrade(value)] ?? 0;
}

function gradeMeetsThreshold(grade, minimum) {
  if (!minimum) return true;
  return gradeRank(grade) >= gradeRank(minimum);
}

function formatGrade(grade) {
  const normalized = normalizeGrade(grade);
  if (normalized.startsWith("A")) return chalk.greenBright.bold(normalized);
  if (normalized.startsWith("B")) return chalk.green.bold(normalized);
  if (normalized.startsWith("C")) return chalk.yellow.bold(normalized);
  if (normalized.startsWith("D")) return chalk.hex("#fb923c").bold(normalized);
  return chalk.red.bold(normalized || "N/A");
}

function parseArgs(argv) {
  const args = [...argv];
  const parsed = {
    url: "",
    json: false,
    failUnder: "",
    apiKey: "",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    apiBaseUrl: DEFAULT_API_BASE_URL
  };

  const nextValue = (flag) => {
    const value = args.shift();
    if (!value || value.startsWith("-")) {
      throw new Error(`Missing value for ${flag}.`);
    }
    return value;
  };

  while (args.length > 0) {
    const token = args.shift();
    if (!token) break;

    if (token === "-h" || token === "--help") {
      parsed.help = true;
      continue;
    }

    if (token === "--json") {
      parsed.json = true;
      continue;
    }

    if (token === "--fail-under") {
      parsed.failUnder = normalizeGrade(nextValue("--fail-under"));
      continue;
    }

    if (token === "--api-key") {
      parsed.apiKey = nextValue("--api-key");
      continue;
    }

    if (token === "--timeout") {
      const raw = nextValue("--timeout");
      const timeoutMs = Number.parseInt(raw, 10);
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new Error(`Invalid --timeout value "${raw}". Use a positive integer.`);
      }
      parsed.timeoutMs = timeoutMs;
      continue;
    }

    if (token === "--api-base-url") {
      parsed.apiBaseUrl = nextValue("--api-base-url");
      continue;
    }

    if (token.startsWith("-")) {
      throw new Error(`Unknown option "${token}".`);
    }

    if (!parsed.url) {
      parsed.url = token;
      continue;
    }

    throw new Error(`Unexpected argument "${token}".`);
  }

  return parsed;
}

function formatStatusIcon(status) {
  if (status === "good") {
    return chalk.green("✓");
  }
  if (status === "weak") {
    return chalk.yellow("⚠");
  }
  return chalk.red("✗");
}

function formatStatusLabel(status) {
  if (status === "good") return chalk.green("good");
  if (status === "weak") return chalk.yellow("weak");
  return chalk.red("missing");
}

function prettyPrintReport(report, options) {
  const meetsThreshold = gradeMeetsThreshold(report.grade, options.failUnder);
  const thresholdText = options.failUnder ? `${options.failUnder}` : "none";
  const divider = chalk.gray("─".repeat(58));

  process.stdout.write(`${chalk.bold.cyan("Security Header Checker")}\n`);
  process.stdout.write(`${divider}\n`);
  process.stdout.write(`${chalk.bold("URL")}    ${chalk.white(report.finalUrl)}\n`);
  process.stdout.write(`${chalk.bold("Grade")}  ${formatGrade(report.grade)}\n`);
  process.stdout.write(`${chalk.bold("Score")}  ${chalk.white(String(report.score))}\n`);
  process.stdout.write(`${chalk.bold("HTTP")}   ${chalk.white(String(report.statusCode))}\n`);
  process.stdout.write(`${chalk.bold("At")}     ${chalk.white(report.checkedAt)}\n`);
  process.stdout.write(`${chalk.bold("Gate")}   ${meetsThreshold ? chalk.green("pass") : chalk.red("fail")} (min: ${thresholdText})\n`);
  process.stdout.write(`${divider}\n`);
  process.stdout.write(`${chalk.bold("Header status")}\n`);

  for (const item of report.results || []) {
    const icon = formatStatusIcon(item.status);
    const label = chalk.white(item.label || item.key || "Unknown-Header");
    const status = formatStatusLabel(item.status);
    const valueText = item.value ? chalk.gray(` ${item.value}`) : chalk.gray(" not present");
    process.stdout.write(`  ${icon} ${label} ${chalk.dim("•")} ${status}${valueText}\n`);
  }

  process.stdout.write(`${divider}\n`);
  if (!meetsThreshold) {
    process.stdout.write(
      `${chalk.red.bold("Result: failed")} - grade ${formatGrade(report.grade)} is below ${chalk.bold(
        options.failUnder
      )}\n`
    );
  } else {
    process.stdout.write(`${chalk.green.bold("Result: passed")}\n`);
  }
}

function writeJson(data) {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

async function fetchReport(options) {
  const endpoint = new URL("/api/check", options.apiBaseUrl).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const payload = { url: options.url };
    if (ALLOWED_API_TIMEOUTS.has(options.timeoutMs)) {
      payload.options = { timeoutMs: options.timeoutMs };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {})
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const responseBody = await response
      .json()
      .catch(() => ({ error: `Unexpected response from ${endpoint}.` }));

    if (!response.ok) {
      const errorMessage =
        typeof responseBody?.error === "string"
          ? responseBody.error
          : `API request failed with status ${response.status}.`;
      throw new Error(errorMessage);
    }

    return responseBody;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  let requestedTimeoutMs = DEFAULT_TIMEOUT_MS;
  try {
    const options = parseArgs(process.argv.slice(2));
    requestedTimeoutMs = options.timeoutMs;

    if (options.help) {
      printUsage();
      process.exit(0);
      return;
    }

    if (!options.url) {
      throw new Error("Missing URL. Run with --help for usage.");
    }

    if (options.failUnder && gradeRank(options.failUnder) === 0) {
      throw new Error(`Invalid --fail-under grade "${options.failUnder}". Use A-F (plus/minus supported).`);
    }

    const report = await fetchReport(options);
    const passedThreshold = gradeMeetsThreshold(report.grade, options.failUnder);

    if (options.json) {
      writeJson({
        ok: passedThreshold,
        failUnder: options.failUnder || null,
        report
      });
    } else {
      prettyPrintReport(report, options);
    }

    process.exit(passedThreshold ? 0 : 1);
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? `Request timed out after ${requestedTimeoutMs}ms.`
        : error instanceof Error
          ? error.message
          : "Unknown error.";

    if (process.argv.includes("--json")) {
      writeJson({ ok: false, error: message });
    } else {
      process.stderr.write(`${chalk.red.bold("Error:")} ${message}\n`);
    }

    process.exit(1);
  }
}

main();
