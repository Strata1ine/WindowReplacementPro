#!/usr/bin/env python3
"""Build an auditable live-source inventory from independent supplier crawl manifests."""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AUDIT = ROOT / "audit" / "supplier-completeness"
SOURCE = ROOT / "source-media"
CONFIG = ROOT / "scripts" / "ingest" / "suppliers.json"
DOCUMENT_ROLES = {"brochure", "specification-sheet", "installation-guide", "warranty", "performance-document", "catalogue"}


def load(path: Path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else default


def write(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    json.loads(temp.read_text(encoding="utf-8"))
    temp.replace(path)


def main() -> int:
    statuses = load(AUDIT / "live-verification-status.json", {"suppliers": []})
    status_by_slug = {item["supplier"]: item for item in statuses.get("suppliers", [])}
    suppliers = []
    for config in load(CONFIG, []):
        slug = config["slug"]
        manifest = load(SOURCE / "manifests" / f"{slug}.json", {})
        relationships = load(SOURCE / "suppliers" / slug / "asset-index.json", [])
        by_product = defaultdict(list)
        for asset in relationships:
            for product_id in asset.get("productIds", []):
                by_product[product_id].append(asset)
        products = []
        for product in manifest.get("products", []):
            assets = by_product.get(product["id"], [])
            roles = {item.get("role") for item in assets}
            documents = roles & DOCUMENT_ROLES
            products.append({
                "productId": product.get("id"),
                "name": product.get("name"),
                "modelNumber": product.get("modelNumber"),
                "collection": product.get("collection"),
                "category": product.get("category"),
                "canonicalUrl": product.get("sourceUrl"),
                "mediaAvailable": {
                    "hero": "product-hero" in roles,
                    "gallery": "product-gallery" in roles,
                    "technicalDrawings": bool(roles & {"technical-drawing", "profile-section", "configuration-diagram"}),
                    "colourFinish": bool(roles & {"colour-chart", "finish-swatch"}),
                    "glass": "glass-design" in roles,
                    "hardware": "hardware" in roles,
                },
                "documentsAvailable": {
                    "brochure": "brochure" in documents,
                    "specificationSheet": "specification-sheet" in documents,
                    "installationGuide": "installation-guide" in documents,
                    "warranty": "warranty" in documents,
                    "performanceDocument": "performance-document" in documents,
                    "catalogue": "catalogue" in documents,
                },
                "verifiedAt": manifest.get("crawledAt"),
            })
        status = status_by_slug.get(slug, {})
        suppliers.append({
            "supplier": slug,
            "status": status.get("status", "VERIFICATION-PENDING"),
            "websiteStatus": status.get("websiteStatus", "VERIFICATION-PENDING"),
            "mediaStatus": status.get("mediaStatus", "VERIFICATION-PENDING"),
            "pdfStatus": status.get("pdfStatus", "VERIFICATION-PENDING"),
            "basis": status.get("basis", "current independent crawl manifest; completeness review pending" if manifest else "no manifest"),
            "expectedRelevantProducts": status.get("expectedRelevantProducts"),
            "manifestCrawledAt": manifest.get("crawledAt"),
            "pagesCrawled": len(manifest.get("pages", [])),
            "errors": manifest.get("errors", []),
            "products": products,
        })
    write(AUDIT / "live-source-inventory.json", {"generatedAt": datetime.now(timezone.utc).isoformat(), "suppliers": suppliers})
    print(f"Wrote live-source inventory for {len(suppliers)} suppliers and {sum(len(item['products']) for item in suppliers)} manifest products.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())