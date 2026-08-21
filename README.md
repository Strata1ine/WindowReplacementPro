# WindowReplacement.pro

Static-first Astro website for Window Replacement Pro with a structured, auditable supplier-ingestion pipeline.

## Stack

- Astro + TypeScript
- @astrojs/sitemap
- Git
- Static Astro output deployed to Hostinger over SSH
- Python standard-library crawler for supplier ingestion

## Local development

```bash
npm ci
python -m pip install -r requirements-ci.txt
npm run dev
```

Requires Node.js 22.19.0 or newer and Python 3.10 or newer.

## Supplier ingestion

The frozen ten-supplier source library currently contains **524 live canonical supplier identities** plus separately classified historical, configuration, and source-only records. Supplier crawling is not part of the editorial workflow; acquired evidence is preserved while customer-facing taxonomy and content are developed in independent layers.

```bash
npm run ingest
npm run ingest:audit
```

Target one supplier while developing:

```bash
python scripts/ingest/crawl.py --supplier novatech --max-pages 150
python scripts/ingest/crawl.py --supplier mennie-canada --max-pages 120
```

The ingestion pipeline:

1. Crawls only configured supplier domains.
2. Saves source HTML snapshots under `source-media/<supplier>/html/`.
3. Downloads discovered product images to `public/images/catalog/<supplier>/`.
4. Downloads linked PDFs to `public/documents/catalog/<supplier>/`.
5. Hashes downloaded files and records source-page provenance.
6. Writes one audit manifest per supplier to `source-media/manifests/`.
7. Atomically updates that supplier's file under `src/data/catalog/discovered/` only after a viable, validated crawl.
8. Merges live-discovered records with the curated catalog at Astro build time.
9. Generates per-model routes at `/products/<manufacturer>/<model>/` only for records that meet the publication threshold.
10. Adds publishable models to `/brands/<manufacturer>/` while retaining incomplete records for enrichment.

See `scripts/ingest/README.md` for details.

## Content architecture

- `src/data/products.ts` — normalized customer-facing product categories
- `src/data/manufacturers.ts` — supplier/manufacturer records
- `src/data/catalog/curated-products.json` — verified product/model seed records
- `src/data/catalog/discovered/*.json` — independent last-known-good crawler output per supplier
- `src/data/catalog-schema.ts` — runtime normalization, deterministic merge and publication rules
- `src/data/catalog.ts` — automatic catalogue loading and query layer
- `src/data/editorial/` — controlled customer taxonomy, product-family relationships, editorial workflow states, media/document selections and comparison readiness
- `src/data/editorial.ts` — typed query entry point for the editorial overlays
- `audit/editorial/` — taxonomy report and prioritized category content gaps
- `src/data/locations.ts` — service-area records
- `src/pages/products/[manufacturer]/[slug].astro` — generated supplier-model pages
- `public/images/catalog/` — downloaded production media
- `public/documents/catalog/` — downloaded manufacturer PDFs
- `source-media/` — master source snapshots and provenance; mostly gitignored

## Production build

```bash
npm run build:taxonomy
npm run validate:taxonomy
npm run verify
```

`build:taxonomy` deterministically regenerates the editorial overlays from the frozen catalogue and source manifests. `verify` runs Astro diagnostics, catalogue and taxonomy validation, merge/crawler/taxonomy tests, and the production build. Deployment must not proceed unless it passes.

## Production deployment

Production follows this path:

```text
Codex/local development
-> commit
-> push main
-> GitHub Actions
-> verification
-> Astro build
-> SSH/rsync
-> Hostinger public_html
-> windowreplacement.pro
```

The `Deploy to Hostinger` GitHub Actions workflow runs automatically for pushes to `main` and can also be started manually with `workflow_dispatch` from the repository's Actions tab. Feature branches never deploy. The workflow runs `npm ci`, the complete verification suite, the public supplier-leakage audit and a final Astro build before it opens an SSH connection. A failed gate stops the job before deployment.

The repository requires these GitHub Actions secrets; never commit their values:

- `HOSTINGER_SSH_HOST`
- `HOSTINGER_SSH_PORT`
- `HOSTINGER_SSH_USER`
- `HOSTINGER_SSH_PRIVATE_KEY`
- `HOSTINGER_DEPLOY_PATH`

Only the contents of `dist/` are synchronized to the Hostinger document root. The workflow validates that both the configured and canonical remote paths end with `/domains/windowreplacement.pro/public_html` before running `rsync` with deletion enabled. This guard must not be weakened or removed.

To inspect a deployment, open GitHub Actions, choose **Deploy to Hostinger**, and open the run for the relevant commit. The verification, SSH, synchronization and HTTPS smoke-test steps have separate logs. Secret values are masked and must not be added to diagnostic output.

To disable automatic production deployment, disable the `Deploy to Hostinger` workflow in GitHub Actions or remove/comment only its `push` trigger in `.github/workflows/deploy-hostinger.yml`. Keep `workflow_dispatch` when manual deployments should remain available. The existing verification workflow is independent and should remain enabled.

## Media repository policy

Supplier source snapshots are not intended for Git. Before the full media library becomes large, move master originals to object storage and either keep only optimized website assets in Git or serve catalog assets directly from the CDN/R2 layer.

## Important SEO rule

Do not mass-publish thin location × product combinations. Add a generated route only when it has unique search value and enough local/product evidence to justify indexing. Supplier wording is reference material; WindowReplacement.pro page copy should remain original.

Catalogue records remain available for enrichment even when they are not publishable. Product routes require a valid supplier/category/source, a non-placeholder title, and either a useful summary or meaningful specifications. Placeholder guides, projects and locations are withheld from indexed route generation.

## GitHub push

Create an empty repository named `windowreplacement-pro`, then:

```bash
git remote add origin git@github.com:YOUR-ACCOUNT/windowreplacement-pro.git
git branch -M main
git push -u origin main
```
