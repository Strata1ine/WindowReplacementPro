#!/usr/bin/env python3
"""Extract supplier PDF text, tables, useful images, and page-level product evidence."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import shutil
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import pdfplumber
from PIL import Image, ImageStat
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
PUBLIC_DOCS = ROOT / "public" / "documents" / "catalog"
SOURCE_SUPPLIERS = ROOT / "source-media" / "suppliers"
CATALOG = ROOT / "src" / "data" / "catalog"
AUDIT = ROOT / "audit" / "supplier-completeness"
FACT_TERMS = re.compile(
    r"\b(?:u[- ]?factor|energy rating|energy star|visible transmittance|solar heat gain|"
    r"air infiltration|water penetration|design pressure|warranty|limited lifetime|"
    r"dimensions?|width|height|thickness|glass|glazing|frame|sash|panel|colour|color|"
    r"hardware|performance|efficiency|low[- ]?e|argon|thermal|r[- ]?value)\b",
    re.I,
)
DATE_PATTERN = re.compile(r"(?<!\d)(20\d{2})(?:[-_.](0[1-9]|1[0-2]))?(?:[-_.](0[1-9]|[12]\d|3[01]))?(?!\d)")


def load_json(path: Path, default):
    if not path.is_file():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    json.loads(temp.read_text(encoding="utf-8"))
    temp.replace(path)


def write_text(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value.rstrip() + "\n" if value.strip() else "", encoding="utf-8")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def catalog_products(slug: str) -> list[dict]:
    curated = [item for item in load_json(CATALOG / "curated-products.json", []) if item.get("manufacturer") == slug]
    discovered = load_json(CATALOG / "discovered" / f"{slug}.json", [])
    by_id = {item["id"]: item for item in curated}
    by_id.update({item["id"]: item for item in discovered})
    return list(by_id.values())


def product_patterns(products: list[dict]) -> list[tuple[str, re.Pattern]]:
    patterns = []
    for product in products:
        values = {product.get("modelNumber"), product.get("name")}
        slug = str(product.get("slug") or "")
        if len(slug) >= 5: values.add(slug.replace("-", " "))
        alternatives = sorted({re.escape(str(value).strip()) for value in values if value and len(str(value).strip()) >= 4}, key=len, reverse=True)
        if alternatives:
            patterns.append((product["id"], re.compile(r"(?<![A-Za-z0-9])(?:" + "|".join(alternatives) + r")(?![A-Za-z0-9])", re.I)))
    return patterns


def provenance_by_path(slug: str) -> dict[str, dict]:
    records = load_json(SOURCE_SUPPLIERS / slug / "asset-index.json", [])
    return {item.get("localPath", ""): item for item in records if item.get("localPath")}


def document_date(path: Path, metadata: dict, provenance: dict) -> str | None:
    candidates = [path.name, str(provenance.get("originalUrl", "")), str(provenance.get("finalUrl", "")), str(metadata.get("/CreationDate", "")), str(metadata.get("/ModDate", ""))]
    dates = []
    for value in candidates:
        for match in DATE_PATTERN.finditer(value):
            year, month, day = match.groups()
            dates.append(f"{year}-{month or '01'}-{day or '01'}")
    return max(dates) if dates else None


def useful_image(image: Image.Image, byte_count: int) -> bool:
    width, height = image.size
    if width < 160 or height < 120 or width * height < 50000 or byte_count < 3000:
        return False
    ratio = width / max(height, 1)
    if ratio > 8 or ratio < 0.125:
        return False
    rgb = image.convert("RGB")
    stat = ImageStat.Stat(rgb.resize((64, 64)))
    return sum(stat.var) > 30


def extract_pdf(pdf_path: Path, slug: str, provenance: dict, patterns: list[tuple[str, re.Pattern]], extract_images: bool) -> dict:
    local_path = "/" + pdf_path.relative_to(ROOT / "public").as_posix()
    doc_hash = sha256(pdf_path)
    doc_id = f"{slug}:{pdf_path.stem}"
    output = SOURCE_SUPPLIERS / slug / "pdf-extracted" / pdf_path.stem
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)
    reader = PdfReader(str(pdf_path))
    metadata = {str(key): str(value) for key, value in (reader.metadata or {}).items() if value is not None}
    page_records = []
    fact_candidates = []
    image_candidates = []
    text_characters = 0
    table_count = 0
    extraction_errors = []

    try:
        plumber = pdfplumber.open(str(pdf_path))
    except Exception as error:
        plumber = None
        extraction_errors.append({"stage": "open-pdfplumber", "error": str(error)})

    for page_number in range(1, len(reader.pages) + 1):
        text = ""
        tables = []
        if plumber is not None and page_number <= len(plumber.pages):
            page = plumber.pages[page_number - 1]
            try:
                text = page.extract_text(x_tolerance=2, y_tolerance=3) or ""
            except Exception as error:
                extraction_errors.append({"page": page_number, "stage": "text", "error": str(error)})
            try:
                tables = page.extract_tables() or []
            except Exception as error:
                extraction_errors.append({"page": page_number, "stage": "tables", "error": str(error)})
        text_path = output / "pages" / f"page-{page_number:04d}.txt"
        write_text(text_path, text)
        text_characters += len(text)
        matched_products = sorted(product_id for product_id, pattern in patterns if pattern.search(text))
        table_paths = []
        for table_number, table in enumerate(tables, 1):
            table_path = output / "tables" / f"page-{page_number:04d}-table-{table_number:02d}.json"
            write_json(table_path, {"page": page_number, "rows": table})
            table_paths.append(table_path.relative_to(ROOT).as_posix())
            table_count += 1
        for line_number, line in enumerate(text.splitlines(), 1):
            cleaned = re.sub(r"\s+", " ", line).strip()
            if len(cleaned) >= 8 and FACT_TERMS.search(cleaned):
                fact_candidates.append({"page": page_number, "line": line_number, "text": cleaned[:500], "productIds": matched_products})
        if extract_images:
            try:
                for image_number, embedded in enumerate(reader.pages[page_number - 1].images, 1):
                    data = embedded.data
                    image = Image.open(io.BytesIO(data))
                    image.load()
                    image_hash = hashlib.sha256(image.convert("RGB").tobytes()).hexdigest()
                    image_candidates.append({"page": page_number, "ordinal": image_number, "name": embedded.name, "data": data, "image": image, "hash": image_hash, "productIds": matched_products})
            except Exception as error:
                extraction_errors.append({"page": page_number, "stage": "images", "error": str(error)})
        page_records.append({
            "page": page_number,
            "textPath": text_path.relative_to(ROOT).as_posix(),
            "characters": len(text),
            "tables": table_paths,
            "images": [],
            "evidenceProductIds": matched_products,
        })
    if plumber is not None:
        plumber.close()

    repetitions = Counter(item["hash"] for item in image_candidates)
    saved_hashes = set()
    for item in image_candidates:
        image = item.pop("image")
        data = item.pop("data")
        if item["hash"] in saved_hashes or repetitions[item["hash"]] > 2 or not useful_image(image, len(data)):
            continue
        extension = (Path(item["name"]).suffix or ".png").lower()
        if extension not in {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}:
            extension = ".png"
        image_path = output / "images" / f"page-{item['page']:04d}-image-{item['ordinal']:02d}{extension}"
        image_path.parent.mkdir(parents=True, exist_ok=True)
        if extension == ".png":
            image.convert("RGBA" if image.mode == "RGBA" else "RGB").save(image_path)
        else:
            image.convert("RGB").save(image_path, quality=95)
        saved_hashes.add(item["hash"])
        record = {"path": image_path.relative_to(ROOT).as_posix(), "page": item["page"], "width": image.width, "height": image.height, "sha256": item["hash"], "productIds": item["productIds"]}
        page_records[item["page"] - 1]["images"].append(record)

    doc_date = document_date(pdf_path, metadata, provenance)
    current_status = "current-source-linked" if provenance else "unverified-local"
    document = {
        "documentId": doc_id,
        "supplier": slug,
        "localPath": local_path,
        "sha256": doc_hash,
        "bytes": pdf_path.stat().st_size,
        "pageCount": len(reader.pages),
        "textCharacters": text_characters,
        "tableCount": table_count,
        "extractedImageCount": len(saved_hashes),
        "ocrRequired": text_characters < max(100, len(reader.pages) * 20),
        "metadata": metadata,
        "documentDate": doc_date,
        "freshness": {"status": current_status, "basis": "present in current supplier asset index" if provenance else "local PDF has no current relationship record"},
        "provenance": provenance or {"localPath": local_path},
        "pages": page_records,
        "factCandidates": fact_candidates,
        "extractionErrors": extraction_errors,
        "extractedAt": datetime.now(timezone.utc).isoformat(),
    }
    write_json(output / "document.json", document)
    return document


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--supplier", action="append", help="Supplier slug; repeatable. Defaults to every PDF supplier.")
    parser.add_argument("--no-images", action="store_true", help="Skip embedded-image selection.")
    args = parser.parse_args()
    selected = set(args.supplier or [])
    existing_inventory = load_json(AUDIT / "pdf-inventory.json", {"documents": []})
    documents = [item for item in existing_inventory.get("documents", []) if selected and item.get("supplier") not in selected]
    product_evidence = defaultdict(list)
    suppliers = defaultdict(lambda: {"documents": 0, "pages": 0, "characters": 0, "tables": 0, "images": 0, "ocrRequired": 0, "errors": 0})
    if not PUBLIC_DOCS.is_dir():
        raise SystemExit("No permanent supplier PDF directory exists")
    for supplier_dir in sorted(path for path in PUBLIC_DOCS.iterdir() if path.is_dir() and (not selected or path.name in selected)):
        slug = supplier_dir.name
        provenance = provenance_by_path(slug)
        patterns = product_patterns(catalog_products(slug))
        for pdf_path in sorted(supplier_dir.glob("*.pdf")):
            local_path = "/" + pdf_path.relative_to(ROOT / "public").as_posix()
            print(f"[{slug}] {pdf_path.name}", flush=True)
            try:
                document = extract_pdf(pdf_path, slug, provenance.get(local_path, {}), patterns, not args.no_images)
            except Exception as error:
                document = {"supplier": slug, "localPath": local_path, "fatalError": str(error)}
            documents.append(document)
            stats = suppliers[slug]
            stats["documents"] += 1
            stats["pages"] += document.get("pageCount", 0)
            stats["characters"] += document.get("textCharacters", 0)
            stats["tables"] += document.get("tableCount", 0)
            stats["images"] += document.get("extractedImageCount", 0)
            stats["ocrRequired"] += bool(document.get("ocrRequired"))
            stats["errors"] += len(document.get("extractionErrors", [])) + bool(document.get("fatalError"))
            for page in document.get("pages", []):
                for product_id in page.get("evidenceProductIds", []):
                    product_evidence[product_id].append({
                        "documentId": document["documentId"],
                        "localPath": document["localPath"],
                        "page": page["page"],
                        "textPath": page["textPath"],
                        "tables": page["tables"],
                        "images": [item["path"] for item in page["images"] if product_id in item.get("productIds", [])],
                        "factCandidates": [item["text"] for item in document.get("factCandidates", []) if item["page"] == page["page"] and product_id in item.get("productIds", [])],
                    })
    product_evidence = defaultdict(list)
    suppliers = defaultdict(lambda: {"documents": 0, "pages": 0, "characters": 0, "tables": 0, "images": 0, "ocrRequired": 0, "errors": 0})
    for document in documents:
        slug = document.get("supplier", "unknown")
        stats = suppliers[slug]
        stats["documents"] += 1
        stats["pages"] += document.get("pageCount", 0)
        stats["characters"] += document.get("textCharacters", 0)
        stats["tables"] += document.get("tableCount", 0)
        stats["images"] += document.get("extractedImageCount", 0)
        stats["ocrRequired"] += bool(document.get("ocrRequired"))
        stats["errors"] += len(document.get("extractionErrors", [])) + bool(document.get("fatalError"))
        for page in document.get("pages", []):
            for product_id in page.get("evidenceProductIds", []):
                product_evidence[product_id].append({
                    "documentId": document["documentId"], "localPath": document["localPath"], "page": page["page"], "textPath": page["textPath"],
                    "tables": page["tables"], "images": [item["path"] for item in page["images"] if product_id in item.get("productIds", [])],
                    "factCandidates": [item["text"] for item in document.get("factCandidates", []) if item["page"] == page["page"] and product_id in item.get("productIds", [])],
                })
    generated = datetime.now(timezone.utc).isoformat()
    write_json(AUDIT / "pdf-inventory.json", {"generatedAt": generated, "documents": documents})
    write_json(AUDIT / "pdf-evidence.json", {"generatedAt": generated, "products": [{"productId": key, "pdfEvidence": value} for key, value in sorted(product_evidence.items())]})
    write_json(AUDIT / "pdf-extraction-summary.json", {"generatedAt": generated, "suppliers": [{"supplier": key, **value} for key, value in sorted(suppliers.items())]})
    print(f"Extracted {len(documents)} PDFs; page evidence linked to {len(product_evidence)} products.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())