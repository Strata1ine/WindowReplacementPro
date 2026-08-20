#!/usr/bin/env python3
"""Generate supplier catalogue/media completeness audit artifacts."""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parents[1]
AUDIT_ROOT = ROOT / "audit" / "supplier-completeness"
CATALOG_ROOT = ROOT / "src" / "data" / "catalog"
SOURCE_ROOT = ROOT / "source-media"
PUBLIC_ROOT = ROOT / "public"
ROLE_MAP = {
    "hero": "product-hero",
    "product-jsonld": "product-hero",
    "embedded-product": "product-hero",
    "gallery": "product-gallery",
    "technical": "technical-drawing",
    "document": "reference-only",
}


def load_json(path: Path, default=None):
    if not path.is_file():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def merged_catalog(curated: list[dict], discovered: list[dict]) -> list[dict]:
    by_id = {item["id"]: dict(item) for item in curated}
    for incoming in discovered:
        existing = by_id.get(incoming["id"])
        if not existing:
            by_id[incoming["id"]] = dict(incoming)
            continue
        merged = dict(existing)
        for key in ("name", "collection", "modelNumber", "type", "summary", "sourceDescription", "sourceUrl", "sourceType"):
            if incoming.get(key) not in (None, ""):
                merged[key] = incoming[key]
        if incoming.get("category") != "unclassified":
            merged["category"] = incoming.get("category", existing.get("category"))
        merged["media"] = sorted(set(existing.get("media", [])) | set(incoming.get("media", [])))
        merged["documents"] = sorted(set(existing.get("documents", [])) | set(incoming.get("documents", [])))
        merged["specifications"] = existing.get("specifications", {}) | incoming.get("specifications", {})
        merged["lastVerified"] = max(existing.get("lastVerified", ""), incoming.get("lastVerified", ""))
        by_id[incoming["id"]] = merged
    return sorted(by_id.values(), key=lambda item: item["id"])


def public_file(path: str) -> Path:
    return PUBLIC_ROOT / unquote(path.lstrip("/")).replace("/", str(Path("/").anchor or "/"))


def is_meaningful(value) -> bool:
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, list):
        return any(is_meaningful(item) for item in value)
    return False


def publishable(product: dict, enrichment: dict | None) -> bool:
    editorial = (enrichment or {}).get("editorial", {})
    facts = (enrichment or {}).get("sourceFacts", {})
    normalized = facts.get("normalized", {})
    specifications = product.get("specifications", {}) | {
        key: fact.get("value") for key, fact in normalized.items() if isinstance(fact, dict)
    }
    summary = editorial.get("summary") if editorial.get("status") == "draft" else product.get("summary")
    return (
        product.get("category") != "unclassified"
        and bool(str(product.get("name", "")).strip())
        and not re.fullmatch(r"home|item|product|products|catalog|collection|exterior|doorglass", str(product.get("name", "")).strip(), re.I)
        and bool(str(product.get("sourceUrl", "")).strip())
        and bool(normalized or product.get("specifications"))
        and bool(str(summary or "").strip())
        and (any(is_meaningful(value) for value in specifications.values()) or len(editorial.get("keyFeatures", [])) >= 3)
    )


def file_inventory(root: Path, suffixes: set[str]) -> list[dict]:
    if not root.is_dir():
        return []
    return [
        {"path": path.relative_to(ROOT).as_posix(), "bytes": path.stat().st_size}
        for path in sorted(root.rglob("*"))
        if path.is_file() and (not suffixes or path.suffix.lower() in suffixes)
    ]


def relationship_assets(slug: str, manifest: dict) -> tuple[dict[str, dict], dict[str, list[str]]]:
    assets = {item.get("local_path", ""): item for item in manifest.get("assets", []) if item.get("local_path")}
    products = defaultdict(list)
    for product in manifest.get("products", []):
        for path in product.get("media", []) + product.get("documents", []):
            products[path].append(product.get("id"))
    relationship_path = SOURCE_ROOT / "suppliers" / slug / "asset-index.json"
    for item in load_json(relationship_path, []) or []:
        path = item.get("localPath", "")
        if path:
            assets[path] = item
            products[path].extend(item.get("productIds", []))
    return assets, products


