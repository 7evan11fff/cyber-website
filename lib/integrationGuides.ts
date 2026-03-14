export type IntegrationSlug =
  | "github-actions"
  | "gitlab-ci"
  | "jenkins"
  | "slack"
  | "teams"
  | "pagerduty";

export type IntegrationCard = {
  slug: IntegrationSlug;
  name: string;
  icon: string;
  description: string;
};

export type IntegrationGuideStep = {
  id: string;
  title: string;
  description: string;
  code?: string;
  codeLanguage?: "yaml" | "bash" | "json" | "typescript" | "groovy";
};

export type IntegrationGuide = {
  slug: IntegrationSlug;
  name: string;
  icon: string;
  summary: string;
  intro: string;
  prerequisites: string[];
  steps: IntegrationGuideStep[];
};

export const INTEGRATION_CARDS: IntegrationCard[] = [
  {
    slug: "github-actions",
    name: "GitHub Actions",
    icon: "🐙",
    description: "Fail pull requests automatically when a security-header grade drops below your policy."
  },
  {
    slug: "gitlab-ci",
    name: "GitLab CI",
    icon: "🦊",
    description: "Add a merge-request gate that checks your live domain with the same grade thresholds."
  },
  {
    slug: "jenkins",
    name: "Jenkins",
    icon: "🤖",
    description: "Run header scans inside scripted pipelines and block deploy stages when checks fail."
  },
  {
    slug: "slack",
    name: "Slack webhooks",
    icon: "💬",
    description: "Route watchlist grade-change notifications into a dedicated channel for faster triage."
  },
  {
    slug: "teams",
    name: "Microsoft Teams",
    icon: "📣",
    description: "Transform webhook payloads into Adaptive Cards your security and platform teams can act on."
  },
  {
    slug: "pagerduty",
    name: "PagerDuty",
    icon: "🚨",
    description: "Escalate severe grade regressions from watchlist scans into incident workflows."
  }
];

const GITHUB_ACTIONS_WORKFLOW = `name: Security Header Gate

on:
  pull_request:
  push:
    branches: [main]

jobs:
  security-headers:
    runs-on: ubuntu-latest
    steps:
      - name: Install jq
        run: sudo apt-get update && sudo apt-get install -y jq

      - name: Fail build when grade is below B
        env:
          API_BASE_URL: https://security-header-checker.vercel.app
          TARGET_URL: https://example.com
          MIN_GRADE: B
          SECURITY_HEADERS_API_KEY: \${{ secrets.SECURITY_HEADERS_API_KEY }}
        run: |
          set -euo pipefail

          response="$(curl -fsS "$API_BASE_URL/api/check" \\
            -X POST \\
            -H "Content-Type: application/json" \\
            -H "Authorization: Bearer $SECURITY_HEADERS_API_KEY" \\
            -d "{\\"url\\":\\"$TARGET_URL\\"}")"

          grade="$(echo "$response" | jq -r '.grade // empty' | tr '[:lower:]' '[:upper:]')"
          score="$(echo "$response" | jq -r '.score // "n/a"')"

          rank() {
            case "$1" in
              A) echo 5 ;;
              B) echo 4 ;;
              C) echo 3 ;;
              D) echo 2 ;;
              F) echo 1 ;;
              *) echo 0 ;;
            esac
          }

          if [ -z "$grade" ]; then
            echo "Scan failed: $response" >&2
            exit 1
          fi

          if [ "$(rank "$grade")" -lt "$(rank "$MIN_GRADE")" ]; then
            echo "Grade gate failed: grade=$grade score=$score minimum=$MIN_GRADE" >&2
            exit 1
          fi

          echo "Grade gate passed: grade=$grade score=$score minimum=$MIN_GRADE"`;

const GITLAB_CI_EXAMPLE = `stages:
  - security

security_headers_gate:
  stage: security
  image: alpine:3.21
  variables:
    API_BASE_URL: "https://security-header-checker.vercel.app"
    TARGET_URL: "https://example.com"
    MIN_GRADE: "B"
  before_script:
    - apk add --no-cache curl jq bash
  script:
    - response="$(curl -fsS "$API_BASE_URL/api/check" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $SECURITY_HEADERS_API_KEY" -d "{\\"url\\":\\"$TARGET_URL\\"}")"
    - grade="$(echo "$response" | jq -r '.grade // empty' | tr '[:lower:]' '[:upper:]')"
    - test "$grade" = "A" -o "$grade" = "B"
  only:
    - merge_requests
    - main`;

