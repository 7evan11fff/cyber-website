export type WebhookKind = "slack" | "discord" | "generic";

export type GradeChangeWebhookEvent = {
  domain: string;
  oldGrade: string;
  newGrade: string;
  timestamp: string;
  checkedUrl?: string;
  test?: boolean;
};

export type WebhookDeliveryResult = {
  kind: WebhookKind;
  status: number;
};

function normalizeGrade(grade: string) {
  return grade.trim().toUpperCase();
}

function gradeToSeverity(grade: string) {
  const normalized = normalizeGrade(grade);
  if (normalized === "A") return "good";
  if (normalized === "B" || normalized === "C") return "warning";
  return "critical";
}

function gradeToDiscordColor(grade: string) {
  const normalized = normalizeGrade(grade);
  if (normalized === "A") return 0x22c55e;
  if (normalized === "B") return 0x0ea5e9;
  if (normalized === "C") return 0xf59e0b;
  if (normalized === "D") return 0xf97316;
  return 0xef4444;
}

export function normalizeWebhookUrl(input: string) {
  const parsed = new URL(input.trim());
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Webhook URL must use http or https.");
  }
  parsed.hash = "";
  return parsed.toString();
}

export function detectWebhookKind(webhookUrl: string): WebhookKind {
  const parsed = new URL(webhookUrl);
  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();

  if (hostname === "hooks.slack.com" || hostname.endsWith(".hooks.slack.com")) {
    return "slack";
  }

  if (
    (hostname === "discord.com" || hostname === "discordapp.com" || hostname.endsWith(".discord.com")) &&
    pathname.startsWith("/api/webhooks/")
  ) {
    return "discord";
  }

  return "generic";
}

function buildGenericPayload(event: GradeChangeWebhookEvent) {
  return {
    domain: event.domain,
    oldGrade: normalizeGrade(event.oldGrade),
    newGrade: normalizeGrade(event.newGrade),
    timestamp: event.timestamp,
    ...(event.checkedUrl ? { checkedUrl: event.checkedUrl } : {}),
    // Backward compatibility for older relays that still expect prior naming.
    previousGrade: normalizeGrade(event.oldGrade),
    currentGrade: normalizeGrade(event.newGrade),
    ...(event.test ? { test: true } : {})
  };
}

function buildSlackPayload(event: GradeChangeWebhookEvent) {
  const oldGrade = normalizeGrade(event.oldGrade);
  const newGrade = normalizeGrade(event.newGrade);
  const severity = gradeToSeverity(newGrade);
  const icon = severity === "critical" ? ":rotating_light:" : severity === "warning" ? ":warning:" : ":white_check_mark:";
  const modePrefix = event.test ? "[Test] " : "";
  const title = `${modePrefix}Security Header grade change`;
  const domainLine = `*Domain:* ${event.domain}`;
  const gradeLine = `*Grade:* ${oldGrade} -> ${newGrade}`;
  const timeLine = `*Timestamp:* ${event.timestamp}`;
  const urlLine = event.checkedUrl ? `*URL:* ${event.checkedUrl}` : "";
  const text = [title, domainLine, gradeLine, timeLine, urlLine].filter(Boolean).join("\n");

  return {
    text: `${icon} ${title} for ${event.domain}: ${oldGrade} -> ${newGrade}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${icon} *${title}*`
        }
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Domain*\n${event.domain}` },
          { type: "mrkdwn", text: `*Grade*\n${oldGrade} -> ${newGrade}` },
          { type: "mrkdwn", text: `*Timestamp*\n${event.timestamp}` }
        ]
      },
      ...(event.checkedUrl
        ? [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*URL*\n${event.checkedUrl}`
              }
            }
          ]
        : [])
    ],
    attachments: [
      {
        color: severity === "critical" ? "#ef4444" : severity === "warning" ? "#f59e0b" : "#22c55e",
        text
      }
    ]
  };
}

function buildDiscordPayload(event: GradeChangeWebhookEvent) {
  const oldGrade = normalizeGrade(event.oldGrade);
  const newGrade = normalizeGrade(event.newGrade);
  const modePrefix = event.test ? "[Test] " : "";
  return {
    content: `${modePrefix}Security Header grade change detected for **${event.domain}**`,
    embeds: [
      {
        title: `${modePrefix}Security Header grade change`,
        color: gradeToDiscordColor(newGrade),
        fields: [
          { name: "Domain", value: event.domain, inline: true },
          { name: "Grade", value: `${oldGrade} -> ${newGrade}`, inline: true },
          { name: "Timestamp", value: event.timestamp, inline: false },
          ...(event.checkedUrl ? [{ name: "URL", value: event.checkedUrl, inline: false }] : [])
        ],
        timestamp: event.timestamp
      }
    ]
  };
}

export function buildWebhookRequestBody(kind: WebhookKind, event: GradeChangeWebhookEvent) {
  if (kind === "slack") {
    return buildSlackPayload(event);
  }
  if (kind === "discord") {
    return buildDiscordPayload(event);
  }
  return buildGenericPayload(event);
}

export async function sendGradeChangeWebhook(
  webhookUrl: string,
  event: GradeChangeWebhookEvent
): Promise<WebhookDeliveryResult> {
  const kind = detectWebhookKind(webhookUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "SecurityHeaderChecker-Webhook/1.1"
      },
      body: JSON.stringify(buildWebhookRequestBody(kind, event))
    });
    if (!response.ok) {
      throw new Error(`webhook responded with HTTP ${response.status}`);
    }
    return { kind, status: response.status };
  } finally {
    clearTimeout(timeout);
  }
}
