#!/usr/bin/env python3
"""Supplier-scoped page mappings for reviewed PDF product evidence."""
from __future__ import annotations

import re
from pathlib import Path


def configured_page_products(pdf_path: Path, page_number: int, rules: list[dict] | None) -> list[str] | None:
    """Return reviewed product IDs, [] for excluded pages, or None when no rule applies."""
    for rule in rules or []:
        if not any(re.search(pattern, pdf_path.name, re.I) for pattern in rule.get('patterns', [])):
            continue
        if page_number in set(rule.get('exclude_pages', [])):
            return []
        page_products = rule.get('page_product_ids', {}).get(str(page_number))
        return sorted(set(page_products if page_products is not None else rule.get('default_product_ids', [])))
    return None

def configured_document_metadata(pdf_path: Path, rules: list[dict] | None) -> dict:
    """Return reviewed document metadata for the first matching supplier rule."""
    for rule in rules or []:
        if any(re.search(pattern, pdf_path.name, re.I) for pattern in rule.get('patterns', [])):
            return dict(rule.get('document_metadata', {}))
    return {}
