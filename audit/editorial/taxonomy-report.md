# Customer-facing taxonomy and editorial readiness

Generated from the frozen ten-supplier source library on `2026-08-20T12:00:00-04:00`. Supplier manifests, discovery files, and acquired binaries are read-only inputs to this layer.

## Taxonomy tree

- Replacement Windows
  - Casement, awning, single/double hung, single/double slider, end vent, picture, fixed, bay, bow, architectural/custom
- Entry Doors
  - Fiberglass, steel, modern, contemporary, traditional, craftsman, full-glass, decorative-glass, double, sidelites, transoms
- Door Glass
  - Modern, decorative, privacy, clear, internal blinds, venting
- Patio Doors
  - Sliding, stacking, PVC, aluminum, hybrid, oversized, internal blinds

Assignments are evidence-gated. A product remains at its root category when a narrower subcategory is not supported by its canonical identity or normalized supplier facts.

## Record reconciliation

- Merged catalogue records: **542**
- Live canonical supplier identities mapped: **524**
- Historical canonical products retained: **3**
- Customer-facing canonical product records: **527**
- Variant/configuration records: **12**
- Source-only records: **3**
- Product families: **29** collections across **10** manufacturers

The 12 Mennie sidelite records are configurations, not independent customer pages. Nine have exact canonical slab parents; three Oak Grain sidelites remain collection-level configurations because the source library has no matching live slab identity. Three previously published Trimlite model records remain historical canonical products, while three non-current Verre Select names remain searchable source evidence and cannot publish.

## Customer-facing category counts

| Root category | Live canonical | Historical canonical | Customer-facing canonical |
|---|---:|---:|---:|
| door-glass | 190 | 0 | 190 |
| entry-doors | 273 | 3 | 276 |
| patio-doors | 22 | 0 | 22 |
| replacement-windows | 39 | 0 | 39 |

### Primary subcategory distribution

| Primary category | Products |
|---|---:|
| fiberglass-entry-doors | 235 |
| door-glass | 115 |
| clear-door-glass | 32 |
| entry-doors | 28 |
| privacy-door-glass | 20 |
| steel-entry-doors | 13 |
| internal-blinds-door-glass | 12 |
| patio-doors | 12 |
| fixed-windows | 10 |
| decorative-door-glass | 8 |
| sliding-patio-doors | 8 |
| awning-windows | 6 |
| casement-windows | 6 |
| single-slider-windows | 5 |
| double-slider-windows | 3 |
| venting-door-glass | 3 |
| end-vent-windows | 2 |
| picture-windows | 2 |
| replacement-windows | 2 |
| single-hung-windows | 2 |
| stacking-patio-doors | 2 |
| double-hung-windows | 1 |

## Editorial states

| State | Records |
|---|---:|
| source-only | 31 |
| facts-ready | 308 |
| editorial-draft | 0 |
| editorial-reviewed | 0 |
| publishable | 0 |
| published | 203 |

Existing publication decisions are preserved for **203** customer-facing canonical records; **0** previously publishable records are withheld. Media acquisition alone never advances a state.

## Media, documents, and comparison readiness

- Products with a selected product-specific hero: **437 / 527**
- Products with a curated gallery beyond the hero: **194 / 527**
- Products with at least one current public document: **126 / 527**
- Current public document relationships: **170**
- Comparison-ready products: **201 / 527**

Uncertain/review and rejected media are excluded from every public selection. Supplier-shared technical, finish, and configuration assets can remain in their explicitly labelled roles, but never become a product hero. Stale or unknown documents remain reference-only.

## Attribute distribution

| Attribute | Products |
|---|---:|
| fiberglass | 255 |
| pvc | 50 |
| clear-glass | 49 |
| energy-efficient | 48 |
| triple-pane | 38 |
| decorative-glass | 26 |
| double-pane | 24 |
| privacy-glass | 24 |
| sidelite | 16 |
| internal-blinds | 15 |
| full-glass | 14 |
| steel | 13 |
| black-finish | 7 |
| aluminum | 6 |
| venting | 5 |
| wood | 3 |
| hybrid | 2 |
| oversized | 2 |

## Customer-use-case distribution

| Use case | Products |
|---|---:|
| traditional-design | 106 |
| controlled-ventilation | 28 |
| maximum-daylight | 26 |
| privacy | 20 |
| space-saving-operation | 18 |
| entry-sidelite | 16 |
| contemporary-design | 7 |
| wide-opening | 5 |

## Major content gaps

Gap priorities: **critical=68, high=259, low=159, medium=28**.

The machine-readable queue is `audit/editorial/category-content-gaps.json`. Highest-priority work is evidence or editorial review for commercially important records, followed by product-specific hero selection, comparison-field completion, and current document curation. Thin pages must not be published to close a count gap.

## Deterministic related products

Related products are drawn only from published canonical records. Ranking is root category → exact primary style/material → shared secondary categories → collection → manufacturer, with product ID as the stable tie-breaker. Source-only and configuration records are never recommendations.

## Ambiguous decisions retained for review

- `mennie-canada:wg-2p-180-sl`, `mennie-canada:wg-2psl`, and `mennie-canada:wg8-2psl` are Oak Grain collection-level configurations because no exact live canonical slab parent exists.
- Products without direct evidence for a narrower style remain at their root category; no category was inferred merely to improve counts.
- Shared supplier documents are public only when current, explicitly attached to the record, and assigned an approved document role.
- Current published routes retain their existing publication decision; the new state model does not certify their prose as newly human-reviewed.
