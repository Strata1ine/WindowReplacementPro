# Supplier ingestion

This crawler is for the ten supplier sites for which Window Replacement Pro has received media-use authorization.

## Run

```bash
python scripts/ingest/crawl.py
```

Useful during development:

```bash
python scripts/ingest/crawl.py --supplier novatech --max-pages 120
python scripts/ingest/crawl.py --supplier mennie-canada --max-pages 100 --no-download
```

The crawler:

1. Crawls only configured supplier domains.
2. Saves source HTML snapshots to `source-media/<supplier>/html/`.
3. Downloads referenced product images to `public/images/catalog/<supplier>/`.
4. Downloads linked PDFs to `public/documents/catalog/<supplier>/`.
5. Hashes every downloaded asset and stores provenance in `source-media/manifests/<supplier>.json`.
6. Produces `src/data/catalog/discovered-products.json` for Astro.

Source snapshots/manifests remain audit evidence. Production assets are separate and can later be passed through image optimization.

The crawler intentionally does not rewrite supplier copy into site copy. Product descriptions on WindowReplacement.pro should be original; supplier text is source/reference material.