const JENKINSFILE_EXAMPLE = `pipeline {
  agent any
  environment {
    API_BASE_URL = 'https://security-header-checker.vercel.app'
    TARGET_URL = 'https://example.com'
    MIN_GRADE = 'B'
    SECURITY_HEADERS_API_KEY = credentials('security-headers-api-key')
  }
  stages {
    stage('Security header gate') {
      steps {
        sh '''
          set -euo pipefail
          response="$(curl -fsS "$API_BASE_URL/api/check" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $SECURITY_HEADERS_API_KEY" -d "{\\"url\\":\\"$TARGET_URL\\"}")"
          grade="$(echo "$response" | jq -r '.grade // empty' | tr '[:lower:]' '[:upper:]')"
          [ "$grade" = "A" ] || [ "$grade" = "B" ]
        '''
      }
    }
  }
}`;

const WATCHLIST_WEBHOOK_PAYLOAD_EXAMPLE = `{
  "domain": "example.com",
  "previousGrade": "A",
  "newGrade": "C",
  "timestamp": "2026-03-14T09:30:00.000Z"
}`;

const SLACK_RELAY_EXAMPLE = `import { NextResponse } from "next/server";

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL!;

type WatchlistPayload = {
  domain: string;
  previousGrade: string;
  newGrade: string;
  timestamp: string;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as WatchlistPayload;

  const text = [
    ":shield: *Security Header grade changed*",
    \`Domain: \${payload.domain}\`,
    \`From: \${payload.previousGrade} -> \${payload.newGrade}\`,
    \`At: \${payload.timestamp}\`
  ].join("\\n");

  const slackResponse = await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });

  if (!slackResponse.ok) {
    return NextResponse.json({ error: "Slack delivery failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}`;

const TEAMS_ADAPTIVE_CARD_EXAMPLE = `{
  "type": "message",
  "attachments": [
    {
      "contentType": "application/vnd.microsoft.card.adaptive",
      "content": {
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "type": "AdaptiveCard",
        "version": "1.4",
        "body": [
          { "type": "TextBlock", "weight": "Bolder", "size": "Medium", "text": "Security Header Grade Changed" },
          { "type": "FactSet", "facts": [
            { "title": "Domain", "value": "example.com" },
            { "title": "Previous", "value": "A" },
            { "title": "Current", "value": "C" },
            { "title": "Time", "value": "2026-03-14T09:30:00.000Z" }
          ]}
        ]
      }
    }
  ]
}`;

const TEAMS_RELAY_EXAMPLE = `import { NextResponse } from "next/server";

const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL!;

type WatchlistPayload = {
  domain: string;
  previousGrade: string;
  newGrade: string;
  timestamp: string;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as WatchlistPayload;

  const cardBody = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", text: "Security Header Grade Changed", weight: "Bolder", size: "Medium" },
            { type: "FactSet", facts: [
              { title: "Domain", value: payload.domain },
              { title: "Previous", value: payload.previousGrade },
              { title: "Current", value: payload.newGrade },
              { title: "Time", value: payload.timestamp }
            ]}
          ]
        }
      }
    ]
  };

  const teamsResponse = await fetch(TEAMS_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cardBody)
  });

  if (!teamsResponse.ok) {
    return NextResponse.json({ error: "Teams delivery failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}`;

const PAGERDUTY_EVENT_EXAMPLE = `{
  "routing_key": "PAGERDUTY_INTEGRATION_KEY",
  "event_action": "trigger",
  "payload": {
    "summary": "Security header grade drop on example.com (A -> D)",
    "source": "security-header-checker",
    "severity": "critical",
    "timestamp": "2026-03-14T09:30:00.000Z",
    "custom_details": {
      "domain": "example.com",
      "previousGrade": "A",
      "newGrade": "D"
    }
  }
}`;

