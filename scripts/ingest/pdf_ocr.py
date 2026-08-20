#!/usr/bin/env python3
"""Optional OCR helper for image-only supplier PDFs."""
from __future__ import annotations

from pathlib import Path

try:
    import pypdfium2 as pdfium
except ImportError:
    pdfium = None

try:
    from rapidocr_onnxruntime import RapidOCR
except ImportError:
    RapidOCR = None


def ocr_pdf_pages(pdf_path: Path, scale: float = 2.5) -> tuple[dict[int, str], list[dict]]:
    """Return OCR text by 1-based page number without making OCR a core dependency."""
    if pdfium is None or RapidOCR is None:
        raise RuntimeError("OCR requested but pypdfium2 and rapidocr_onnxruntime are not available")
    engine = RapidOCR()
    document = pdfium.PdfDocument(str(pdf_path))
    text_by_page = {}
    errors = []
    try:
        for index in range(len(document)):
            page_number = index + 1
            try:
                bitmap = document[index].render(scale=scale)
                image = bitmap.to_pil().convert("RGB")
                result, _ = engine(image)
                lines = []
                for item in result or []:
                    if len(item) >= 2 and str(item[1]).strip():
                        lines.append(str(item[1]).strip())
                text_by_page[page_number] = "\n".join(lines)
                print(f"  OCR page {page_number}/{len(document)}: {len(text_by_page[page_number])} characters", flush=True)
            except Exception as error:
                errors.append({"page": page_number, "stage": "ocr", "error": str(error)})
    finally:
        document.close()
    return text_by_page, errors
