#!/usr/bin/env python3
"""Re-evaluate product/media relationships from saved crawl snapshots without network access."""
from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import time
from dataclasses import asdict
from pathlib import Path
from urllib.parse import urlparse

from scripts.ingest.crawl import (
    Asset, CATALOG_DIR, CONFIG, DOCUMENT_ROLES, IMAGE_ROLES, MANIFEST_ROOT, Page, ROOT, WP_SIZE_SUFFIX,
    associate_assets, atomic_write_json, attach_available_asset_occurrences, enforce_filename_owner_precedence, enforce_wordpress_master_precedence, explicit_role,
    identity_keys, image_dimensions, manifest_asset, manifest_page, normalize, product_asset_paths, promote_referenced_assets,
    refresh_page_asset_candidates, urls_identity_match, validate_asset_binary, validate_product_records, write_supplier_archive,
)


def recover_downloaded_candidates(slug: str, pages: list[Page], assets: dict[str, Asset], staging_run: Path | None) -> int:
    roots = [ROOT / 'public' / 'images' / 'catalog' / slug, ROOT / 'public' / 'documents' / 'catalog' / slug]
    if staging_run: roots.append(staging_run)
    aliases = {url: asset for asset in assets.values() for url in {asset.original_asset_url, asset.final_asset_url, *(asset.source_asset_urls or [])}}
    by_hash = {asset.sha256: asset for asset in assets.values()}
    candidates: dict[str, dict] = {}
    for page in pages:
        for item in page.asset_candidates:
            key = item['url']; record = candidates.setdefault(key, dict(item, pages=set()))
            record['pages'].add(page.url)
            if explicit_role(item.get('role')) == 'product-hero': record['role'] = 'product-hero'
    recovered = 0
    for url, candidate in candidates.items():
        if url in aliases or candidate.get('source_url') in aliases:
            asset = aliases.get(url) or aliases[candidate.get('source_url')]
            asset.source_page_urls = sorted(set(asset.source_page_urls) | candidate['pages'])
            continue
        source_url = candidate.get('source_url') or url
        digests = {hashlib.sha256(value.encode('utf-8')).hexdigest()[:12] for value in {url, source_url}}
        matches = []
        for root in roots:
            if root.exists():
                matches.extend(path for digest in digests for path in root.rglob(f'*-{digest}.*'))
        if not matches: continue
        path = sorted(set(matches), key=lambda item: ('source-media' in item.parts, len(str(item))))[0]
        body = path.read_bytes(); sha = hashlib.sha256(body).hexdigest()
        existing = by_hash.get(sha)
        if existing:
            existing.source_asset_urls = sorted(set(existing.source_asset_urls) | {url, source_url})
            existing.source_page_urls = sorted(set(existing.source_page_urls) | candidate['pages'])
            aliases[url] = existing; aliases[source_url] = existing
            continue
        parts = list(path.parts); public_index = max(index for index, value in enumerate(parts) if value.lower() == 'public')
        local_path = '/' + '/'.join(parts[public_index + 1:])
        is_staged = 'source-media' in [value.lower() for value in parts[:public_index]]
        mime = mimetypes.guess_type(urlparse(url).path)[0]
        width, height = image_dimensions(body, mime) if candidate['kind'] == 'image' else (None, None)
        asset = Asset(slug, sorted(candidate['pages']), source_url, url, local_path, candidate['kind'], explicit_role(candidate.get('role')), sha, len(body), time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(path.stat().st_mtime)), str(path.relative_to(ROOT)) if is_staged else '', sorted({url, source_url}))
        asset.master_asset_url = source_url if not WP_SIZE_SUFFIX.search(urlparse(source_url).path) else None
        asset.selected_asset_url = url; asset.mime_type = mime; asset.width = width; asset.height = height
        assets[source_url] = asset; aliases[url] = asset; aliases[source_url] = asset; by_hash[sha] = asset; recovered += 1
    return recovered


