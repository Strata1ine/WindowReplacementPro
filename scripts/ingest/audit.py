#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = (ROOT / 'public').resolve()
CURATED = ROOT / 'src' / 'data' / 'catalog' / 'curated-products.json'
DISCOVERED_DIR = ROOT / 'src' / 'data' / 'catalog' / 'discovered'
SUPPLIERS = ROOT / 'scripts' / 'ingest' / 'suppliers.json'
MANUFACTURERS = ROOT / 'src' / 'data' / 'manufacturers.ts'
ALLOWED_CATEGORIES = {'windows', 'entry-doors', 'patio-doors', 'door-glass', 'unclassified'}
REQUIRED_STRINGS = {'id', 'manufacturer', 'slug', 'name', 'category', 'sourceUrl', 'sourceType', 'lastVerified'}
NULLABLE_STRINGS = {'collection', 'modelNumber', 'type', 'summary'}
SLUG_RE = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def load_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def raw_duplicates(records: list[dict], key_fn) -> list[str]:
    counts = Counter(key_fn(record) for record in records)
    return [str(key) for key, count in counts.items() if count > 1]


def local_asset_error(value: str, expected_root: str) -> str | None:
    if not value.startswith(expected_root):
        return f'must start with {expected_root}'
    target = (PUBLIC / unquote(value.lstrip('/'))).resolve()
    try:
        target.relative_to(PUBLIC)
    except ValueError:
        return 'escapes the public directory'
    if not target.is_file():
        return f'file does not exist: {target.relative_to(ROOT)}'
    return None


def validate_records(records: object, label: str, suppliers: dict[str, dict], allow_unclassified: bool) -> list[str]:
    errors: list[str] = []
    if not isinstance(records, list):
        return [f'{label}: root must be an array']
    for index, record in enumerate(records):
        here = f'{label}[{index}]'
        if not isinstance(record, dict):
            errors.append(f'{here}: must be an object')
            continue
        for key in REQUIRED_STRINGS:
            if not isinstance(record.get(key), str) or not record[key].strip():
                errors.append(f'{here}.{key}: must be a non-empty string')
        for key in NULLABLE_STRINGS:
            if record.get(key) is not None and not isinstance(record.get(key), str):
                errors.append(f'{here}.{key}: must be a string or null')
        for key in ('media', 'documents'):
            value = record.get(key)
            if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
                errors.append(f'{here}.{key}: must be an array of strings')
        specs = record.get('specifications')
        if not isinstance(specs, dict):
            errors.append(f'{here}.specifications: must be an object')
        elif any(not isinstance(value, str) and not (isinstance(value, list) and all(isinstance(item, str) for item in value)) for value in specs.values()):
            errors.append(f'{here}.specifications: values must be strings or arrays of strings')

        manufacturer = record.get('manufacturer')
        category = record.get('category')
        if isinstance(manufacturer, str) and manufacturer not in suppliers:
            errors.append(f'{here}.manufacturer: unknown manufacturer {manufacturer}')
        if isinstance(category, str):
            if category not in ALLOWED_CATEGORIES:
                errors.append(f'{here}.category: unsupported category {category}')
            elif category == 'unclassified' and not allow_unclassified:
                errors.append(f'{here}.category: curated records may not be unclassified')
            elif isinstance(manufacturer, str) and manufacturer in suppliers and category != 'unclassified' and category not in suppliers[manufacturer]['categories']:
                errors.append(f'{here}.category: {category} is not configured for {manufacturer}')

        slug = record.get('slug')
        if isinstance(slug, str) and not SLUG_RE.fullmatch(slug):
            errors.append(f'{here}.slug: invalid route slug {slug}')
        verified = record.get('lastVerified')
        if isinstance(verified, str) and not DATE_RE.fullmatch(verified):
            errors.append(f'{here}.lastVerified: must use YYYY-MM-DD')
        source_url = record.get('sourceUrl')
        if isinstance(source_url, str) and isinstance(manufacturer, str) and manufacturer in suppliers:
            parsed = urlparse(source_url)
            allowed = {domain.lower() for domain in suppliers[manufacturer]['allowed_domains']}
            if parsed.scheme not in {'http', 'https'} or (parsed.hostname or '').lower() not in allowed:
                errors.append(f'{here}.sourceUrl: outside configured supplier domains')

        for value in record.get('media', []) if isinstance(record.get('media'), list) else []:
            if isinstance(value, str) and (error := local_asset_error(value, '/images/catalog/')):
                errors.append(f'{here}.media: {error}')
        for value in record.get('documents', []) if isinstance(record.get('documents'), list) else []:
            if isinstance(value, str) and (error := local_asset_error(value, '/documents/catalog/')):
                errors.append(f'{here}.documents: {error}')

    if isinstance(records, list):
        for duplicate in raw_duplicates(records, lambda product: product.get('id') if isinstance(product, dict) else None):
            errors.append(f'{label}: duplicate raw id {duplicate}')
        for duplicate in raw_duplicates(records, lambda product: (product.get('manufacturer'), product.get('slug')) if isinstance(product, dict) else None):
            errors.append(f'{label}: duplicate raw route {duplicate}')
    return errors


