import unittest

from scripts.editorial_taxonomy import (
    HISTORICAL_CANONICAL_IDS,
    SOURCE_ONLY_IDS,
    VARIANT_PARENTS,
    build_all,
    build_related,
    classify_product,
    record_class,
    select_media,
)


def enrichment(**facts):
    return {
        "productId": "fixture:item",
        "sourceFacts": {"normalized": {key: {"value": value, "sources": []} for key, value in facts.items()}},
        "editorial": {"status": "incomplete"},
    }


class TaxonomyTests(unittest.TestCase):
    def test_fixed_casement_is_fixed_not_operating_casement(self):
        item = {"name": "Fixed Casement", "type": "Fixed Casement", "collection": None, "modelNumber": None, "category": "windows"}
        result = classify_product(item, enrichment(operatingStyle="Fixed Casement"))
        self.assertEqual(result["primaryCategory"], "fixed-windows")

    def test_privacy_rating_is_direct_privacy_evidence(self):
        item = {"name": "Design 10", "type": "Door Glass", "collection": None, "modelNumber": None, "category": "door-glass"}
        result = classify_product(item, enrichment(**{"Privacy Rating": "8/10"}))
        self.assertEqual(result["primaryCategory"], "privacy-door-glass")
        self.assertIn("privacy-glass", result["attributes"])

    def test_attributes_are_not_assigned_without_evidence(self):
        item = {"name": "Model A", "type": None, "collection": None, "modelNumber": "A", "category": "windows"}
        result = classify_product(item, enrichment(operatingStyle="Awning"))
        self.assertNotIn("triple-pane", result["attributes"])
        self.assertNotIn("egress-documented", result["attributes"])

    def test_reconciliation_classes_are_explicit(self):
        for product_id in VARIANT_PARENTS:
            self.assertEqual(record_class(product_id, set()), "variant-configuration")
        for product_id in SOURCE_ONLY_IDS:
            self.assertEqual(record_class(product_id, set()), "source-only")
        for product_id in HISTORICAL_CANONICAL_IDS:
            self.assertEqual(record_class(product_id, set()), "canonical-product")

    def test_uncertain_media_cannot_be_selected(self):
        path = "/images/catalog/fixture/item.jpg"
        product = {"id": "fixture:item", "media": [path]}
        asset = {"local_path": path, "asset_type": "image", "role": "product-hero", "relationship_state": "uncertain/review", "sha256": "a" * 64}
        selection = select_media(product, "canonical-product", {path: [asset]})
        self.assertIsNone(selection["heroMedia"])
        self.assertEqual(selection["galleryMedia"], [])

    def test_related_products_exclude_unpublished_and_source_only(self):
        records = [
            {"productId": "a", "recordClass": "canonical-product", "editorialState": "published", "rootCategory": "door-glass", "primaryCategory": "decorative-door-glass", "secondaryCategories": [], "manufacturer": "one", "familyId": "one:x"},
            {"productId": "b", "recordClass": "canonical-product", "editorialState": "facts-ready", "rootCategory": "door-glass", "primaryCategory": "decorative-door-glass", "secondaryCategories": [], "manufacturer": "one", "familyId": "one:x"},
            {"productId": "c", "recordClass": "source-only", "editorialState": "source-only", "rootCategory": "door-glass", "primaryCategory": "decorative-door-glass", "secondaryCategories": [], "manufacturer": "one", "familyId": "one:x"},
        ]
        related = build_related(records)
        self.assertEqual(related["b"], ["a"])
        self.assertEqual(related["c"], [])

    def test_full_build_preserves_expected_counts(self):
        result = build_all(write=False)
        records = result["products"]["records"]
        self.assertEqual(len(records), 542)
        self.assertEqual(sum(item["liveCanonical"] for item in records), 524)
        self.assertEqual(sum(item["historicalCanonical"] for item in records), 3)
        self.assertEqual(sum(item["recordClass"] == "variant-configuration" for item in records), 12)
        self.assertEqual(sum(item["recordClass"] == "source-only" for item in records), 3)
        self.assertEqual(sum(item["editorialState"] == "published" for item in records), 203)


if __name__ == "__main__":
    unittest.main()
