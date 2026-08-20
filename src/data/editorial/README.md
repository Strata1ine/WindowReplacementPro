# Customer-facing editorial data

This directory is the WindowReplacement.pro editorial layer. It deliberately sits above the supplier evidence and normalized catalogue layers:

1. `source-media/` and supplier manifests preserve acquired source evidence and provenance.
2. `src/data/catalog/` preserves merged supplier identities, normalized facts, and existing editorial drafts.
3. This directory maps those records into customer categories, product families, reviewed media/document selections, comparison fields, and publication workflow states.

Supplier files are inputs, never editorial output targets. Running the taxonomy builder must not rewrite a supplier manifest, discovery JSON, downloaded asset, or normalized fact.

## Generated files

- `products.json` — one editorial overlay for every merged catalogue record.
- `relationships.json` — manufacturer → collection → canonical-product families, variant parents, and deterministic related-product links.
- `media-selections.json` — public-safe hero/gallery/technical/finish/configuration choices plus category media pools. The complete source archive remains in the manifests.
- `document-selections.json` — current public documents separated from reference-only documents.
- `taxonomy.json` — controlled categories, attributes, states, specification vocabulary, comparison schemas, and the writing standard.

Regenerate with `python scripts/build-taxonomy.py` and validate with `npm run validate:taxonomy`.

Publication status is not inferred from downloaded media. A record advances only when the required facts and original editorial have passed the relevant review gate. Variant/configuration and source-only records cannot create independent product routes.