def build_reports() -> tuple[list[dict], list[dict]]:
    configs = load_json(ROOT / "scripts" / "ingest" / "suppliers.json", [])
    curated = load_json(CATALOG_ROOT / "curated-products.json", [])
    enrichments = load_json(CATALOG_ROOT / "enrichment-records.json", [])
    enrichment_by_id = {item["productId"]: item for item in enrichments}
    source_status = load_json(CATALOG_ROOT / "source-link-status.json", {})
    status_records = source_status if isinstance(source_status, list) else source_status.get("records", [])
    live_inventory = load_json(AUDIT_ROOT / "live-source-inventory.json", {"suppliers": []})
    live_by_slug = {item["supplier"]: item for item in live_inventory.get("suppliers", [])}
    pdf_evidence = load_json(AUDIT_ROOT / "pdf-evidence.json", {"products": []})
    pdf_evidence_by_id = {item["productId"]: item.get("pdfEvidence", []) for item in pdf_evidence.get("products", [])}
    pdf_summary = load_json(AUDIT_ROOT / "pdf-extraction-summary.json", {"suppliers": []})
    pdf_summary_by_slug = {item["supplier"]: item for item in pdf_summary.get("suppliers", [])}
    summary: list[dict] = []
    product_matrix: list[dict] = []
    for config in configs:
        slug = config["slug"]
        curated_records = [item for item in curated if item.get("manufacturer") == slug]
        discovered_records = load_json(CATALOG_ROOT / "discovered" / f"{slug}.json", [])
        records = merged_catalog(curated_records, discovered_records)
        manifest = load_json(SOURCE_ROOT / "manifests" / f"{slug}.json", {}) or {}
        assets, asset_products = relationship_assets(slug, manifest)
        supplier_references: set[str] = set(assets)
        supplier_references.update(
            item.get("local_path", "") for item in manifest.get("assets", []) if item.get("local_path")
        )
        relationship_review = load_json(AUDIT_ROOT / f"{slug}-relationship-revalidation.json", {}) or {}
        preserved_review_paths = {
            item.get("local_path", "")
            for item in relationship_review.get("rejectedAssociations", [])
            if item.get("local_path")
        }
        supplier_references.update(preserved_review_paths)
        roles_by_path = {
            path: ROLE_MAP.get(item.get("role"), item.get("role", "reference-only"))
            for path, item in assets.items()
        }
        for product in records:
            supplier_references.update(product.get("media", []))
            supplier_references.update(product.get("documents", []))
        image_files = file_inventory(PUBLIC_ROOT / "images" / "catalog" / slug, {".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".svg"})
        document_files = file_inventory(PUBLIC_ROOT / "documents" / "catalog" / slug, {".pdf"})
        snapshots = file_inventory(SOURCE_ROOT / slug / "html", {".html", ".htm"})
        staging_files = file_inventory(SOURCE_ROOT / "staging" / slug, set()) if (SOURCE_ROOT / "staging" / slug).is_dir() else []
        staged_payloads = [
            item for item in staging_files
            if "/public/images/" in item["path"] or "/public/documents/" in item["path"]
        ]
        supplier_public = image_files + document_files
        orphaned = [item for item in supplier_public if "/" + item["path"].removeprefix("public/") not in supplier_references]
        live = live_by_slug.get(slug, {})
        live_products = live.get("products", [])
        catalog_by_id = {item["id"]: item for item in records}
        catalog_by_url = {item.get("sourceUrl", "").rstrip("/"): item for item in records}
        catalog_by_identity = {
            str(item.get("modelNumber") or item.get("name") or "").casefold(): item for item in records
        }
        matched_ids: set[str] = set()
        for live_product in live_products:
            catalog = catalog_by_id.get(live_product.get("productId")) or catalog_by_url.get(str(live_product.get("canonicalUrl", "")).rstrip("/"))
            if not catalog:
                key = str(live_product.get("modelNumber") or live_product.get("name") or "").casefold()
                catalog = catalog_by_identity.get(key)
            if catalog:
                matched_ids.add(catalog["id"])
            media = live_product.get("mediaAvailable", {})
            documents = live_product.get("documentsAvailable", {})
            local_media = catalog.get("media", []) if catalog else []
            local_documents = catalog.get("documents", []) if catalog else []
            local_roles = Counter(roles_by_path.get(path, "reference-only") for path in local_media + local_documents)
            identity_complete = bool(catalog and catalog.get("name") and catalog.get("category") != "unclassified")
            facts_complete = bool(catalog and (catalog.get("specifications") or enrichment_by_id.get(catalog["id"], {}).get("sourceFacts", {}).get("normalized")))
            hero_live = bool(media.get("hero"))
            hero_local = local_roles["product-hero"] > 0
            docs_live = any(documents.values())
            docs_local = bool(local_documents)
            state = "source-complete" if live.get("status") in {"live-verified-complete", "VERIFIED"} else "verification-pending"
            if not catalog:
                state = "missing-product"
            elif (hero_live and not hero_local) or (docs_live and not docs_local):
                state = "partially-enriched"
            elif not identity_complete or not facts_complete:
                state = "requires-review"
            product_matrix.append({
                "supplier": slug,
                "liveProductName": live_product.get("name"),
                "liveModelNumber": live_product.get("modelNumber"),
                "collection": live_product.get("collection"),
                "category": live_product.get("category"),
                "canonicalSupplierUrl": live_product.get("canonicalUrl"),
                "catalogue": {
                    "recordExists": bool(catalog),
                    "productId": catalog.get("id") if catalog else None,
                    "correctIdentity": identity_complete,
                    "correctCategory": bool(catalog and catalog.get("category") == live_product.get("category")),
                    "correctModel": bool(catalog and (not live_product.get("modelNumber") or catalog.get("modelNumber") == live_product.get("modelNumber"))),
                    "specificationsCaptured": facts_complete,
                },
                "mediaAvailableLive": media,
                "mediaLocal": {
                    "hero": hero_local,
                    "gallery": local_roles["product-gallery"] > 0,
                    "technicalDrawings": sum(local_roles[role] for role in {"technical-drawing", "profile-section", "configuration-diagram"}) > 0,
                    "configuration": local_roles["configuration-diagram"] > 0,
                    "colourFinish": local_roles["colour-chart"] + local_roles["finish-swatch"] > 0,
                    "glass": local_roles["glass-design"] > 0,
                    "hardware": local_roles["hardware"] > 0,
                    "paths": local_media,
                },
                "documentsAvailableLive": documents,
                "documentsLocal": {"captured": docs_local, "paths": local_documents},
                "pdfEvidence": pdf_evidence_by_id.get(catalog.get("id"), []) if catalog else [],
                "completeness": {
                    "identityComplete": identity_complete,
                    "factsComplete": facts_complete,
                    "heroMediaAvailable": hero_local or not hero_live,
                    "galleryAvailable": local_roles["product-gallery"] > 0 or not media.get("gallery"),
                    "technicalMediaAvailable": local_roles["technical-drawing"] > 0 or not media.get("technicalDrawings"),
                    "documentsAvailable": docs_local or not docs_live,
                    "sourceVerified": bool(live_product.get("verifiedAt")),
                    "state": state,
                },
            })
        normalized = sum(bool(enrichment_by_id.get(item["id"], {}).get("sourceFacts", {}).get("normalized")) for item in records)
        editorial = sum(enrichment_by_id.get(item["id"], {}).get("editorial", {}).get("status") == "draft" for item in records)
        pdf_stats = pdf_summary_by_slug.get(slug, {})
        summary.append({
            "supplier": slug,
            "name": config["name"],
            "curatedProducts": len(curated_records),
            "discoveredProducts": len(discovered_records),
            "canonicalProducts": len(manifest.get("products", [])),
            "mergedUniqueProducts": len(records),
            "publishableProducts": sum(publishable(item, enrichment_by_id.get(item["id"])) for item in records),
            "productsWithEditorial": editorial,
            "productsWithNormalizedSpecifications": normalized,
            "productsWithProductImage": sum(bool(item.get("media")) for item in records),
            "productsWithGallery": sum(any(roles_by_path.get(path) == "product-gallery" for path in item.get("media", [])) for item in records),
            "productsWithTechnicalDrawings": sum(any(roles_by_path.get(path) in {"technical-drawing", "profile-section", "configuration-diagram"} for path in item.get("media", [])) for item in records),
            "productsWithDocuments": sum(bool(item.get("documents")) for item in records),
            "permanentImageFiles": len(image_files),
            "permanentPdfFiles": len(document_files),
            "pdfExtraction": {
                "documents": pdf_stats.get("documents", 0),
                "pages": pdf_stats.get("pages", 0),
                "textCharacters": pdf_stats.get("characters", 0),
                "tables": pdf_stats.get("tables", 0),
                "images": pdf_stats.get("images", 0),
                "ocrRequired": pdf_stats.get("ocrRequired", 0),
                "errors": pdf_stats.get("errors", 0),
                "productsWithPageEvidence": sum(bool(pdf_evidence_by_id.get(item["id"])) for item in records),
            },
            "manifestEntries": len(manifest.get("assets", [])),
            "acceptedImageAssets": sum(item.get("asset_type") == "image" for item in manifest.get("assets", [])),
            "acceptedDocumentAssets": sum(item.get("asset_type") == "document" for item in manifest.get("assets", [])),
            "preservedReviewAssets": len(preserved_review_paths),
            "stagingAssets": len(staged_payloads),
            "quarantinedAssets": len(staged_payloads),
            "orphanedAssets": len(orphaned),
            "savedSourceSnapshots": len(snapshots),
            "jsonLdProductPages": sum(bool(page.get("product_data")) for page in manifest.get("pages", [])),
            "permanentMediaPaths": {
                "images": f"public/images/catalog/{slug}" if (PUBLIC_ROOT / "images" / "catalog" / slug).is_dir() else None,
                "documents": f"public/documents/catalog/{slug}" if (PUBLIC_ROOT / "documents" / "catalog" / slug).is_dir() else None,
                "sourceArchive": f"source-media/{slug}" if (SOURCE_ROOT / slug).is_dir() else None,
                "relationshipIndex": f"source-media/suppliers/{slug}/asset-index.json" if (SOURCE_ROOT / "suppliers" / slug / "asset-index.json").is_file() else None,
            },
            "liveRelevantProducts": len(live_products) if live_products else None,
            "liveInventoryStatus": live.get("status", "VERIFICATION-PENDING"),
            "websiteStatus": live.get("websiteStatus", "VERIFICATION-PENDING"),
            "mediaStatus": live.get("mediaStatus", "VERIFICATION-PENDING"),
            "pdfStatus": live.get("pdfStatus", "VERIFICATION-PENDING"),
            "catalogueMatchesToLive": len(matched_ids),
            "manifestErrors": len(manifest.get("errors", [])),
            "staleOrBlockedSources": sum(item.get("supplier") == slug and item.get("status") in {"stale", "blocked", "unavailable"} for item in status_records),
            "orphanedPaths": [item["path"] for item in orphaned],
        })
    return summary, product_matrix


def markdown_report(summary: list[dict], matrix: list[dict]) -> str:
    lines = ["# Supplier completeness audit", "", f"Generated: {datetime.now(timezone.utc).isoformat()}", "", "## Supplier summary", "", "| Supplier | Canonical | Image-linked | Accepted images | Accepted PDFs | Review binaries | Orphans | Website | Media | PDF |", "|---|---:|---:|---:|---:|---:|---:|---|---|---|"]
    for item in summary:
        lines.append(f"| {item['supplier']} | {item['canonicalProducts']} | {item['productsWithProductImage']} | {item['acceptedImageAssets']} | {item['acceptedDocumentAssets']} | {item['preservedReviewAssets']} | {item['orphanedAssets']} | {item['websiteStatus']} | {item['mediaStatus']} | {item['pdfStatus']} |")
    lines += ["", "## Supplier findings", ""]
    by_supplier = defaultdict(list)
    for item in matrix:
        by_supplier[item["supplier"]].append(item)
    for item in summary:
        products = by_supplier[item["supplier"]]
        states = Counter(product["completeness"]["state"] for product in products)
        lines += [f"### {item['name']}", "", f"Website: **{item['websiteStatus']}**. Media: **{item['mediaStatus']}**. PDF: **{item['pdfStatus']}**. Canonical supplier products: **{item['canonicalProducts']}**. Merged catalogue records: **{item['mergedUniqueProducts']}**. Accepted assets: **{item['acceptedImageAssets']} images / {item['acceptedDocumentAssets']} PDFs**. Review binaries preserved: **{item['preservedReviewAssets']}**. Product associations: **{item['productsWithProductImage']} image / {item['productsWithDocuments']} document**.", "", f"Completeness states: {', '.join(f'{key}={value}' for key, value in sorted(states.items())) or 'live inventory pending'}.", ""]
    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", action="store_true", help="Write the immutable pre-correction baseline snapshot.")
    parser.add_argument("--force", action="store_true", help="Allow replacing an existing baseline snapshot.")
    args = parser.parse_args()
    summary, matrix = build_reports()
    AUDIT_ROOT.mkdir(parents=True, exist_ok=True)
    generated = datetime.now(timezone.utc).isoformat()
    payload = {"generatedAt": generated, "suppliers": summary}
    if args.baseline:
        baseline = AUDIT_ROOT / "baseline.json"
        if baseline.exists() and not args.force:
            raise SystemExit(f"Refusing to replace existing baseline: {baseline.relative_to(ROOT)}")
        write_json(baseline, payload)
    write_json(AUDIT_ROOT / "supplier-summary.json", payload)
    write_json(AUDIT_ROOT / "product-completeness.json", {"generatedAt": generated, "products": matrix})
    explicit_missing = {}
    for report_path in AUDIT_ROOT.glob("*-final-completeness.json"):
        report = load_json(report_path, {}) or {}
        for missing in report.get("missingProducts", []):
            explicit_missing[missing.get("id")] = missing.get("reason")
    missing_media = []
    for item in matrix:
        product_id = item.get("catalogue", {}).get("productId")
        if item["completeness"]["state"] == "missing-product" or (item.get("catalogue", {}).get("recordExists") and not item.get("mediaLocal", {}).get("paths")):
            record = dict(item)
            record["reason"] = explicit_missing.get(product_id, "no accepted product media relationship")
            missing_media.append(record)
    write_json(AUDIT_ROOT / "missing-media.json", {"generatedAt": generated, "products": missing_media})
    write_json(AUDIT_ROOT / "missing-documents.json", {"generatedAt": generated, "products": [item for item in matrix if any(item["documentsAvailableLive"].values()) and not item["documentsLocal"]["captured"]]})
    status = load_json(CATALOG_ROOT / "source-link-status.json", {})
    write_json(AUDIT_ROOT / "stale-sources.json", status)
    uncertain = []
    for supplier in summary:
        slug = supplier["supplier"]
        for asset in load_json(SOURCE_ROOT / "suppliers" / slug / "asset-index.json", []) or []:
            if asset.get("scope") == "unassociated" or (asset.get("role") in {"product-hero", "product-gallery"} and not asset.get("productIds")):
                uncertain.append({"supplier": slug, **asset})
        relationship_review = load_json(AUDIT_ROOT / f"{slug}-relationship-revalidation.json", {}) or {}
        for asset in relationship_review.get("rejectedAssociations", []):
            uncertain.append({"supplier": slug, **asset})
    write_json(AUDIT_ROOT / "uncertain-associations.json", {"generatedAt": generated, "assets": uncertain})
    pdf_inventory = load_json(AUDIT_ROOT / "pdf-inventory.json", {"documents": []})
    review_items = []
    for document in pdf_inventory.get("documents", []):
        reasons = []
        if document.get("ocrRequired"): reasons.append("ocr-required")
        if document.get("fatalError"): reasons.append("fatal-extraction-error")
        if document.get("extractionErrors"): reasons.append("partial-extraction-errors")
        if document.get("freshness", {}).get("status") == "unverified-local": reasons.append("not-linked-from-current-asset-index")
        if reasons:
            review_items.append({"supplier": document.get("supplier"), "localPath": document.get("localPath"), "reasons": reasons})
    coverage_gaps = [
        {"supplier": item["supplier"], "productId": item["catalogue"].get("productId"), "supplierUrl": item.get("canonicalSupplierUrl"), "reason": "live documents reported but no page-level PDF evidence matched"}
        for item in matrix
        if any(item.get("documentsAvailableLive", {}).values()) and not item.get("pdfEvidence")
    ]
    manual_conflicts = load_json(AUDIT_ROOT / "manual-data-conflicts.json", {"conflicts": []})
    write_json(AUDIT_ROOT / "supplier-data-conflicts.json", {
        "generatedAt": generated,
        "automaticFactConflicts": manual_conflicts.get("conflicts", []),
        "automaticFactConflictNote": "No normalized website/PDF fact pair was safe to compare automatically; candidate facts retain page provenance for manual review.",
        "pdfReviewItems": review_items,
        "websitePdfCoverageGaps": coverage_gaps,
    })
    (AUDIT_ROOT / "README.md").write_text(markdown_report(summary, matrix), encoding="utf-8")
    print(f"Wrote supplier completeness reports for {len(summary)} suppliers and {len(matrix)} live products.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