def meaningful(value) -> bool:
    if value is None: return False
    if isinstance(value, str): return bool(value.strip())
    if isinstance(value, (list, dict)): return bool(value)
    return True


def merge_product(existing: dict, incoming: dict) -> dict:
    if existing['manufacturer'] != incoming['manufacturer'] or existing['slug'] != incoming['slug']:
        raise ValueError(f'conflicting route identity for {existing["id"]}')
    merged = dict(existing)
    for key in ('name', 'collection', 'modelNumber', 'type', 'summary', 'sourceUrl', 'sourceType'):
        if meaningful(incoming.get(key)): merged[key] = incoming[key]
    if incoming.get('category') != 'unclassified': merged['category'] = incoming['category']
    merged['media'] = sorted(set(existing.get('media', [])) | set(incoming.get('media', [])))
    merged['documents'] = sorted(set(existing.get('documents', [])) | set(incoming.get('documents', [])))
    merged['specifications'] = {**existing.get('specifications', {}), **{key: value for key, value in incoming.get('specifications', {}).items() if meaningful(value)}}
    merged['lastVerified'] = max(existing['lastVerified'], incoming['lastVerified'])
    return merged


def main() -> int:
    supplier_list = load_json(SUPPLIERS)
    suppliers = {supplier['slug']: supplier for supplier in supplier_list}
    manufacturer_slugs = set(re.findall(r"slug:\s*'([^']+)'", MANUFACTURERS.read_text(encoding='utf-8')))
    errors: list[str] = []
    if manufacturer_slugs != set(suppliers):
        errors.append(f'manufacturer registry differs from supplier config: TS={sorted(manufacturer_slugs)} config={sorted(suppliers)}')

    curated = load_json(CURATED)
    errors.extend(validate_records(curated, CURATED.name, suppliers, allow_unclassified=False))
    discovered: list[dict] = []
    expected_files = {f'{slug}.json' for slug in suppliers}
    actual_files = {path.name for path in DISCOVERED_DIR.glob('*.json')}
    for missing in sorted(expected_files - actual_files): errors.append(f'discovered catalogue missing supplier file: {missing}')
    for extra in sorted(actual_files - expected_files): errors.append(f'discovered catalogue has unknown supplier file: {extra}')
    for path in sorted(DISCOVERED_DIR.glob('*.json')):
        records = load_json(path)
        errors.extend(validate_records(records, f'discovered/{path.name}', suppliers, allow_unclassified=True))
        if isinstance(records, list):
            for record in records:
                if isinstance(record, dict) and record.get('manufacturer') != path.stem:
                    errors.append(f'discovered/{path.name}: record {record.get("id")} has wrong manufacturer')
            discovered.extend(records)
    for duplicate in raw_duplicates(discovered, lambda product: product.get('id')):
        errors.append(f'discovered catalogue: duplicate raw id across supplier files {duplicate}')
    for duplicate in raw_duplicates(discovered, lambda product: (product.get('manufacturer'), product.get('slug'))):
        errors.append(f'discovered catalogue: duplicate raw route across supplier files {duplicate}')

    merged = {product['id']: product for product in curated} if isinstance(curated, list) else {}
    try:
        for product in discovered:
            merged[product['id']] = merge_product(merged[product['id']], product) if product['id'] in merged else product
    except (KeyError, ValueError) as error:
        errors.append(str(error))
    products = list(merged.values())

    print(f'Catalog records: {len(products)} ({len(curated)} curated, {len(discovered)} discovered)')
    for key, value in sorted(Counter(product['manufacturer'] for product in products).items()):
        print(f'  {key:16} {value:4}')
    print(f'Missing summary: {sum(not meaningful(product.get("summary")) for product in products)}')
    print(f'Missing model number: {sum(not meaningful(product.get("modelNumber")) for product in products)}')
    print(f'Missing specifications: {sum(not meaningful(product.get("specifications")) for product in products)}')
    print(f'Missing media: {sum(not meaningful(product.get("media")) for product in products)}')
    print(f'Missing documents: {sum(not meaningful(product.get("documents")) for product in products)}')
    if errors:
        print(f'Catalog integrity: FAILED ({len(errors)} error(s))', file=sys.stderr)
        for error in errors: print(f'ERROR: {error}', file=sys.stderr)
        return 1
    print('Catalog integrity: OK')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
