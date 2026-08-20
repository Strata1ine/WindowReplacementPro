"""Build the customer-facing editorial layer without mutating supplier evidence."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "src" / "data" / "catalog"
EDITORIAL = ROOT / "src" / "data" / "editorial"
MANIFESTS = ROOT / "source-media" / "manifests"
AUDIT = ROOT / "audit" / "editorial"
GENERATED_AT = "2026-08-20T12:00:00-04:00"

VARIANT_PARENTS: dict[str, str | None] = {
    "mennie-canada:mah-fsl": "mennie-canada:mah-f",
    "mennie-canada:mah-rpsl": "mennie-canada:mah-rp",
    "mennie-canada:mah8-fsl": "mennie-canada:mah8-f",
    "mennie-canada:mah8-nrpsl": "mennie-canada:mah8-nrp",
    "mennie-canada:sm-2psl": "mennie-canada:sm-2p",
    "mennie-canada:sm-fsl": "mennie-canada:sm-f",
    "mennie-canada:sm8-fsl": "mennie-canada:sm8-f",
    "mennie-canada:wg-2p-180-sl": None,
    "mennie-canada:wg-2psl": None,
    "mennie-canada:wg-fsl": "mennie-canada:wg-f",
    "mennie-canada:wg8-2psl": None,
    "mennie-canada:wg8-fsl": "mennie-canada:wg8-f",
}

HISTORICAL_CANONICAL_IDS = {
    "trimlite:df22",
    "trimlite:drb10",
    "trimlite:drs1el",
}

SOURCE_ONLY_IDS = {
    "verre-select:canva",
    "verre-select:karma-opaque",
    "verre-select:ryu",
}

ROOT_BY_SOURCE_CATEGORY = {
    "windows": "replacement-windows",
    "entry-doors": "entry-doors",
    "door-glass": "door-glass",
    "patio-doors": "patio-doors",
}

MEDIA_ROLE_GROUPS = {
    "galleryMedia": {"product-hero", "product-gallery", "open-graph-image", "lifestyle-product", "glass-design"},
    "technicalMedia": {"technical-drawing", "profile-section"},
    "finishMedia": {"finish-swatch", "interior-option"},
    "configurationMedia": {"configuration-diagram", "hardware"},
}

PUBLIC_DOCUMENT_ROLES = {
    "brochure",
    "catalogue",
    "specification-sheet",
    "installation-guide",
    "warranty",
    "performance-document",
    "colour-chart",
}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def meaningful(value: Any) -> bool:
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, list):
        return any(meaningful(item) for item in value)
    return value is not None


def slugify(value: str) -> str:
    value = value.lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "uncollected"


def merge_catalog() -> list[dict]:
    records: dict[str, dict] = {}
    inputs = [(CATALOG / "curated-products.json", load_json(CATALOG / "curated-products.json"))]
    inputs += [(path, load_json(path)) for path in sorted((CATALOG / "discovered").glob("*.json"))]
    for _, products in inputs:
        for incoming in products:
            existing = records.get(incoming["id"])
            if not existing:
                records[incoming["id"]] = dict(incoming)
                continue
            merged = dict(existing)
            for key in ("name", "collection", "modelNumber", "type", "summary", "sourceDescription", "sourceUrl", "sourceType"):
                if meaningful(incoming.get(key)):
                    merged[key] = incoming[key]
            if incoming.get("category") != "unclassified":
                merged["category"] = incoming.get("category", merged.get("category"))
            merged["media"] = sorted(set(existing.get("media", [])) | set(incoming.get("media", [])))
            merged["documents"] = sorted(set(existing.get("documents", [])) | set(incoming.get("documents", [])))
            merged["specifications"] = {
                **existing.get("specifications", {}),
                **{key: value for key, value in incoming.get("specifications", {}).items() if meaningful(value)},
            }
            merged["lastVerified"] = max(existing.get("lastVerified", ""), incoming.get("lastVerified", ""))
            records[incoming["id"]] = merged
    return sorted(records.values(), key=lambda item: (item["manufacturer"], item["name"], item["id"]))


def load_sources() -> tuple[dict[str, dict], dict[str, list[dict]], set[str]]:
    manifests: dict[str, dict] = {}
    assets_by_path: dict[str, list[dict]] = defaultdict(list)
    live_ids: set[str] = set()
    for path in sorted(MANIFESTS.glob("*.json")):
        if path.name == "verified-source-inventory.json":
            continue
        manifest = load_json(path)
        supplier_value = manifest.get("supplier")
        supplier_slug = supplier_value if isinstance(supplier_value, str) else path.stem
        manifests[supplier_slug] = manifest
        live_ids.update(product["id"] for product in manifest.get("products", []))
        for asset in manifest.get("assets", []):
            local_path = asset.get("local_path")
            if local_path:
                assets_by_path[local_path].append(asset)
    return manifests, assets_by_path, live_ids


def fact_values(enrichment: dict | None) -> dict[str, Any]:
    if not enrichment:
        return {}
    return {
        key: fact.get("value")
        for key, fact in enrichment.get("sourceFacts", {}).get("normalized", {}).items()
        if isinstance(fact, dict) and meaningful(fact.get("value"))
    }


def text_value(value: Any) -> str:
    if isinstance(value, list):
        return " | ".join(str(item) for item in value)
    return str(value or "")


def evidence_fields(product: dict, facts: dict[str, Any]) -> dict[str, str]:
    fields = {
        "name": text_value(product.get("name")),
        "type": text_value(product.get("type")),
        "collection": text_value(product.get("collection")),
        "modelNumber": text_value(product.get("modelNumber")),
    }
    fields.update({key: text_value(value) for key, value in facts.items()})
    return {key: value for key, value in fields.items() if value.strip()}


def first_match(fields: dict[str, str], patterns: list[tuple[str, str]], keys: set[str] | None = None) -> tuple[str | None, str | None]:
    for category, pattern in patterns:
        for key, value in fields.items():
            if keys is not None and key not in keys:
                continue
            if re.search(pattern, value, re.I):
                return category, f"{key}={value}"
    return None, None


def add_supported(target: list[str], evidence: list[str], value: str, reason: str | None) -> None:
    if reason and value not in target:
        target.append(value)
        evidence.append(f"{value}: {reason}")


def classify_product(product: dict, enrichment: dict | None) -> dict:
    facts = fact_values(enrichment)
    fields = evidence_fields(product, facts)
    source_category = product.get("category")
    root = ROOT_BY_SOURCE_CATEGORY.get(source_category, "entry-doors")
    primary = root
    secondary: list[str] = []
    attributes: list[str] = []
    use_cases: list[str] = []
    evidence: list[str] = [f"sourceCategory={source_category}"]

    if source_category == "windows":
        category, reason = first_match(fields, [
            ("end-vent-windows", r"\bend[ -]?vent\b"),
            ("double-slider-windows", r"\bdouble\s+slider\b"),
            ("single-slider-windows", r"\bsingle\s+slider\b"),
            ("double-hung-windows", r"\bdouble\s+hung\b"),
            ("single-hung-windows", r"\bsingle\s+hung\b"),
            ("awning-windows", r"\bawning\b"),
            ("fixed-windows", r"\b(?:fixed\s+casement|casement\s+fixed|fixed|slim fixed)\b"),
            ("casement-windows", r"\bcasement\b"),
            ("picture-windows", r"\bpicture\s+window\b"),
            ("bay-windows", r"\bbay\b"),
            ("bow-windows", r"\bbow\b"),
            ("architectural-custom-windows", r"\barchitectural|custom shape\b"),
        ], {"name", "type", "operatingStyle", "operation", "productType"})
        if category:
            primary = category
            evidence.append(f"{category}: {reason}")
        if primary in {"casement-windows", "awning-windows", "single-hung-windows", "double-hung-windows", "single-slider-windows", "double-slider-windows", "end-vent-windows"}:
            use_cases.append("controlled-ventilation")
        if primary in {"single-slider-windows", "double-slider-windows"}:
            use_cases.append("space-saving-operation")
        if primary in {"picture-windows", "fixed-windows"}:
            use_cases.append("maximum-daylight")
        if primary == "end-vent-windows":
            use_cases.append("wide-opening")

    elif source_category == "entry-doors":
        material, reason = first_match(fields, [
            ("fiberglass-entry-doors", r"\bfiberglass\b"),
            ("steel-entry-doors", r"\bsteel\b"),
        ], {"material", "type", "modelNumber", "productType"})
        if material:
            primary = material
            evidence.append(f"{material}: {reason}")
        style_patterns = [
            ("modern-entry-doors", r"\bmodern\b"),
            ("contemporary-entry-doors", r"\bcontemporary\b"),
            ("traditional-entry-doors", r"\btraditional\b"),
            ("craftsman-entry-doors", r"\bcraftsman\b"),
            ("full-glass-entry-doors", r"\b(?:full[ -](?:lite|light|glass)|1[ -]lite)\b"),
            ("decorative-glass-entry-doors", r"\bdecorative\s+glass\b"),
            ("double-entry-doors", r"\bdouble\s+door\b"),
            ("entry-doors-with-sidelites", r"\bside[ -]?lite\b|\bsidelight\b|\bfsl\b|\brpsl\b|\b2psl\b"),
            ("entry-doors-with-transoms", r"\btransom\b"),
        ]
        for value, pattern in style_patterns:
            _, style_reason = first_match(fields, [(value, pattern)])
            add_supported(secondary, evidence, value, style_reason)
        if any(item in secondary for item in ("modern-entry-doors", "contemporary-entry-doors")):
            use_cases.append("contemporary-design")
        if any(item in secondary for item in ("traditional-entry-doors", "craftsman-entry-doors")):
            use_cases.append("traditional-design")
        if "entry-doors-with-sidelites" in secondary:
            use_cases.append("entry-sidelite")
        if "full-glass-entry-doors" in secondary:
            use_cases.append("maximum-daylight")

    elif source_category == "door-glass":
        door_glass_patterns = [
            ("internal-blinds-door-glass", r"\b(?:internal|integrated|between[ -]glass|mini)\s+blind|\bblinds?\s+between\s+glass\b"),
            ("venting-door-glass", r"\bvent(?:ing|ed|ilation)?\b"),
            ("privacy-door-glass", r"\bprivacy|opaque|frosted|acid[ -]etched|satin(?:e| etch)?|sandblast|obscure\b"),
            ("clear-door-glass", r"\bclear(?:\s+glass)?\b"),
            ("modern-door-glass", r"\bmodern|contemporary\b"),
            ("decorative-door-glass", r"\bdecorative\s+(?:door)?glass|doorglass design\b"),
        ]
        matches: list[tuple[str, str]] = []
        for value, pattern in door_glass_patterns:
            _, reason = first_match(fields, [(value, pattern)])
            if reason:
                matches.append((value, reason))
                add_supported(secondary, evidence, value, reason)
        privacy_fact = facts.get("privacyLevel") or facts.get("Privacy Rating")
        if meaningful(privacy_fact) and not re.search(r"^(?:0|clear)\b", text_value(privacy_fact), re.I):
            add_supported(secondary, evidence, "privacy-door-glass", f"normalized privacy rating={text_value(privacy_fact)}")
        for preferred in ("internal-blinds-door-glass", "venting-door-glass", "privacy-door-glass", "clear-door-glass", "modern-door-glass", "decorative-door-glass"):
            if preferred in secondary:
                primary = preferred
                secondary.remove(preferred)
                break
        if primary == "privacy-door-glass" or "privacy-door-glass" in secondary:
            use_cases.append("privacy")
        if primary == "modern-door-glass" or "modern-door-glass" in secondary:
            use_cases.append("contemporary-design")
        if primary == "venting-door-glass":
            use_cases.append("controlled-ventilation")

    elif source_category == "patio-doors":
        category, reason = first_match(fields, [
            ("stacking-patio-doors", r"\bstacking|multi[ -]slide\b"),
            ("sliding-patio-doors", r"\bsliding|slider|gliding\b"),
        ], {"name", "type", "operatingStyle", "operation", "productType", "configuration"})
        if category:
            primary = category
            evidence.append(f"{category}: {reason}")
        patio_patterns = [
            ("pvc-patio-doors", r"\b(?:pvc|upvc|vinyl)\b"),
            ("aluminum-patio-doors", r"\balumini?um\b"),
            ("hybrid-patio-doors", r"\bhybrid|wood\s*/\s*pvc|pvc\s*/\s*alumini?um|wood\s*/\s*pvc\s*/\s*alumini?um\b"),
            ("oversized-patio-doors", r"\boversized|wide opening|up to \d+\s*(?:ft|feet)\b"),
            ("internal-blinds-patio-doors", r"\b(?:internal|integrated|between[ -]glass|mini)\s+blind|\bblinds?\s+between\s+glass\b"),
        ]
        for value, pattern in patio_patterns:
            _, patio_reason = first_match(fields, [(value, pattern)])
            add_supported(secondary, evidence, value, patio_reason)
        if primary in {"sliding-patio-doors", "stacking-patio-doors"}:
            use_cases.append("space-saving-operation")
        if primary == "stacking-patio-doors" or "oversized-patio-doors" in secondary:
            use_cases.append("wide-opening")

    attribute_patterns = [
        ("double-pane", r"\bdouble[ -](?:pane|glaz)|\bdual[ -]pane\b"),
        ("triple-pane", r"\btriple[ -](?:pane|glaz)"),
        ("energy-efficient", r"\benergy(?: |-)?efficient|energy star|low[ -]?e|thermal performance\b"),
        ("black-finish", r"\bblack\b"),
        ("basement-suitable", r"\bbasement\b"),
        ("egress-documented", r"\begress\b"),
        ("fiberglass", r"\bfiberglass\b"),
        ("steel", r"\bsteel\b"),
        ("wood", r"\bwood\b|douglas fir"),
        ("pvc", r"\b(?:pvc|upvc|vinyl)\b"),
        ("aluminum", r"\balumini?um\b"),
        ("hybrid", r"\bhybrid|wood\s*/\s*pvc|pvc\s*/\s*alumini?um|wood\s*/\s*pvc\s*/\s*alumini?um\b"),
        ("full-glass", r"\bfull[ -](?:lite|light|glass)|\b1[ -]lite\b"),
        ("decorative-glass", r"\bdecorative\s+(?:door)?glass|doorglass design\b"),
        ("sidelite", r"\bside[ -]?lite\b|\bsidelight\b|\bfsl\b|\brpsl\b|\b2psl\b"),
        ("transom", r"\btransom\b"),
        ("internal-blinds", r"\b(?:internal|integrated|between[ -]glass|mini)\s+blind|\bblinds?\s+between\s+glass\b"),
        ("venting", r"\bvent(?:ing|ed|ilation)?\b"),
        ("oversized", r"\boversized|wide opening|up to \d+\s*(?:ft|feet)\b"),
        ("privacy-glass", r"\bprivacy|opaque|frosted|acid[ -]etched|satin(?:e| etch)?|sandblast|obscure\b"),
        ("clear-glass", r"\bclear(?:\s+glass)?\b"),
    ]
    for value, pattern in attribute_patterns:
        allowed_keys = None
        if value in {"fiberglass", "steel", "wood", "pvc", "aluminum", "hybrid"}:
            allowed_keys = {"name", "type", "modelNumber", "material", "productType", "frameSash"}
        elif value == "black-finish":
            allowed_keys = {"name", "colours", "colourFinish", "surface", "surfaceTexture"}
        elif value == "energy-efficient":
            allowed_keys = {"name", "glazing", "performance", "Energy Efficiency", "airInfiltrationExfiltration", "waterPenetrationResistance", "insulationClaim"}
        if value == "wood":
            _, reason = first_match(fields, [(value, r"^(?:wood|fir|douglas fir)\b")], {"type", "material", "productType", "frameSash"})
            if not reason:
                _, reason = first_match(fields, [(value, r"\bdouglas fir\b|\bwood door\b")], {"name"})
        else:
            _, reason = first_match(fields, [(value, pattern)], allowed_keys)
        add_supported(attributes, evidence, value, reason)

    direct_privacy_fact = facts.get("privacyLevel") or facts.get("Privacy Rating")
    if source_category == "door-glass" and meaningful(direct_privacy_fact) and not re.search(r"^(?:0|clear)\b", text_value(direct_privacy_fact), re.I):
        add_supported(attributes, evidence, "privacy-glass", f"normalized privacy rating={text_value(direct_privacy_fact)}")

    if "basement-suitable" in attributes:
        use_cases.append("basement-opening")
    if "egress-documented" in attributes:
        use_cases.append("documented-egress")
    if "replacement" in " ".join(fields.values()).lower():
        use_cases.append("replacement-project")

    return {
        "primaryCategory": primary,
        "secondaryCategories": sorted(set(secondary)),
        "attributes": sorted(set(attributes)),
        "customerUseCases": sorted(set(use_cases)),
        "classificationEvidence": evidence,
    }


def normalized_specifications(enrichment: dict | None, vocabulary: dict[str, list[str]]) -> dict[str, dict]:
    normalized = (enrichment or {}).get("sourceFacts", {}).get("normalized", {})
    output: dict[str, dict] = {}
    for canonical_key, source_keys in vocabulary.items():
        for source_key in source_keys:
            fact = normalized.get(source_key)
            if isinstance(fact, dict) and meaningful(fact.get("value")):
                output[canonical_key] = {
                    "value": fact["value"],
                    "sourceFactKey": source_key,
                    "evidenceRef": f"src/data/catalog/enrichment-records.json#{(enrichment or {}).get('productId')}/sourceFacts/normalized/{source_key}",
                }
                break
    return output


def record_class(product_id: str, live_ids: set[str]) -> str:
    if product_id in live_ids or product_id in HISTORICAL_CANONICAL_IDS:
        return "canonical-product"
    if product_id in VARIANT_PARENTS:
        return "variant-configuration"
    if product_id in SOURCE_ONLY_IDS:
        return "source-only"
    return "source-only"


def editorial_state(product_id: str, classification: str, enrichment: dict | None) -> str:
    if classification != "canonical-product":
        return "source-only"
    if enrichment and enrichment.get("editorial", {}).get("status") == "draft":
        return "published"
    if fact_values(enrichment):
        return "facts-ready"
    return "source-only"


def family_id(product: dict) -> str:
    return f"{product['manufacturer']}:{slugify(product.get('collection') or 'Uncollected')}"


def relationship_state(asset: dict, product_id: str) -> str:
    explicit = asset.get("relationship_state") or asset.get("relationshipState")
    if explicit:
        return explicit
    product_ids = set(asset.get("product_ids") or asset.get("productIds") or [])
    if product_id in product_ids:
        return "product-specific"
    if asset.get("scope") == "collection":
        return "collection-shared"
    if asset.get("scope") == "supplier":
        return "supplier-shared"
    return "uncertain/review"


def asset_for_product(path: str, product_id: str, assets_by_path: dict[str, list[dict]]) -> dict | None:
    candidates = assets_by_path.get(path, [])
    if not candidates:
        return None
    ranked = sorted(
        candidates,
        key=lambda asset: (
            product_id not in set(asset.get("product_ids") or []),
            relationship_state(asset, product_id) == "uncertain/review",
            asset.get("role", ""),
        ),
    )
    return ranked[0]


def media_reference(asset: dict, product_id: str) -> dict:
    source_urls = asset.get("source_asset_urls") or []
    source_url = asset.get("selected_asset_url") or asset.get("master_asset_url") or asset.get("final_asset_url") or asset.get("original_asset_url") or (source_urls[0] if source_urls else None)
    return {
        "localPath": asset.get("local_path"),
        "role": asset.get("role"),
        "relationshipState": relationship_state(asset, product_id),
        "supplier": asset.get("supplier"),
        "sourceUrl": source_url,
        "sourcePageUrls": sorted(set(asset.get("source_page_urls") or [])),
        "sha256": asset.get("sha256"),
        "width": asset.get("width"),
        "height": asset.get("height"),
    }


def unique_assets(assets: list[dict]) -> list[dict]:
    seen: set[str] = set()
    output = []
    for item in assets:
        key = item.get("sha256") or item.get("localPath") or ""
        if not key or key in seen:
            continue
        seen.add(key)
        output.append(item)
    return output


def select_media(product: dict, classification: str, assets_by_path: dict[str, list[dict]]) -> dict:
    empty = {"heroMedia": None, "galleryMedia": [], "technicalMedia": [], "finishMedia": [], "configurationMedia": []}
    if classification != "canonical-product":
        return empty
    candidates: list[tuple[dict, dict]] = []
    for path in product.get("media", []):
        asset = asset_for_product(path, product["id"], assets_by_path)
        if not asset or asset.get("asset_type") != "image":
            continue
        ref = media_reference(asset, product["id"])
        if ref["relationshipState"] in {"uncertain", "uncertain/review", "rejected"}:
            continue
        candidates.append((asset, ref))

    hero_rank = {"product-hero": 0, "open-graph-image": 1, "product-gallery": 2, "glass-design": 3}
    hero_options = [
        (asset, ref) for asset, ref in candidates
        if ref["relationshipState"] == "product-specific" and asset.get("role") in hero_rank
    ]
    hero_options.sort(key=lambda pair: (hero_rank[pair[0].get("role")], -(pair[0].get("width") or 0) * (pair[0].get("height") or 0), pair[1]["localPath"] or ""))
    hero = hero_options[0][1] if hero_options else None
    hero_key = (hero or {}).get("sha256") or (hero or {}).get("localPath")

    selections = {"heroMedia": hero}
    for group, roles in MEDIA_ROLE_GROUPS.items():
        selected = []
        for asset, ref in candidates:
            if asset.get("role") not in roles:
                continue
            if group == "galleryMedia" and ref["relationshipState"] not in {"product-specific", "collection-shared"}:
                continue
            key = ref.get("sha256") or ref.get("localPath")
            if group == "galleryMedia" and key == hero_key:
                continue
            selected.append(ref)
        selected = unique_assets(sorted(selected, key=lambda item: (item.get("role") or "", item.get("localPath") or "")))
        selections[group] = selected[:8] if group == "galleryMedia" else selected
    return selections


def document_reference(asset: dict, product_id: str, inventory: dict | None) -> dict:
    source_urls = asset.get("source_asset_urls") or []
    source_url = asset.get("selected_asset_url") or asset.get("master_asset_url") or asset.get("final_asset_url") or asset.get("original_asset_url") or (source_urls[0] if source_urls else None)
    freshness = (inventory or {}).get("freshness", {"status": "unknown", "basis": "not present in PDF inventory"})
    return {
        "localPath": asset.get("local_path"),
        "role": asset.get("role"),
        "relationshipState": relationship_state(asset, product_id),
        "supplier": asset.get("supplier"),
        "sourceUrl": source_url,
        "sourcePageUrls": sorted(set(asset.get("source_page_urls") or [])),
        "sha256": asset.get("sha256"),
        "freshness": freshness,
        "documentDate": (inventory or {}).get("documentDate"),
    }


def select_documents(product: dict, classification: str, assets_by_path: dict[str, list[dict]], pdf_by_path: dict[str, dict]) -> dict:
    public: list[dict] = []
    reference: list[dict] = []
    for path in product.get("documents", []):
        asset = asset_for_product(path, product["id"], assets_by_path)
        if not asset or asset.get("asset_type") != "document":
            reference.append({"localPath": path, "reason": "missing-manifest-provenance"})
            continue
        ref = document_reference(asset, product["id"], pdf_by_path.get(path))
        state = ref["relationshipState"]
        freshness = ref["freshness"].get("status")
        safe_relationship = state in {"product-specific", "collection-shared", "supplier-shared"}
        if classification == "canonical-product" and safe_relationship and freshness == "current-source-linked" and ref["role"] in PUBLIC_DOCUMENT_ROLES:
            public.append(ref)
        else:
            reason = "non-canonical-record" if classification != "canonical-product" else "not-current-or-not-publicly-scoped"
            reference.append({**ref, "reason": reason})
    return {
        "publicDocuments": unique_assets(sorted(public, key=lambda item: (item.get("role") or "", item.get("localPath") or ""))),
        "referenceDocuments": unique_assets(sorted(reference, key=lambda item: (item.get("role") or "", item.get("localPath") or ""))),
    }


def build_related(records: list[dict]) -> dict[str, list[str]]:
    published = [item for item in records if item["editorialState"] in {"publishable", "published"} and item["recordClass"] == "canonical-product"]
    output: dict[str, list[str]] = {}
    for item in records:
        if item["recordClass"] != "canonical-product":
            output[item["productId"]] = []
            continue
        scored = []
        item_secondary = set(item["secondaryCategories"])
        for candidate in published:
            if candidate["productId"] == item["productId"]:
                continue
            if candidate["rootCategory"] != item["rootCategory"]:
                continue
            score = 0
            score += 100 if candidate["primaryCategory"] == item["primaryCategory"] else 0
            score += 15 * len(item_secondary & set(candidate["secondaryCategories"]))
            score += 20 if candidate["manufacturer"] == item["manufacturer"] else 0
            score += 25 if candidate["familyId"] == item["familyId"] else 0
            scored.append((-score, candidate["manufacturer"], candidate["productId"]))
        output[item["productId"]] = [product_id for _, _, product_id in sorted(scored)[:4]]
    return output


def build_gap_audit(records: list[dict], media: dict[str, dict], documents: dict[str, dict]) -> dict:
    gaps = []
    for item in records:
        if item["recordClass"] != "canonical-product":
            continue
        product_id = item["productId"]
        missing = []
        if not media[product_id]["heroMedia"]:
            missing.append("selected-product-hero")
        if not media[product_id]["galleryMedia"]:
            missing.append("curated-gallery")
        if not documents[product_id]["publicDocuments"]:
            missing.append("current-public-document")
        if not item["comparison"]["ready"]:
            missing.append("comparison-fields")
        if item["editorialState"] not in {"editorial-reviewed", "publishable", "published"}:
            missing.append("reviewed-editorial")
        if not missing:
            continue
        score = 0
        score += 80 if item["editorialState"] == "published" and "selected-product-hero" in missing else 0
        score += 45 if "reviewed-editorial" in missing else 0
        score += 30 if "selected-product-hero" in missing else 0
        score += 20 if item["rootCategory"] in {"replacement-windows", "patio-doors"} else 10
        score += 15 if "comparison-fields" in missing else 0
        score += 5 if "current-public-document" in missing else 0
        priority = "critical" if score >= 100 else "high" if score >= 70 else "medium" if score >= 45 else "low"
        gaps.append({
            "productId": product_id,
            "manufacturer": item["manufacturer"],
            "rootCategory": item["rootCategory"],
            "primaryCategory": item["primaryCategory"],
            "editorialState": item["editorialState"],
            "priority": priority,
            "score": score,
            "gaps": missing,
            "recommendedNextAction": "Review the highest-priority missing evidence or editorial field without weakening publication thresholds.",
        })
    gaps.sort(key=lambda item: (-item["score"], item["rootCategory"], item["productId"]))
    categories = {}
    for root in ROOT_BY_SOURCE_CATEGORY.values():
        subset = [item for item in records if item["recordClass"] == "canonical-product" and item["rootCategory"] == root]
        categories[root] = {
            "canonicalProducts": len(subset),
            "published": sum(item["editorialState"] == "published" for item in subset),
            "withHero": sum(bool(media[item["productId"]]["heroMedia"]) for item in subset),
            "withCuratedGallery": sum(bool(media[item["productId"]]["galleryMedia"]) for item in subset),
            "withPublicDocuments": sum(bool(documents[item["productId"]]["publicDocuments"]) for item in subset),
            "comparisonReady": sum(item["comparison"]["ready"] for item in subset),
        }
    return {
        "generatedAt": GENERATED_AT,
        "priorityMethod": "Commercial category, publication risk, hero coverage, comparison readiness, document coverage, and editorial review state; no publication threshold changes.",
        "categories": categories,
        "summary": dict(Counter(item["priority"] for item in gaps)),
        "products": gaps,
    }


def build_report(records: list[dict], media: dict[str, dict], documents: dict[str, dict], relationships: dict, gap_audit: dict) -> str:
    canonical = [item for item in records if item["recordClass"] == "canonical-product"]
    live_canonical = [item for item in canonical if item["liveCanonical"]]
    historical_canonical = [item for item in canonical if item["historicalCanonical"]]
    classes = Counter(item["recordClass"] for item in records)
    states = Counter(item["editorialState"] for item in records)
    roots = Counter(item["rootCategory"] for item in canonical)
    live_roots = Counter(item["rootCategory"] for item in live_canonical)
    historical_roots = Counter(item["rootCategory"] for item in historical_canonical)
    primaries = Counter(item["primaryCategory"] for item in canonical)
    attributes = Counter(value for item in canonical for value in item["attributes"])
    use_cases = Counter(value for item in canonical for value in item["customerUseCases"])
    hero_count = sum(bool(media[item["productId"]]["heroMedia"]) for item in canonical)
    gallery_count = sum(bool(media[item["productId"]]["galleryMedia"]) for item in canonical)
    public_docs = sum(len(documents[item["productId"]]["publicDocuments"]) for item in canonical)
    with_docs = sum(bool(documents[item["productId"]]["publicDocuments"]) for item in canonical)
    comparison_ready = sum(item["comparison"]["ready"] for item in canonical)
    previously_publishable = sum(item["previouslyPublishable"] for item in records)
    preserved_publishable = sum(item["publicationPreserved"] for item in records)
    withheld_previous = previously_publishable - preserved_publishable

    lines = [
        "# Customer-facing taxonomy and editorial readiness",
        "",
        f"Generated from the frozen ten-supplier source library on `{GENERATED_AT}`. Supplier manifests, discovery files, and acquired binaries are read-only inputs to this layer.",
        "",
        "## Taxonomy tree",
        "",
        "- Replacement Windows",
        "  - Casement, awning, single/double hung, single/double slider, end vent, picture, fixed, bay, bow, architectural/custom",
        "- Entry Doors",
        "  - Fiberglass, steel, modern, contemporary, traditional, craftsman, full-glass, decorative-glass, double, sidelites, transoms",
        "- Door Glass",
        "  - Modern, decorative, privacy, clear, internal blinds, venting",
        "- Patio Doors",
        "  - Sliding, stacking, PVC, aluminum, hybrid, oversized, internal blinds",
        "",
        "Assignments are evidence-gated. A product remains at its root category when a narrower subcategory is not supported by its canonical identity or normalized supplier facts.",
        "",
        "## Record reconciliation",
        "",
        f"- Merged catalogue records: **{len(records)}**",
        f"- Live canonical supplier identities mapped: **{len(live_canonical)}**",
        f"- Historical canonical products retained: **{len(historical_canonical)}**",
        f"- Customer-facing canonical product records: **{classes['canonical-product']}**",
        f"- Variant/configuration records: **{classes['variant-configuration']}**",
        f"- Source-only records: **{classes['source-only']}**",
        f"- Product families: **{len(relationships['collections'])}** collections across **{len(relationships['manufacturers'])}** manufacturers",
        "",
        "The 12 Mennie sidelite records are configurations, not independent customer pages. Nine have exact canonical slab parents; three Oak Grain sidelites remain collection-level configurations because the source library has no matching live slab identity. Three previously published Trimlite model records remain historical canonical products, while three non-current Verre Select names remain searchable source evidence and cannot publish.",
        "",
        "## Customer-facing category counts",
        "",
        "| Root category | Live canonical | Historical canonical | Customer-facing canonical |",
        "|---|---:|---:|---:|",
    ]
    for key, count in sorted(roots.items()):
        lines.append(f"| {key} | {live_roots[key]} | {historical_roots[key]} | {count} |")
    lines += ["", "### Primary subcategory distribution", "", "| Primary category | Products |", "|---|---:|"]
    for key, count in sorted(primaries.items(), key=lambda item: (-item[1], item[0])):
        lines.append(f"| {key} | {count} |")
    lines += ["", "## Editorial states", "", "| State | Records |", "|---|---:|"]
    for key in ("source-only", "facts-ready", "editorial-draft", "editorial-reviewed", "publishable", "published"):
        lines.append(f"| {key} | {states[key]} |")
    lines += [
        "",
        f"Existing publication decisions are preserved for **{preserved_publishable}** customer-facing canonical records; **{withheld_previous}** previously publishable records are withheld. Media acquisition alone never advances a state.",
        "",
        "## Media, documents, and comparison readiness",
        "",
        f"- Products with a selected product-specific hero: **{hero_count} / {len(canonical)}**",
        f"- Products with a curated gallery beyond the hero: **{gallery_count} / {len(canonical)}**",
        f"- Products with at least one current public document: **{with_docs} / {len(canonical)}**",
        f"- Current public document relationships: **{public_docs}**",
        f"- Comparison-ready products: **{comparison_ready} / {len(canonical)}**",
        "",
        "Uncertain/review and rejected media are excluded from every public selection. Supplier-shared technical, finish, and configuration assets can remain in their explicitly labelled roles, but never become a product hero. Stale or unknown documents remain reference-only.",
        "",
        "## Attribute distribution",
        "",
        "| Attribute | Products |",
        "|---|---:|",
    ]
    for key, count in sorted(attributes.items(), key=lambda item: (-item[1], item[0])):
        lines.append(f"| {key} | {count} |")
    lines += ["", "## Customer-use-case distribution", "", "| Use case | Products |", "|---|---:|"]
    for key, count in sorted(use_cases.items(), key=lambda item: (-item[1], item[0])):
        lines.append(f"| {key} | {count} |")
    lines += [
        "",
        "## Major content gaps",
        "",
        f"Gap priorities: **{', '.join(f'{key}={value}' for key, value in sorted(gap_audit['summary'].items())) or 'none'}**.",
        "",
        "The machine-readable queue is `audit/editorial/category-content-gaps.json`. Highest-priority work is evidence or editorial review for commercially important records, followed by product-specific hero selection, comparison-field completion, and current document curation. Thin pages must not be published to close a count gap.",
        "",
        "## Deterministic related products",
        "",
        "Related products are drawn only from published canonical records. Ranking is root category → exact primary style/material → shared secondary categories → collection → manufacturer, with product ID as the stable tie-breaker. Source-only and configuration records are never recommendations.",
        "",
        "## Ambiguous decisions retained for review",
        "",
        "- `mennie-canada:wg-2p-180-sl`, `mennie-canada:wg-2psl`, and `mennie-canada:wg8-2psl` are Oak Grain collection-level configurations because no exact live canonical slab parent exists.",
        "- Products without direct evidence for a narrower style remain at their root category; no category was inferred merely to improve counts.",
        "- Shared supplier documents are public only when current, explicitly attached to the record, and assigned an approved document role.",
        "- Current published routes retain their existing publication decision; the new state model does not certify their prose as newly human-reviewed.",
        "",
    ]
    return "\n".join(lines)


def build_all(write: bool = True) -> dict[str, Any]:
    taxonomy = load_json(EDITORIAL / "taxonomy.json")
    products = merge_catalog()
    manifests, assets_by_path, live_ids = load_sources()
    enrichment_records = load_json(CATALOG / "enrichment-records.json")
    enrichment_by_id = {item["productId"]: item for item in enrichment_records}
    pdf_inventory_path = ROOT / "audit" / "supplier-completeness" / "pdf-inventory.json"
    pdf_inventory = load_json(pdf_inventory_path) if pdf_inventory_path.exists() else {"documents": []}
    pdf_by_path = {item["localPath"]: item for item in pdf_inventory.get("documents", [])}

    records: list[dict] = []
    media_by_id: dict[str, dict] = {}
    documents_by_id: dict[str, dict] = {}
    for product in products:
        product_id = product["id"]
        enrichment = enrichment_by_id.get(product_id)
        classification = record_class(product_id, live_ids)
        taxonomy_fields = classify_product(product, enrichment)
        root = ROOT_BY_SOURCE_CATEGORY.get(product.get("category"), "entry-doors")
        specs = normalized_specifications(enrichment, taxonomy["specificationVocabulary"])
        comparison_schema = taxonomy["comparisonSchemas"][root]
        populated = [key for key in comparison_schema["fields"] if key in specs]
        missing = [key for key in comparison_schema["fields"] if key not in specs]
        collection = product.get("collection") or "Uncollected"
        record = {
            "productId": product_id,
            "manufacturer": product["manufacturer"],
            "name": product["name"],
            "slug": product["slug"],
            "recordClass": classification,
            "liveCanonical": product_id in live_ids,
            "historicalCanonical": product_id in HISTORICAL_CANONICAL_IDS,
            "parentProductId": VARIANT_PARENTS.get(product_id),
            "familyId": family_id(product),
            "collection": collection,
            "rootCategory": root,
            **taxonomy_fields,
            "canonicalSpecifications": specs,
            "comparison": {
                "schema": root,
                "populatedFields": populated,
                "missingFields": missing,
                "ready": len(populated) >= comparison_schema["minimumPopulatedFields"],
            },
            "editorialState": editorial_state(product_id, classification, enrichment),
            "previouslyPublishable": bool(enrichment and enrichment.get("editorial", {}).get("status") == "draft"),
            "publicationPreserved": bool(classification == "canonical-product" and enrichment and enrichment.get("editorial", {}).get("status") == "draft"),
        }
        records.append(record)
        media_by_id[product_id] = select_media(product, classification, assets_by_path)
        documents_by_id[product_id] = select_documents(product, classification, assets_by_path, pdf_by_path)

    related = build_related(records)
    for record in records:
        record["relatedProductIds"] = related[record["productId"]]

    collections: dict[str, dict] = {}
    manufacturers: dict[str, set[str]] = defaultdict(set)
    for record in records:
        family = collections.setdefault(record["familyId"], {
            "familyId": record["familyId"],
            "manufacturer": record["manufacturer"],
            "collection": record["collection"],
            "canonicalProductIds": [],
            "variantConfigurationIds": [],
            "sourceOnlyIds": [],
        })
        manufacturers[record["manufacturer"]].add(record["familyId"])
        family[{"canonical-product": "canonicalProductIds", "variant-configuration": "variantConfigurationIds", "source-only": "sourceOnlyIds"}[record["recordClass"]]].append(record["productId"])
    collection_list = sorted(collections.values(), key=lambda item: item["familyId"])
    for item in collection_list:
        for key in ("canonicalProductIds", "variantConfigurationIds", "sourceOnlyIds"):
            item[key].sort()
    relationship_payload = {
        "generatedAt": GENERATED_AT,
        "manufacturers": [
            {"manufacturer": supplier, "collectionIds": sorted(collection_ids)}
            for supplier, collection_ids in sorted(manufacturers.items())
        ],
        "collections": collection_list,
        "variantParents": [
            {
                "variantId": product_id,
                "parentProductId": parent_id,
                "parentCollectionId": next(item["familyId"] for item in records if item["productId"] == product_id),
                "relationship": "sidelite-configuration",
            }
            for product_id, parent_id in sorted(VARIANT_PARENTS.items())
        ],
        "relatedProducts": {key: value for key, value in sorted(related.items())},
    }

    category_pools = {}
    for root in ROOT_BY_SOURCE_CATEGORY.values():
        pool = []
        for record in sorted(records, key=lambda item: (item["manufacturer"], item["productId"])):
            hero = media_by_id[record["productId"]]["heroMedia"]
            if record["rootCategory"] == root and record["editorialState"] == "published" and hero:
                pool.append({"productId": record["productId"], **hero})
        category_pools[root] = pool[:12]

    products_payload = {
        "generatedAt": GENERATED_AT,
        "taxonomyVersion": taxonomy["version"],
        "sourceSnapshot": {"mergedCatalogueRecords": len(records), "liveCanonicalSupplierIdentities": len(live_ids), "supplierManifests": len(manifests)},
        "records": records,
    }
    media_payload = {
        "generatedAt": GENERATED_AT,
        "selectionPolicy": "Product heroes require a product-specific relationship. Galleries accept product-specific or collection-shared media. Uncertain/review and rejected relationships are never public.",
        "products": [{"productId": key, **value} for key, value in sorted(media_by_id.items())],
        "categoryMediaPools": category_pools,
    }
    document_payload = {
        "generatedAt": GENERATED_AT,
        "selectionPolicy": "Only current-source-linked documents with approved roles and explicit safe relationships are public; all others remain reference-only.",
        "products": [{"productId": key, **value} for key, value in sorted(documents_by_id.items())],
    }
    gap_audit = build_gap_audit(records, media_by_id, documents_by_id)
    report = build_report(records, media_by_id, documents_by_id, relationship_payload, gap_audit)

    if write:
        write_json(EDITORIAL / "products.json", products_payload)
        write_json(EDITORIAL / "relationships.json", relationship_payload)
        write_json(EDITORIAL / "media-selections.json", media_payload)
        write_json(EDITORIAL / "document-selections.json", document_payload)
        write_json(AUDIT / "category-content-gaps.json", gap_audit)
        (AUDIT / "taxonomy-report.md").parent.mkdir(parents=True, exist_ok=True)
        (AUDIT / "taxonomy-report.md").write_text(report, encoding="utf-8")

    return {
        "products": products_payload,
        "relationships": relationship_payload,
        "media": media_payload,
        "documents": document_payload,
        "gaps": gap_audit,
        "report": report,
    }

