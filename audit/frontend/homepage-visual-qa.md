# Homepage visual QA

Date: 2026-08-20

Scope: global visual system, production header and footer, reusable frontend foundations, and homepage only.

## Outcome

The production homepage foundation passes its visual, interaction, content-gating, route, and media checks.

- Existing published product count remains **203**.
- Homepage product paths: **4**.
- Featured products: **4**, all published canonical records with approved product-specific hero media.
- Manufacturers represented by published products: **9**.
- Source-only, facts-ready, uncertain/review, and stale labels visible on the homepage: **0**.
- Broken homepage links: **0**.
- Broken or incomplete homepage images: **0**.
- Browser runtime errors: **0**.
- Browser network failures: **0**.
- Horizontal overflow at the tested widths: **0**.

## Data and publication controls

Homepage counts, group availability, manufacturer coverage, featured products, specifications, and media are resolved through the catalogue editorial/taxonomy layer.

Publication requirements used by the homepage:

- canonical product record;
- editorial state is `published`;
- matching existing publishable catalogue record;
- featured media relationship is `product-specific`.

The homepage does not surface source-only or facts-ready product records. Empty or unfinished taxonomy groups are omitted. No unpublished location pages are linked, and no guide teaser is rendered while the guide dataset has no publishable articles.

The four featured products are:

1. Window City HC-101 Casement
2. Masonite 2 Panel Hollister
3. Novatech Infinite Black
4. Oceanview Premium Plus

## Media handling

Four approved editorial hero selections feed the homepage media plan. The media build generated 12 responsive WebP derivatives at practical display widths.

The live homepage points at `/images/site/homepage/` derivatives rather than supplier-source originals. Each rendered media object retains its source product ID, supplier, role, relationship state, source URL, source-page URLs, SHA-256, and source local path in the data layer.

Visual review found no generic logo, navigation, supplier-shared, collection-shared, or uncertain asset presented as product media.

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
- [Desktop footer](screenshots/footer-desktop.png)

## QA method

The repository includes `npm run qa:homepage`, which uses the installed local Chrome browser through the Chrome DevTools Protocol. It records viewport dimensions, overflow, image state, link responses, runtime errors, network failures, menu state, and screenshot evidence.

The in-app browser runtime could not start on this Windows machine because its sandbox helper failed DPAPI decryption. Local Chrome was used as the controlled fallback. Mobile-menu interaction state is recorded before a screenshot-only positioning adjustment used because Chrome full-page capture otherwise omits fixed overlays.

## Design review

The approved direction uses:

- dark forest, warm cream, white, and lime accent colours;
- compact display typography with restrained body copy;
- editorial split layouts and bordered comparison structures;
- real published product imagery;
- moderate radii and minimal shadow;
- no invented logo mark, testimonials, ratings, badges, phone number, or service claims.

Category, product-detail, manufacturer, guide, and location route redesign remains out of scope for this phase.

## Repository validation

| Check | Result |
| --- | --- |
| `npm run validate:catalog` | Pass - 542 catalogue records; catalogue and enrichment integrity OK |
| `npm run validate:taxonomy` | Pass - 203 published canonical products |
| `npm run ingest:audit` | Pass |
| `npm test` | Pass - 96 tests |
| `npm run check` | Pass - 0 errors, 0 warnings, 0 hints |
| `npm run build` | Pass - 236 pages built |
| `npm run verify` | Pass - 203 publishable product routes and 233 sitemap URLs validated |
| `npm run audit:supplier-completeness` | Pass - 10 suppliers and 524 live products inventoried; no crawl was run |
