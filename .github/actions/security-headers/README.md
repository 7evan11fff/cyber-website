# Security Header Checker GitHub Action

Run a security header scan in CI and fail the job when the grade is below your policy threshold.

## Inputs

- `url` (required): URL to scan.
- `fail-under` (optional): Minimum acceptable grade.
- `api-key` (optional): API key for higher rate limits.
- `timeout` (optional): Request timeout in milliseconds. Default: `15000`.
- `api-base-url` (optional): API base URL. Default: `https://security-header-checker.vercel.app`.

## Outputs

- `grade`
- `score`
- `report-url`

## Ready-to-use workflow example

```yaml
name: Security Header Scan

on:
  pull_request:
  workflow_dispatch:
    inputs:
      url:
        description: URL to scan
        required: true
        default: https://example.com

jobs:
  security-headers:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Security Header Checker
        id: headers
        uses: ./.github/actions/security-headers
        with:
          url: ${{ github.event.inputs.url || 'https://example.com' }}
          fail-under: B
          api-key: ${{ secrets.SECURITY_HEADERS_API_KEY }}

      - name: Print outputs
        run: |
          echo "Grade: ${{ steps.headers.outputs.grade }}"
          echo "Score: ${{ steps.headers.outputs.score }}"
          echo "Report URL: ${{ steps.headers.outputs['report-url'] }}"
```

The action also posts a formatted comment on pull requests with grade, score, and header-by-header status.
