"""Validate the generated customer taxonomy and editorial publication controls."""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

from editorial_taxonomy import (
    EDITORIAL,
    HISTORICAL_CANONICAL_IDS,
    PUBLIC_DOCUMENT_ROLES,
    ROOT,
    ROOT_BY_SOURCE_CATEGORY,
    SOURCE_ONLY_IDS,
    VARIANT_PARENTS,
    build_all,
    load_json,
    merge_catalog,
)


def main() -> int:
    errors: list[str] = []
    taxonomy = load_json(EDITORIAL / "taxonomy.json")
    products_payload = load_json(EDITORIAL / "products.json")
    relationships = load_json(EDITORIAL / "relationships.json")
    media_payload = load_json(EDITORIAL / "media-selections.json")
    documents_payload = load_json(EDITORIAL / "document-selections.json")
    gaps = load_json(ROOT / "audit" / "editorial" / "category-content-gaps.json")
    report_path = ROOT / "audit" / "editorial" / "taxonomy-report.md"

    records = products_payload.get("records", [])
    by_id = {item.get("productId"): item for item in records}
    merged = merge_catalog()
    merged_by_id = {item["id"]: item for item in merged}
    if len(by_id) != len(records):
        errors.append("editorial products contain duplicate productId values")
    if set(by_id) != set(merged_by_id):
        errors.append("editorial products do not exactly cover the merged catalogue")

    roots = {item["id"]: item for item in taxonomy["roots"]}
    child_to_root = {child: root_id for root_id, root in roots.items() for child in root["children"]}
    categories = set(roots) | set(child_to_root)
    attributes = set(taxonomy["attributes"])
    use_cases = set(taxonomy["customerUseCases"])
    classes = set(taxonomy["recordClasses"])
    states = set(taxonomy["editorialStates"])
    spec_keys = set(taxonomy["specificationVocabulary"])

    route_keys: set[tuple[str, str]] = set()
    for product_id, item in by_id.items():
        source = merged_by_id.get(product_id, {})
        here = f"products[{product_id}]"
        route = (item.get("manufacturer"), item.get("slug"))
        if route in route_keys:
            errors.append(f"{here}: duplicate manufacturer/slug route")
        route_keys.add(route)
        expected_root = ROOT_BY_SOURCE_CATEGORY.get(source.get("category"))
        if item.get("rootCategory") != expected_root:
            errors.append(f"{here}: rootCategory does not match source category")
        primary = item.get("primaryCategory")
        if primary not in categories:
            errors.append(f"{here}: unknown primaryCategory {primary}")
        if primary != expected_root and child_to_root.get(primary) != expected_root:
            errors.append(f"{here}: primaryCategory is impossible for {expected_root}")
        secondary = item.get("secondaryCategories", [])
        if primary in secondary:
            errors.append(f"{here}: primaryCategory repeated as secondary")
        for category in secondary:
            if category not in categories or child_to_root.get(category) != expected_root:
                errors.append(f"{here}: invalid or impossible secondary category {category}")
        if not set(item.get("attributes", [])).issubset(attributes):
            errors.append(f"{here}: invalid attribute reference")
        if not set(item.get("customerUseCases", [])).issubset(use_cases):
            errors.append(f"{here}: invalid customer use-case reference")
        if item.get("recordClass") not in classes:
            errors.append(f"{here}: invalid recordClass")
        if item.get("editorialState") not in states:
            errors.append(f"{here}: invalid editorialState")
        structural_materials = {"fiberglass", "steel", "wood"} & set(item.get("attributes", []))
        if len(structural_materials) > 1:
            errors.append(f"{here}: conflicting structural material attributes {sorted(structural_materials)}")
        if not set(item.get("canonicalSpecifications", {})).issubset(spec_keys):
            errors.append(f"{here}: canonical specification is outside the vocabulary")
        comparison = item.get("comparison", {})
        schema = taxonomy["comparisonSchemas"].get(expected_root, {})
        populated = set(comparison.get("populatedFields", []))
        missing = set(comparison.get("missingFields", []))
        schema_fields = set(schema.get("fields", []))
        if populated | missing != schema_fields or populated & missing:
            errors.append(f"{here}: comparison fields do not partition the category schema")
        if comparison.get("ready") != (len(populated) >= schema.get("minimumPopulatedFields", 999)):
            errors.append(f"{here}: comparison readiness is inconsistent")

    live_ids = {product["id"] for path in sorted((ROOT / "source-media" / "manifests").glob("*.json")) if path.name != "verified-source-inventory.json" for product in load_json(path).get("products", [])}
    mapped_live = {item["productId"] for item in records if item.get("liveCanonical")}
    historical = {item["productId"] for item in records if item.get("historicalCanonical")}
    if mapped_live != live_ids or len(live_ids) != 524:
        errors.append(f"live canonical identity coverage mismatch: expected source set of 524, found {len(mapped_live)}")
    if historical != HISTORICAL_CANONICAL_IDS:
        errors.append("historical canonical product set changed")
    if {item["productId"] for item in records if item["recordClass"] == "variant-configuration"} != set(VARIANT_PARENTS):
        errors.append("variant/configuration set changed")
    if {item["productId"] for item in records if item["recordClass"] == "source-only"} != SOURCE_ONLY_IDS:
        errors.append("source-only product set changed")

    families = {item["familyId"]: item for item in relationships.get("collections", [])}
    canonical_ids = {item["productId"] for item in records if item["recordClass"] == "canonical-product"}
    published_ids = {item["productId"] for item in records if item["editorialState"] in {"publishable", "published"}}
    for variant in relationships.get("variantParents", []):
        variant_id = variant.get("variantId")
        parent_id = variant.get("parentProductId")
        collection_id = variant.get("parentCollectionId")
        if variant_id not in VARIANT_PARENTS:
            errors.append(f"variant relationship has unknown variant {variant_id}")
        if parent_id is not None and parent_id not in canonical_ids:
            errors.append(f"variant {variant_id} has a missing canonical parent")
        if collection_id not in families or not families[collection_id].get("canonicalProductIds"):
            errors.append(f"variant {variant_id} is orphaned from a canonical collection")
    for item in records:
        if item["recordClass"] == "source-only" and (item["productId"] in published_ids or item.get("publicationPreserved")):
            errors.append(f"source-only record is publishable: {item['productId']}")
        related = item.get("relatedProductIds", [])
        if len(related) != len(set(related)) or len(related) > 4 or item["productId"] in related:
            errors.append(f"products[{item['productId']}]: invalid related-product list")
        for related_id in related:
            target = by_id.get(related_id)
            if not target or related_id not in published_ids or target["recordClass"] != "canonical-product" or target["rootCategory"] != item["rootCategory"]:
                errors.append(f"products[{item['productId']}]: invalid related target {related_id}")

    enrichment = load_json(ROOT / "src" / "data" / "catalog" / "enrichment-records.json")
    previous_publishable = {item["productId"] for item in enrichment if item.get("editorial", {}).get("status") == "draft"}
    if published_ids != previous_publishable or len(published_ids) != 203:
        errors.append(f"existing publication set was not preserved exactly: expected 203, found {len(published_ids)}")

    media_by_id = {item["productId"]: item for item in media_payload.get("products", [])}
    documents_by_id = {item["productId"]: item for item in documents_payload.get("products", [])}
    if set(media_by_id) != set(by_id) or set(documents_by_id) != set(by_id):
        errors.append("media/document selections do not cover every catalogue record")
    for product_id, selection in media_by_id.items():
        public_media = []
        if selection.get("heroMedia"):
            public_media.append(selection["heroMedia"])
            if selection["heroMedia"].get("relationshipState") != "product-specific":
                errors.append(f"media[{product_id}]: hero is not product-specific")
        for key in ("galleryMedia", "technicalMedia", "finishMedia", "configurationMedia"):
            public_media.extend(selection.get(key, []))
        if by_id[product_id]["recordClass"] != "canonical-product" and public_media:
            errors.append(f"media[{product_id}]: non-canonical record has public media")
        seen = set()
        for media in public_media:
            state = media.get("relationshipState")
            if state in {"uncertain", "uncertain/review", "review", "rejected"}:
                errors.append(f"media[{product_id}]: uncertain/rejected media selected")
            path = media.get("localPath")
            key = media.get("sha256") or path
            if key in seen:
                errors.append(f"media[{product_id}]: duplicated selected binary")
            seen.add(key)
            if not path or not (ROOT / "public" / path.lstrip("/")).is_file():
                errors.append(f"media[{product_id}]: selected path is missing: {path}")

    public_document_count = 0
    for product_id, selection in documents_by_id.items():
        for document in selection.get("publicDocuments", []):
            public_document_count += 1
            if by_id[product_id]["recordClass"] != "canonical-product":
                errors.append(f"documents[{product_id}]: non-canonical record has a public document")
            if document.get("relationshipState") in {"uncertain", "uncertain/review", "review", "rejected"}:
                errors.append(f"documents[{product_id}]: uncertain document selected")
            if document.get("freshness", {}).get("status") != "current-source-linked":
                errors.append(f"documents[{product_id}]: stale/unknown document is public")
            if document.get("role") not in PUBLIC_DOCUMENT_ROLES:
                errors.append(f"documents[{product_id}]: unapproved public document role")
            path = document.get("localPath")
            if not path or not (ROOT / "public" / path.lstrip("/")).is_file():
                errors.append(f"documents[{product_id}]: public path is missing: {path}")

    for root, pool in media_payload.get("categoryMediaPools", {}).items():
        if root not in roots:
            errors.append(f"category media pool has unknown root {root}")
        for media in pool:
            product = by_id.get(media.get("productId"))
            if not product or product["editorialState"] != "published" or product["rootCategory"] != root or media.get("relationshipState") != "product-specific":
                errors.append(f"category media pool {root} contains an invalid item")

    if set(gaps.get("categories", {})) != set(roots):
        errors.append("category content-gap audit does not cover every root category")
    if not report_path.is_file() or "Customer-facing taxonomy" not in report_path.read_text(encoding="utf-8"):
        errors.append("human-readable taxonomy report is missing or invalid")

    regenerated = build_all(write=False)
    generated_pairs = [
        ("products", products_payload),
        ("relationships", relationships),
        ("media", media_payload),
        ("documents", documents_payload),
        ("gaps", gaps),
    ]
    for key, persisted in generated_pairs:
        if regenerated[key] != persisted:
            errors.append(f"generated {key} data is stale; run npm run build:taxonomy")
    if regenerated["report"] != report_path.read_text(encoding="utf-8"):
        errors.append("generated taxonomy report is stale; run npm run build:taxonomy")

    class_counts = Counter(item["recordClass"] for item in records)
    state_counts = Counter(item["editorialState"] for item in records)
    hero_count = sum(bool(item.get("heroMedia")) for item in media_by_id.values())
    gallery_count = sum(bool(item.get("galleryMedia")) for item in media_by_id.values())
    comparison_ready = sum(item.get("comparison", {}).get("ready", False) for item in records if item["recordClass"] == "canonical-product")
    print(f"Taxonomy records: {len(records)}")
    print(f"Live canonical identities mapped: {len(mapped_live)}")
    print(f"Historical canonical products: {len(historical)}")
    print(f"Record classes: {dict(class_counts)}")
    print(f"Editorial states: {dict(state_counts)}")
    print(f"Products with selected hero: {hero_count}")
    print(f"Products with curated gallery: {gallery_count}")
    print(f"Public document relationships: {public_document_count}")
    print(f"Comparison-ready canonical products: {comparison_ready}")
    if errors:
        print(f"Taxonomy validation: FAILED ({len(errors)} error(s))", file=sys.stderr)
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print("Taxonomy validation: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
