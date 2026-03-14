# @security-header-checker/cli

Lightweight CLI for running Security Header Checker scans from local scripts and CI pipelines.

## Usage

```bash
px @security-header-checker/cli https://example.com
```

## Options

- `--json` Print JSON output for automation.
- `--fail-under <grade>` Exit with code `1` when the returned grade is below your threshold.
- `--api-key <key>` Use API key auth for higher rate limits.
- `--timeout <ms>` Timeout for the API request.

## Examples

```bash
# Human-friendly output
px @security-header-checker/cli https://example.com

# CI mode: fail when grade is lower than B
px @security-header-checker/cli https://example.com --fail-under B

# JSON output + API key
px @security-header-checker/cli https://example.com --json --api-key "$SECURITY_HEADERS_API_KEY"
```
