# Public supplier leakage baseline

Captured: 2026-08-20
Baseline commit: `e244ba6 Build homepage visual foundation`
Scope: current source routes, shared components, metadata, sitemap, and generated `dist` output before confidentiality corrections.

## Route baseline

- Generated HTML routes: 235 index pages plus the standalone 404 output.
- Sitemap URLs: 233.
- Public catalogue routes: 203.
- Public brand routes: 11 (the `/brands/` index plus 10 supplier pages).
- Every public catalogue URL uses `/products/[manufacturer]/[slug]/`; therefore all 203 disclose a supplier slug.
- The shared header and footer expose `/brands/` links throughout the site.

## Text disclosures in generated public files

Counts below include generated HTML, XML, CSS, JavaScript, JSON, text, and SVG files.

| Disclosure pattern | Occurrences | Files |
| --- | ---: | ---: |
| Vinyl-Pro / Vinyl Pro | 224 | 22 |
| Window City | 553 | 38 |
| Masonite | 209 | 19 |
| Trimlite | 104 | 14 |
| Novatech | 491 | 23 |
| Verre Select | 309 | 29 |
| Mennie | 1,171 | 85 |
| Richersons | 458 | 36 |
| Oceanview | 146 | 8 |
| Vista | 15 | 5 |
| `/brands/` | 1,011 | 237 |
| Manufacturer / supplier terminology | 3,227 | 237 |
| Public model labels | 165 | 165 |

Configured supplier domains and raw `sourceUrl` / `sourceDescription` field names were not found in generated text output. Product JSON-LD is not currently emitted, so no Product brand/manufacturer field exists to remove at baseline. Organization JSON-LD identifies only Window Replacement Pro.

## Product-page disclosures

- 203 pages expose the supplier in the route.
- Product titles and metadata reuse supplier product names.
- Product headings can expose source collection and exact model identity.
- 165 product pages visibly render a model label.
- 73 product pages publicly link raw manufacturer documents.
- Product image alt text combines the supplier product title and manufacturer name.
- Product galleries use supplier-identifying `/images/catalog/[supplier]/...` paths.
- Product notes explicitly describe manufacturer verification.

## Public assets and documents

| Public tree | Files | Approximate size |
| --- | ---: | ---: |
| `public/images/catalog/` | 1,726 | 282.1 MB |
| `public/documents/catalog/` | 89 | 202.7 MB |
| `public/images/site/` | 12 | 0.45 MB |

The current build copies all 89 supplier PDFs and all 1,726 supplier catalogue images into `dist`. At least 2,040 generated file paths contain a supplier identifier. The 12 homepage derivatives also use supplier/model-identifying filenames.

## Shared-interface disclosures

- Desktop navigation: Brands.
- Mobile navigation: Manufacturers.
- Footer: Manufacturers.
- Homepage hero: represented-manufacturer count.
- Homepage: manufacturer-library section and manufacturer links.
- Homepage featured cards: manufacturer names, supplier titles, model-derived links, and supplier-specific alt text.
- Category pages: available-manufacturer sections and brand links.
- Brand pages: public supplier directory, descriptions, collections, models, and catalogue links.

## Deployment-safety result

Baseline result: FAIL.

Because Astro copies the current `public` directory into `dist`, internal supplier media and documents are deployable even when no page links them. The internal evidence library itself remains authoritative and must be preserved; the production public directory must be separated from it.

## Baseline conclusion

No current supplier-backed product page passes the new confidentiality gate without at least a supplier-neutral URL review. Four homepage products have sufficiently verified facts and clean product-specific media to be considered for an explicit curated neutral identity. The other 199 should remain category-only until individually reviewed.
