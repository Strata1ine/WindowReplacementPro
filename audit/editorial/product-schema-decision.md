# Public product schema semantic decision

Date: 2026-08-21

## Decision

All 40 indexed public catalogue routes represent homeowner comparison groups rather than one discrete manufacturer SKU. A route may resolve to more than one compatible product after measurement, performance review and configuration work. `ProductGroup` is therefore a closer semantic fit than `Product` for this public layer.

The WRP reference is emitted as `productGroupID`, not `sku`. It identifies the public comparison group and does not claim to be a manufacturer SKU, MPN or GTIN. The schema describes the public name, summary, neutral media, category, first-party URL, documented comparison properties and the dimensions along which the final choice can vary.

## Public-safety constraints

The implementation intentionally omits:

- manufacturer and brand;
- supplier identity or source URLs;
- SKU, GTIN and MPN;
- offers, prices and availability;
- ratings and reviews;
- `hasVariant` records that would imply unsupported discrete public variants.

Window Replacement Pro is represented separately by the existing organization schema and is never identified as the product manufacturer.

## Revisit condition

A future route may use `Product` only if it represents one discrete, publicly named item with evidence-backed identifiers and properties that can be disclosed without breaching supplier confidentiality. That condition is not met by the current 40 public comparison pages.