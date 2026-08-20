#!/usr/bin/env python3
"""Prepare a checkpointed WordPress derivative-to-original upgrade plan from saved state."""
from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from urllib.parse import urlsplit, urlunsplit

from scripts.ingest.crawl import (
    ASSET_PLANNER_VERSION, Asset, AssetTask, CONFIG, MANIFEST_ROOT, Page, ROOT, WP_SIZE_SUFFIX,
    atomic_write_json, attach_available_asset_occurrences, refresh_page_asset_candidates, same_allowed,
)


def original_url(url: str) -> str:
    parsed = urlsplit(url)
    return urlunsplit((parsed.scheme, parsed.netloc, WP_SIZE_SUFFIX.sub('', parsed.path), parsed.query, ''))


def prepare(slug: str, run_id: str) -> dict:
    configs = json.loads(CONFIG.read_text(encoding='utf-8'))
    cfg = next((item for item in configs if item['slug'] == slug), None)
    if not cfg: raise ValueError(f'unknown supplier {slug}')
    manifest = json.loads((MANIFEST_ROOT / f'{slug}.json').read_text(encoding='utf-8'))
    pages = [Page(**({'embedded_products': [], 'asset_candidates': []} | page)) for page in manifest.get('pages', [])]
    assets = {record['original_asset_url']: Asset(**record) for record in manifest.get('assets', [])}
    products = {product['id']: product for product in manifest.get('products', [])}
    pages_by_url = {page.url: page for page in pages}
    asset_domains = {domain.lower() for domain in cfg.get('asset_domains', cfg['allowed_domains'])}
    for page in pages:
        refresh_page_asset_candidates(page, cfg, asset_domains); page.assets = []
    aliases = {url: asset for asset in assets.values() for url in {asset.original_asset_url, asset.final_asset_url, *(asset.source_asset_urls or [])}}
    attach_available_asset_occurrences(pages, aliases)

    tasks = []
    upgrades = []
    seen = set()
    for asset in assets.values():
        selected = asset.selected_asset_url or asset.final_asset_url
        if not WP_SIZE_SUFFIX.search(urlsplit(selected).path): continue
        master = original_url(selected)
        if master == selected or master in aliases or master in seen: continue
        if not same_allowed(master, asset_domains): raise ValueError(f'inferred master outside allowed domains: {master}')
        product_ids = list(asset.product_ids)
        if not product_ids: continue
        product = products.get(product_ids[0])
        if not product: continue
        page = pages_by_url.get(product['sourceUrl'])
        if not page: continue
        occurrence = {'url': master, 'source_url': master, 'kind': 'image', 'role': asset.role, 'order': -1}
        page.asset_candidates.append(occurrence)
        task = AssetTask(master, master, page.url, 'image', asset.role, -1, product['id'], association_rank=0, relationship_signals=['wordpress-original-upgrade', 'filename-model-match'])
        tasks.append(task); seen.add(master)
        upgrades.append({'derivativeUrl': selected, 'masterUrl': master, 'derivativeLocalPath': asset.local_path, 'productIds': product_ids})

    if not tasks: raise ValueError('no WordPress derivative upgrades found')
    plan = {'plannerVersion': ASSET_PLANNER_VERSION, 'kind': 'wordpress-original-upgrade', 'groups': len(tasks), 'selected': len(tasks), 'available': len(tasks), 'complete': True, 'noPageDiscovery': True, 'existingValidatedAssetsReused': len(assets), 'upgrades': upgrades}
    staging_root = ROOT / 'source-media' / 'staging' / slug / run_id
    checkpoint_path = MANIFEST_ROOT / f'{slug}.checkpoint.json'
    if checkpoint_path.exists(): raise ValueError(f'refusing to overwrite existing checkpoint {checkpoint_path}')
    state = {'version': 2, 'runId': run_id, 'phase': 'asset-planned', 'pageDiscoveryComplete': True, 'queue': [], 'queued': [], 'seenRequests': sorted(page.url for page in pages), 'seenCanonical': sorted(page.url for page in pages), 'pages': [asdict(page) for page in pages], 'assets': [asdict(asset) for asset in assets.values()], 'errors': [], 'assetTasks': [asdict(task) for task in tasks], 'assetPlan': plan}
    audit = {'supplier': slug, 'runId': run_id, 'plan': plan, 'tasks': [asdict(task) for task in tasks]}
    atomic_write_json(staging_root / 'master-upgrade-plan.json', audit)
    atomic_write_json(checkpoint_path, state)
    return audit


def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument('--supplier', required=True); parser.add_argument('--run-id', required=True)
    args = parser.parse_args(); result = prepare(args.supplier, args.run_id)
    print(json.dumps(result, indent=2)); return 0

if __name__ == '__main__': raise SystemExit(main())