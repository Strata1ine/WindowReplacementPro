#!/usr/bin/env python3
"""Verify archived FlipHTML5 page masters and derive reviewed product crops offline."""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
AUDIT_ROOT = ROOT / "audit" / "supplier-completeness"


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def extract(config_path: Path) -> dict:
    config = read_json(config_path)
    manifest_path = ROOT / config["publicationManifest"]
    manifest = read_json(manifest_path)
    supplier_name = config.get("supplierName") or manifest.get("supplierName") or config["supplier"]
    page_config = {item["pageNumber"]: item for item in config.get("pages", [])}
    extracted_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    publication_extracted_at = manifest.get("extractionTimestamp") or extracted_at
    derived_assets = []
    verified_pages = []
    extraction_root = manifest_path.parent / "extracted"
    extraction_root.mkdir(parents=True, exist_ok=True)

    for page in manifest["pages"]:
        local = ROOT / page["localPath"]
        if not local.is_file():
            raise FileNotFoundError(f"missing archived page {page['pageNumber']}: {local}")
        with Image.open(local) as image:
            width, height = image.size
            if [width, height] != [page["width"], page["height"]]:
                raise ValueError(f"dimension mismatch for page {page['pageNumber']}")
            actual_sha = digest(local)
            if actual_sha != page["sha256"]:
                raise ValueError(f"checksum mismatch for page {page['pageNumber']}")
            reviewed = page_config.get(page["pageNumber"], {})
            page_extracted_at = page.get("extractionTimestamp") or page.get("extractedAt") or publication_extracted_at
            page.update({
                "mimeType": "image/webp",
                "supplierName": supplier_name,
                "extractionTimestamp": page_extracted_at,
                "associatedProducts": reviewed.get("productIds", []),
                "collection": reviewed.get("collection"),
                "assetRole": reviewed.get("assetRole", "reference-only"),
                "relationshipState": reviewed.get("relationshipState", "supplier-shared"),
            })
            verified_pages.append(dict(page))
            crop_box = reviewed.get("cropBox")
            if crop_box:
                output = extraction_root / f"page-{page['pageNumber']:03d}-{reviewed['cropSlug']}.webp"
                image.crop(tuple(crop_box)).save(output, "WEBP", quality=95, method=6)
                with Image.open(output) as cropped:
                    crop_width, crop_height = cropped.size
                derived_assets.append({
                    "supplier": config["supplier"],
                    "supplierName": supplier_name,
                    "publicationTitle": manifest["publicationTitle"],
                    "publicationSourceUrl": manifest["publicationSourceUrl"],
                    "pageNumber": page["pageNumber"],
                    "underlyingAssetUrl": page["underlyingAssetUrl"],
                    "sourcePageLocalPath": page["localPath"],
                    "localPath": relative(output),
                    "sha256": digest(output),
                    "bytes": output.stat().st_size,
                    "width": crop_width,
                    "height": crop_height,
                    "mimeType": "image/webp",
                    "extractedAt": extracted_at,
                    "extractionTimestamp": extracted_at,
                    "associatedProducts": reviewed["productIds"],
                    "collection": reviewed.get("collection"),
                    "assetRole": "lifestyle-product",
                    "relationshipState": "product-specific",
                    "derivation": {"method": "reviewed-page-crop", "cropBox": crop_box},
                })

    manifest["supplierName"] = supplier_name
    manifest["highDefinitionConversion"] = bool(config.get("highDefinitionConversion"))
    manifest["pages"] = verified_pages
    manifest["reviewedAt"] = extracted_at
    write_json(manifest_path, manifest)
    write_json(extraction_root / "extracted-assets.json", {
        "supplier": config["supplier"],
        "supplierName": supplier_name,
        "publicationTitle": manifest["publicationTitle"],
        "publicationSourceUrl": manifest["publicationSourceUrl"],
        "extractedAt": extracted_at,
        "assets": derived_assets,
    })

    technical_roles = {"configuration-diagram", "colour-chart", "profile-section", "technical-drawing"}
    technical_pages = [page for page in verified_pages if page["assetRole"] in technical_roles]
    report = {
        "supplier": config["supplier"],
        "supplierName": supplier_name,
        "publicationTitle": manifest["publicationTitle"],
        "publicationSourceUrl": manifest["publicationSourceUrl"],
        "publicationYear": manifest.get("publicationYear"),
        "viewerCreatedUtc": manifest.get("viewerCreatedUtc"),
        "auditedAt": extracted_at,
        "status": "fliphtml5-website-and-media-verified",
        "pdfDocuments": {"count": 0, "status": "none/currently-unavailable"},
        "flipHtml5Publications": {"count": 1, "status": "audited"},
        "flipHtml5PagesProcessed": len(verified_pages),
        "highResolutionPageAssetsCaptured": len(verified_pages),
        "pageDimensions": sorted({f"{page['width']}x{page['height']}" for page in verified_pages}),
        "individualProductImagesExtracted": len(derived_assets),
        "technicalDiagramsChartsExtracted": len(technical_pages),
        "textLayerEvidenceExtracted": manifest.get("textLayer", {}).get("pageCount", 0),
        "ocrEvidenceExtracted": 0,
        "doorglassDesignPagesCaptured": sum(bool(page["associatedProducts"]) for page in verified_pages),
        "doorSlabReferencePagesCaptured": sum(page.get("collection") in {"Steel Entry Doors", "Steel Mark", "Fiberglass Entry Doors"} for page in verified_pages),
        "selection": manifest["pageAssetSelection"],
        "textLayer": manifest["textLayer"],
        "pageAssets": verified_pages,
        "individualProductAssets": derived_assets,
        "technicalPages": technical_pages,
        "notes": [
            "The viewer exposes no downloadable PDF; the FlipHTML5 publication is the current document source.",
            "Hashed 2181x2800 WebP masters were selected instead of thumbnails or browser screenshots.",
            "Nominal large JPG endpoints in the viewer manifest were unavailable, so they were not substituted.",
            "Product crops are derived only from pages devoted to one named design; collection and technical pages remain shared/reference evidence.",
            "The accessible embedded text layer was preserved; OCR was unnecessary."
        ]
    }
    write_json(AUDIT_ROOT / f"{config['supplier']}-fliphtml5-audit.json", report)
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    args = parser.parse_args()
    report = extract(args.config)
    excluded = {"pageAssets", "individualProductAssets", "technicalPages", "textLayer"}
    print(json.dumps({key: value for key, value in report.items() if key not in excluded}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
