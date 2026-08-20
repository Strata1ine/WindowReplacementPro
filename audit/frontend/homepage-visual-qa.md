# Homepage visual QA

Date: 2026-08-20

Scope: global visual system, production header and footer, supplier-neutral homepage, and four approved public product pages.

## Outcome

The production homepage foundation passes its visual, interaction, content-gating, route, and media checks.

- Internal editorially published product count remains **203**.
- Public identity-approved product routes: **4**.
- Products held pending supplier-neutral identity review: **199**.
- Featured products: **4**, all with reviewed neutral identities and approved product-specific media.
- Supplier names, domains, model identifiers, source paths, and workflow labels visible in browser QA: **0**.
- Broken homepage links: **0**.
- Broken or incomplete homepage images: **0**.
- Browser runtime errors: **0**.
- Browser network failures: **0**.
- Horizontal overflow at the tested widths: **0**.

## Data and publication controls

Homepage product choices, specifications, and media originate in the internal catalogue/editorial layer but cross a separate supplier-neutral public identity gate before rendering.

Publication requirements used by the homepage:

- canonical product record;
- editorial state is `published`;
- matching publishable catalogue and taxonomy records;
- reviewed public display name, slug, reference, summary, and specifications;
- supplier-neutral public media path and alt text;
- featured media relationship is `product-specific`;
- no public supplier documents, source URLs, provenance, or internal identifiers.

The homepage does not surface source-only, facts-ready, or identity-unapproved records. Empty or unfinished taxonomy groups are omitted.

The four featured products are:

1. Slim-Frame Casement Window - WRP-W001
2. Two-Panel Fiberglass Entry Door - WRP-D001
3. Black Linear Privacy Door Glass - WRP-G001
4. Multi-Panel Sliding Patio Door - WRP-P001

## Media handling

Four approved editorial hero selections feed the neutral public media plan. The media build generated 12 metadata-stripped derivatives at practical display widths.

The live site points only at `/media/products/wrp-*` paths. The internal source archive and complete provenance remain unchanged, but supplier identity, source URLs, hashes, and internal product IDs are not present in public HTML or client data.

Visual review found no generic logo, watermark, navigation asset, supplier-shared, collection-shared, or uncertain asset presented as product media. A compositor-safe contain mode and decoded-pixel QA gate cover portrait product imagery.

## Responsive review

| Width | Result | Document width | Horizontal overflow | Broken images |
| --- | --- | ---: | --- | ---: |
| 375 px | Pass | 375 px | No | 0 |
| 768 px | Pass | 768 px | No | 0 |
| 1280 px | Pass | 1280 px | No | 0 |
| 1600 px | Pass | 1600 px | No | 0 |

The 375 px and 768 px passes use exact CSS viewport widths. The 1280 px and 1600 px passes exercise the desktop navigation and wider editorial layout.

## Navigation and accessibility

- One page-level H1 is present.
- A keyboard skip link is available and only becomes visible with keyboard-visible focus.
- The desktop Products menu opens and closes.
- The mobile menu begins hidden with `aria-expanded="false"`.
- Opening the mobile menu reveals a full-width 375 px navigation panel, sets `aria-expanded="true"`, and locks background scrolling.
- Escape closes the mobile menu, restores `aria-expanded="false"`, and returns focus to the menu button.
- The mobile menu and desktop product menu use real links; no inert navigation controls were added.
- All homepage internal links returned successful responses in browser QA.

There is no configured customer phone number or contact endpoint in the repository. The implementation therefore does not invent contact details or submit a fake quote form. The quote CTA is an honest project-entry interface that routes to published window, entry-door, and patio-door paths.

## Screenshot evidence

- [Desktop homepage, 1280 px](screenshots/homepage-desktop-1280.png)
- [Wide homepage, 1600 px](screenshots/homepage-wide-1600.png)
- [Tablet homepage, 768 px](screenshots/homepage-tablet-768.png)
- [Mobile homepage, 375 px](screenshots/homepage-mobile-375.png)
- [Desktop header and Products menu](screenshots/desktop-header-menu.png)
- [Mobile menu](screenshots/mobile-menu.png)
- [Featured product cards](screenshots/featured-product-cards.png)
- [Window product page](screenshots/product-window.png)
- [Entry-door product page](screenshots/product-entry-door.png)
- [Door-glass product page](screenshots/product-door-glass.png)
- [Patio-door product page](screenshots/product-patio-door.png)
- [Desktop footer](screenshots/footer-desktop.png)

## QA method

The repository includes `npm run qa:homepage`, which uses the installed local Chrome browser through the Chrome DevTools Protocol. It records viewport dimensions, overflow, image state, decoded visual-content ratios, neutral-path checks, supplier-term checks, link responses, runtime errors, network failures, menu state, four representative product-page checks, and screenshot evidence.

The in-app browser runtime could not start on this Windows machine because its sandbox helper failed DPAPI decryption. Local Chrome was used as the controlled fallback. Mobile-menu interaction state is recorded before a screenshot-only positioning adjustment used because Chrome full-page capture otherwise omits fixed overlays.

## Design review

The approved direction uses:

- dark forest, warm cream, white, and lime accent colours;
- compact display typography with restrained body copy;
- editorial split layouts and bordered comparison structures;
- real published product imagery;
- moderate radii and minimal shadow;
- no invented logo mark, testimonials, ratings, badges, phone number, or service claims.

Broader frontend propagation, guide redesign, and location redesign remain out of scope for this phase.

## Repository validation

| Check | Result |
| --- | --- |
| `npm run validate:catalog` | Pass - 542 catalogue records; catalogue and enrichment integrity OK |
| `npm run validate:taxonomy` | Pass - 203 published canonical products |
| `npm run ingest:audit` | Pass |
| `npm test` | Pass - catalogue merge, 89 crawler, 7 taxonomy, and public identity-gate tests |
| `npm run check` | Pass - 0 errors, 0 warnings, 0 hints |
| `npm run build` | Pass - 26 pages built; post-build leakage audit passed |
| `npm run verify` | Pass - 4 identity-approved product routes and 23 sitemap URLs validated |
| `npm run audit:supplier-completeness` | Pass - 10 suppliers and 524 live products inventoried; no crawl was run |
| `npm run audit:public-supplier-leakage` | Pass - 41 generated files scanned; 0 supplier names, domains, slugs, raw documents, provenance fields, or internal directories |
