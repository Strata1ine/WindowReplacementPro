# WindowReplacement.pro

Static-first Astro website for Window Replacement Pro with a structured, auditable supplier-ingestion pipeline.

## Stack

- Astro + TypeScript
- @astrojs/sitemap
- Git
- Cloudflare Pages-ready static output
- Python standard-library crawler for supplier ingestion

## Local development

```bash
npm install
npm run dev
```

## Supplier ingestion

The project currently has **270 curated product/model records** verified against the current public supplier sites on 2026-08-19. Those records provide a useful catalog immediately; the live crawler then enriches them with discovered product pages, images and PDFs.

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
7. Generates `src/data/catalog/discovered-products.json`.
8. Merges live-discovered records with the curated catalog at Astro build time.
9. Generates per-model routes at `/products/<manufacturer>/<model>/`.
10. Adds each manufacturer's models to `/brands/<manufacturer>/`.

See `scripts/ingest/README.md` for details.

## Content architecture

- `src/data/products.ts` — normalized customer-facing product categories
- `src/data/manufacturers.ts` — supplier/manufacturer records
- `src/data/catalog/curated-products.json` — verified product/model seed records
- `src/data/catalog/discovered-products.json` — crawler output
- `src/data/catalog.ts` — merge/deduplication layer
- `src/data/locations.ts` — service-area records
- `src/pages/products/[manufacturer]/[slug].astro` — generated supplier-model pages
- `public/images/catalog/` — downloaded production media
- `public/documents/catalog/` — downloaded manufacturer PDFs
- `source-media/` — master source snapshots and provenance; mostly gitignored

## Production build

```bash
npm run build
```

Cloudflare Pages settings:

- Framework preset: Astro
- Build command: `npm run build`
- Build output directory: `dist`
- Production branch: `main`

## Media repository policy

Supplier source snapshots are not intended for Git. Before the full media library becomes large, move master originals to object storage and either keep only optimized website assets in Git or serve catalog assets directly from the CDN/R2 layer.

## Important SEO rule

Do not mass-publish thin location × product combinations. Add a generated route only when it has unique search value and enough local/product evidence to justify indexing. Supplier wording is reference material; WindowReplacement.pro page copy should remain original.

## GitHub push

Create an empty repository named `windowreplacement-pro`, then:

```bash
git remote add origin git@github.com:YOUR-ACCOUNT/windowreplacement-pro.git
git branch -M main
git push -u origin main
```