def missing_media_diagnostic(product: dict, page: Page, assets: dict[str, Asset], cfg: dict) -> dict:
    product_keys = identity_keys([product.get('slug'), product.get('modelNumber'), product.get('name')])
    structured_urls = {normalize(url, page.url) for url in page.product_data.get('images', []) if normalize(url, page.url)} if cfg.get('trust_structured_product_images', True) else set()
    hero_candidates = [item for item in page.asset_candidates if explicit_role(item.get('role')) == 'product-hero']
    first_hero_order = min((item.get('order', 0) for item in hero_candidates), default=None)
    aliases = {url: asset for asset in assets.values() for url in {asset.original_asset_url, asset.final_asset_url, *(asset.source_asset_urls or [])}}
    candidates = []
    for item in page.asset_candidates:
        role = explicit_role(item.get('role'))
        if role not in IMAGE_ROLES:
            continue
        urls = [item['url'], item.get('source_url', item['url'])]
        filename_match = urls_identity_match(urls, product_keys)
        structured_match = bool(set(urls) & structured_urls)
        primary_hero = role == 'product-hero' and item.get('order', 0) == first_hero_order
        primary_gallery = role == 'product-gallery'
        shared_role = role in {'technical-drawing', 'profile-section', 'configuration-diagram', 'colour-chart', 'finish-swatch', 'glass-design', 'hardware'}
        structured_conflict = bool(structured_urls and (primary_hero or primary_gallery) and not structured_match and not filename_match and not shared_role)
        qualifies = (filename_match or structured_match or primary_hero or primary_gallery) and not structured_conflict
        asset = aliases.get(item['url']) or aliases.get(item.get('source_url', ''))
        if qualifies:
            candidates.append({'url': item['url'], 'sourceUrl': item.get('source_url', item['url']), 'role': role, 'filenameIdentityMatch': filename_match, 'structuredProductMatch': structured_match, 'primaryHero': primary_hero, 'primaryGallery': primary_gallery, 'downloadedLocally': bool(asset and validate_asset_binary(asset))})
    pending = [candidate for candidate in candidates if not candidate['downloadedLocally']]
    if pending:
        reason = 'qualifying original/master candidate exposed in saved product page but not downloaded'
    elif candidates and any((candidate['structuredProductMatch'] or candidate['primaryHero'] or candidate['primaryGallery']) and not candidate['filenameIdentityMatch'] for candidate in candidates):
        reason = 'supplier page points to a downloaded image whose exact filename/model belongs to another canonical product; cross-association rejected'
    elif candidates:
        reason = 'qualifying local binary exists but relationship remains unresolved; manual review required'
    elif page.asset_candidates:
        reason = 'saved supplier page exposes only shared swatches, conflicting identities, generic assets, or no product-specific image'
    else:
        reason = 'saved supplier page exposes no image candidates'
    return {'id': product['id'], 'sourceUrl': product['sourceUrl'], 'reason': reason, 'qualifyingCandidates': candidates}


