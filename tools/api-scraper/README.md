# Proxmox API Scraper

This Playwright-based scraper downloads the Proxmox VE API viewer payload (`apidoc.js`) and
stores a normalized JSON snapshot for downstream tooling.

## Usage

```bash
npm run scraper:scrape
```

The command launches Chromium headlessly, retrieves the documentation bundle, parses the
`apiSchema` payload, and writes a deterministic snapshot to
`tools/api-scraper/data/raw/proxmox-openapi-schema.json`. Override the target by setting the
`SCRAPER_BASE_URL` environment variable or by passing `--base-url <url>` through npm (for example,
`npm run scraper:scrape -- --base-url https://staging.example/pve-docs/api-viewer/`).

The snapshot includes:

- Metadata describing the scrape (`scrapedAt`, `documentTitle`, totals)
- A sorted tree of API groups and endpoints with HTTP methods and parameter schemas

To inspect or diff new scrapes run the command again and compare the JSON output. The structure is
stable—changes in Proxmox upstream documentation translate directly into git diffs.

## Troubleshooting

- Ensure Playwright browsers are installed (`npx playwright install`) if the scraper fails to
  launch Chromium.
- Network access to `https://pve.proxmox.com` is required. Set the `https_proxy`/`http_proxy`
  environment variables if routing through a proxy.
- Re-run `npm install` when dependencies change to keep the `tsx` runtime and TypeScript compiler in sync.
