# Supplier ingestion

This standard-library Python crawler is limited to supplier sites for which Window Replacement Pro has media-use authorization. It favors auditability and false negatives over collecting generic pages or unrelated assets.

## Safe workflow

Test one supplier with a conservative page/asset budget before a full run:

```bash
python scripts/ingest/crawl.py --supplier novatech --max-pages 20 --max-assets 30 --no-download
python scripts/ingest/crawl.py --supplier novatech --max-pages 120 --max-assets 250 --resume
npm run validate:catalog
```

Run all configured suppliers only after the targeted manifests have been reviewed:

```bash
npm run ingest
npm run ingest:audit
```

Unknown supplier slugs fail before any output is written. `--supplier` may be repeated. Other safety controls include `--max-pages`, `--max-assets`, `--max-response-mb`, `--max-asset-mb`, `--timeout`, `--retries`, `--delay`, `--resume`, and `--no-download`.

## Storage guarantees

- Each supplier owns `src/data/catalog/discovered/<supplier>.json`; targeted runs cannot erase another supplier's records.
- Product output is written to a temporary file, parsed again, and atomically moved into place.
- Empty or structurally invalid crawls leave the prior supplier catalogue untouched and exit non-zero.
- Checkpoints live at `source-media/manifests/<supplier>.checkpoint.json` and are ignored by Git.
- Completed manifests record pages, errors, assets, hashes, source-page provenance and crawl timestamps.
- The legacy `src/data/catalog/discovered-products.json` is retained as an empty migration backup but is not loaded by the site.

## Crawl and classification policy

- Page redirects must remain on configured page domains.
- Assets must remain on configured asset domains (or page domains when no separate list is supplied).
- Content types and response sizes are restricted.
- Requests retry transient failures with exponential backoff and retain a crawl delay.
- Canonical URLs are normalized and deduplicated.
- HTML decoding considers HTTP and document charset declarations.
- Generic home, category, archive and navigation pages are rejected unless strong product evidence exists.
- Product JSON-LD, model identifiers, detail terms, URL shape and supplier hints contribute to classification.
- Multi-category suppliers use explicit rules plus semantic inference; ambiguity becomes `unclassified`.
- Unclassified records remain available for review but are never published by Astro.

## Media policy

The crawler prioritizes JSON-LD product images, product hero/gallery images, technical drawings and linked PDFs. Favicons, logos, sprites, tracking pixels, generic Open Graph images and unrelated page graphics are ignored. Shared assets retain every associated source-page URL rather than only the first discovery.

Supplier copy and source snapshots are reference material. Customer-facing descriptions must remain original.