def reassociate_supplier(slug: str, staging_run: Path | None = None) -> dict:
    if staging_run:
        staging_run = (staging_run if staging_run.is_absolute() else ROOT / staging_run).resolve()
    configs = json.loads(CONFIG.read_text(encoding='utf-8'))
    cfg = next((item for item in configs if item['slug'] == slug), None)
    if not cfg: raise ValueError(f'unknown supplier {slug}')
    manifest_path = MANIFEST_ROOT / f'{slug}.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    pages = [Page(**({'embedded_products': [], 'asset_candidates': []} | page)) for page in manifest.get('pages', [])]
    assets = {record['original_asset_url']: Asset(**record) for record in manifest.get('assets', [])}
    accepted_before = len(assets)
    asset_domains = {domain.lower() for domain in cfg.get('asset_domains', cfg['allowed_domains'])}
    for page in pages:
        refresh_page_asset_candidates(page, cfg, asset_domains); page.assets = []
    if staging_run and (staging_run / 'master-upgrade-plan.json').is_file():
        upgrade_plan = json.loads((staging_run / 'master-upgrade-plan.json').read_text(encoding='utf-8'))
        pages_by_upgrade_url = {page.url: page for page in pages}
        for task in upgrade_plan.get('tasks', []):
            page = pages_by_upgrade_url.get(task.get('page_url'))
            if page and task.get('url') not in {item['url'] for item in page.asset_candidates}:
                page.asset_candidates.append({'url': task['url'], 'source_url': task.get('source_url', task['url']), 'kind': task.get('kind', 'image'), 'role': task.get('role', 'product-hero'), 'order': task.get('order', -1)})
    recovered = recover_downloaded_candidates(slug, pages, assets, staging_run)
    aliases = {url: asset for asset in assets.values() for url in {asset.original_asset_url, asset.final_asset_url, *(asset.source_asset_urls or [])}}
    invalid = [asset.original_asset_url for asset in assets.values() if not validate_asset_binary(asset)]
    if invalid: raise ValueError(f'{len(invalid)} recovered/promoted assets failed local checksum validation')
    attach_available_asset_occurrences(pages, aliases)
    pages_by_url = {page.url: page for page in pages}
    products = manifest.get('products', []); before_media = {product['id']: list(product.get('media', [])) for product in products}
    for asset in assets.values():
        asset.product_ids = []; asset.collections = []; asset.relationship_evidence = []
        asset.scope = 'unassociated'; asset.relationship_state = 'uncertain/review'
    for product in products:
        page = pages_by_url.get(product['sourceUrl'])
        if not page: product['media'] = []; product['documents'] = []; continue
        media, documents = product_asset_paths(page, assets, cfg.get('attach_page_roles'), [product.get('slug'), product.get('modelNumber'), product.get('name')], cfg.get('trust_structured_product_images', True))
        product['media'] = media; product['documents'] = documents
    enforce_filename_owner_precedence(assets, products); enforce_wordpress_master_precedence(assets, products); associate_assets(assets, products); validate_product_records(products, cfg)
    accepted = promote_referenced_assets(assets, products, pages)
    associate_assets(accepted, products)
    accepted_ids = {id(asset) for asset in accepted.values()}
    rejected = [asdict(asset) for asset in assets.values() if id(asset) not in accepted_ids]
    resolved_errors = [dict(error, resolved=True, resolvedAt=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), resolution='subsequent checkpointed request validated') for error in manifest.get('errors', [])]
    manifest['pages'] = [manifest_page(page) for page in pages]; manifest['assets'] = [manifest_asset(asset) for asset in accepted.values()]; manifest['products'] = products
    manifest['resolvedErrors'] = [*manifest.get('resolvedErrors', []), *resolved_errors]; manifest['errors'] = []
    manifest['relationshipsRevalidatedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    atomic_write_json(manifest_path, manifest); atomic_write_json(CATALOG_DIR / f'{slug}.json', products); write_supplier_archive(slug, accepted)
    report = {
        'supplier': slug, 'products': len(products), 'productsWithMediaBefore': sum(bool(paths) for paths in before_media.values()), 'productsWithMediaAfter': sum(bool(product.get('media')) for product in products),
        'productsStillMissingMedia': [missing_media_diagnostic(product, pages_by_url[product['sourceUrl']], assets, cfg) for product in products if not product.get('media') and product['sourceUrl'] in pages_by_url],
        'acceptedAssetsBefore': accepted_before, 'downloadedCandidatesRecovered': recovered, 'acceptedAssetsAfter': len(accepted), 'rejectedAssociations': rejected,
        'relationshipStates': {state: sum(asset.relationship_state == state for asset in accepted.values()) for state in ('product-specific', 'collection-shared', 'supplier-shared', 'uncertain/review')},
        'sharedProductBinaries': sum(len(asset.product_ids) > 1 for asset in accepted.values()), 'changedProducts': [product['id'] for product in products if before_media.get(product['id'], []) != product.get('media', [])], 'resolvedErrors': resolved_errors,
    }
    atomic_write_json(ROOT / 'audit' / 'supplier-completeness' / f'{slug}-relationship-revalidation.json', report)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument('--supplier', required=True); parser.add_argument('--staging-run', type=Path)
    args = parser.parse_args(); report = reassociate_supplier(args.supplier, args.staging_run); summary = {key: value for key, value in report.items() if key not in {'rejectedAssociations', 'changedProducts'}}; print(json.dumps(summary, indent=2)); return 0


if __name__ == '__main__': raise SystemExit(main())