export const INTEGRATION_GUIDES: Record<IntegrationSlug, IntegrationGuide> = {
  "github-actions": {
    slug: "github-actions",
    name: "GitHub Actions",
    icon: "🐙",
    summary:
      "Run Security Header Checker in GitHub Actions and fail pull requests when the returned grade is below B.",
    intro:
      "Use this guide to add a policy gate to your CI pipeline so regressions are caught before merges or deploys.",
    prerequisites: [
      "A Security Header Checker API key stored as SECURITY_HEADERS_API_KEY in GitHub Actions secrets.",
      "A target URL that is reachable from GitHub-hosted runners.",
      "A desired minimum grade threshold (for example, B)."
    ],
    steps: [
      {
        id: "workflow",
        title: "Add the GitHub Actions workflow",
        description:
          "Create .github/workflows/security-header-gate.yml. The job calls /api/check, reads the grade, and exits non-zero when the grade is below MIN_GRADE.",
        code: GITHUB_ACTIONS_WORKFLOW,
        codeLanguage: "yaml"
      }
    ]
  },
  "gitlab-ci": {
    slug: "gitlab-ci",
    name: "GitLab CI",
    icon: "🦊",
    summary: "Use GitLab CI to enforce minimum security-header grades in merge requests.",
    intro:
      "This example mirrors the same grade gate used in GitHub Actions, but fits directly in .gitlab-ci.yml.",
    prerequisites: [
      "SECURITY_HEADERS_API_KEY stored as a masked CI/CD variable.",
      "A target URL under your control.",
      "curl, jq, and bash available in the CI image."
    ],
    steps: [
      {
        id: "gitlab-pipeline",
        title: "Add the security gate job",
        description:
          "Paste this in .gitlab-ci.yml to block merge requests when the returned grade is below B.",
        code: GITLAB_CI_EXAMPLE,
        codeLanguage: "yaml"
      }
    ]
  },
  jenkins: {
    slug: "jenkins",
    name: "Jenkins",
    icon: "🤖",
    summary: "Run a security-header grade check in Jenkins scripted pipelines.",
    intro:
      "If your team deploys from Jenkins, use this stage to halt the pipeline unless the target stays at A or B.",
    prerequisites: [
      "Jenkins credentials entry named security-headers-api-key.",
      "jq installed on the agent image.",
      "Outbound access from Jenkins to Security Header Checker."
    ],
    steps: [
      {
        id: "jenkins-stage",
        title: "Add a pipeline stage for grade checks",
        description:
          "Use this Jenkinsfile snippet to call the API and fail the stage unless the grade is acceptable.",
        code: JENKINSFILE_EXAMPLE,
        codeLanguage: "groovy"
      }
    ]
  },
  slack: {
    slug: "slack",
    name: "Slack webhooks",
    icon: "💬",
    summary: "Deliver watchlist grade-change notifications into Slack channels through a relay endpoint.",
    intro:
      "Security Header Checker sends raw watchlist webhook payloads. A small relay lets you format them as human-friendly Slack alerts.",
    prerequisites: [
      "A Slack Incoming Webhook URL for your destination channel.",
      "A relay endpoint URL that Security Header Checker can POST to.",
      "At least one watchlist entry with scheduled scans enabled."
    ],
    steps: [
      {
        id: "payload",
        title: "Confirm the watchlist webhook payload",
        description:
          "This is the JSON body sent by Security Header Checker whenever a watchlist domain grade changes.",
        code: WATCHLIST_WEBHOOK_PAYLOAD_EXAMPLE,
        codeLanguage: "json"
      },
      {
        id: "relay",
        title: "Create a Slack relay endpoint",
        description:
          "Deploy this Next.js route (or equivalent serverless function). Then add the relay URL in Settings > Integrations > Webhook endpoints.",
        code: SLACK_RELAY_EXAMPLE,
        codeLanguage: "typescript"
      }
    ]
  },
  teams: {
    slug: "teams",
    name: "Microsoft Teams",
    icon: "📣",
    summary: "Convert watchlist grade-change webhooks into Microsoft Teams Adaptive Cards.",
    intro:
      "A relay endpoint can turn raw Security Header Checker webhook payloads into rich cards with context for responders.",
    prerequisites: [
      "A Teams channel webhook URL.",
      "A relay endpoint URL to transform incoming watchlist events.",
      "Watchlist domains configured in Security Header Checker."
    ],
    steps: [
      {
        id: "adaptive-card",
        title: "Use this Adaptive Card message format",
        description: "This JSON payload can be posted to Teams after you map fields from the incoming watchlist event.",
        code: TEAMS_ADAPTIVE_CARD_EXAMPLE,
        codeLanguage: "json"
      },
      {
        id: "teams-relay",
        title: "Add a relay that builds and sends the card",
        description:
          "Deploy this handler and register its URL in Security Header Checker webhook settings so grade changes are forwarded to Teams.",
        code: TEAMS_RELAY_EXAMPLE,
        codeLanguage: "typescript"
      }
    ]
  },
  pagerduty: {
    slug: "pagerduty",
    name: "PagerDuty",
    icon: "🚨",
    summary: "Escalate high-severity header regressions into PagerDuty incidents.",
    intro:
      "Use a relay to evaluate the new grade and only trigger incidents when risk crosses your severity threshold.",
    prerequisites: [
      "A PagerDuty Events API v2 integration key.",
      "A relay endpoint to map watchlist webhook payloads to PagerDuty events.",
      "An internal severity policy (for example, trigger on D/F only)."
    ],
    steps: [
      {
        id: "pagerduty-payload",
        title: "Send a PagerDuty Events API payload",
        description:
          "Use this request body from your relay when a watchlist grade drop should trigger an incident.",
        code: PAGERDUTY_EVENT_EXAMPLE,
        codeLanguage: "json"
      }
    ]
  }
};

export function getIntegrationGuide(slug: string): IntegrationGuide | null {
  return INTEGRATION_GUIDES[slug as IntegrationSlug] ?? null;
}

export function getAllIntegrationGuides(): IntegrationGuide[] {
  return Object.values(INTEGRATION_GUIDES);
}
