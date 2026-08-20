# Public supplier-confidentiality final report

Date: 2026-08-20

## Outcome

The public website now uses a fail-closed, supplier-neutral catalogue layer. The internal supplier evidence, ingestion, catalogue, taxonomy, media selections, documents, manifests, and provenance remain intact and authoritative.

## Before correction

The pre-change build contained 236 generated pages and 233 sitemap URLs. It publicly generated 203 supplier-keyed product routes and 11 brand routes.

The baseline scan found supplier names across generated pages, supplier-identifying product names and models, `/brands/` references, supplier-specific product URL segments, and supplier-named media paths. It also found 89 raw supplier documents in the deployable public directory, with 73 product pages linking documents.

The detailed supplier-by-supplier baseline is preserved in [pre-change-baseline.md](pre-change-baseline.md).

## Corrected public boundary

- Public brand routes: 0.
- Public supplier/manufacturer navigation links: 0.
- Identity-approved public product routes: 4.
- Products held pending neutral public identity review: 199.
- Public product URL pattern: `/products/[category]/[public-slug]/`.
- Public media filenames: neutral `/media/products/wrp-*` derivatives.
- Public raw supplier PDFs/documents: 0.
- Public source URLs, hashes, provenance objects, internal identifiers, supplier manifests, crawler state, audit output, staging, and quarantine files: 0.
- Structured data: Organization only; no Product brand, manufacturer, model, supplier URL, offer, rating, or fabricated availability fields.
- Supplier names, configured supplier domains, supplier slugs, and supplier-specific media paths found in final generated output: 0.

Astro now deploys only `public-site/`. The original `public/` tree remains an internal evidence/archive input and is not copied to `dist/`.

## Public identity review

All 203 internally published editorial records were evaluated:

- supplier-neutral and safe: 4;
- category-only pending review: 199;
- require public rename: 199;
- require public slug change: 199;
- require media sanitization among held records: 180;
- require document removal among held records: 70.

The full record-level review is preserved in [product-identity-review.json](product-identity-review.json).

Approved public references:

1. WRP-W001 - Slim-Frame Casement Window.
2. WRP-D001 - Two-Panel Fiberglass Entry Door.
3. WRP-G001 - Black Linear Privacy Door Glass.
4. WRP-P001 - Multi-Panel Sliding Patio Door.

## Homepage and navigation changes

Removed Brands/Manufacturers navigation, represented-manufacturer counts, manufacturer libraries, supplier names, supplier models, and supplier-specific featured-product descriptions.

Added homeowner-facing product paths, operating styles, materials, glazing and configuration choices, process guidance, four neutral featured examples, neutral WRP references, and a quotation-focused disclosure.

The disclosure policy is documented in [customer-disclosure-policy.md](customer-disclosure-policy.md).

## Media handling

Twelve production derivatives are generated from four internally approved product-specific hero assets. Output filenames and paths are neutral, unnecessary metadata is rejected, supplier hotlinking is absent, and internal provenance is retained only on the internal side of the boundary.

Visual QA exposed a portrait-image compositor issue. The affected entry-door asset now uses a metadata-stripped neutral JPEG derivative, and contain-mode media uses a compositor-safe neutral background presentation while retaining semantic image alt text. Browser QA also verifies decoded product-image content.

## Route and sitemap change

- Generated pages: 236 before; 26 after.
- Sitemap URLs: 233 before; 23 after.
- Supplier-keyed product routes: 203 before; 0 after.
- Brand routes: 11 before; 0 after.
- Supplier-neutral public product routes: 0 before; 4 after.

## Verification

All required checks passed:

- `npm run validate:catalog`
- `npm run validate:taxonomy`
- `npm run ingest:audit`
- `npm test`
- `npm run check` - 0 errors, 0 warnings, 0 hints
- `npm run build` - 26 pages
- `npm run verify` - 4 approved product routes and 23 sitemap URLs
- `npm run audit:supplier-completeness` - 10 suppliers and 524 live products, no crawl
- `npm run audit:public-supplier-leakage` - 41 generated files scanned, no disclosures

Manual review covered the homepage, desktop and mobile navigation, footer, featured products, one route from each of the four public product categories, the full sitemap, generated file boundary, and JSON-LD.

Broader frontend propagation remains stopped.
