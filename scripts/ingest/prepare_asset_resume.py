#!/usr/bin/env python3
"""Prepare a checkpointed, saved-snapshot-only corrective asset resume plan."""
from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from pathlib import Path

from scripts.ingest.crawl import (
    ASSET_PLANNER_VERSION, Asset, AssetTask, CONFIG, MANIFEST_ROOT, Page, ROOT,
    atomic_write_json, attach_available_asset_occurrences, refresh_page_asset_candidates,
)


def prepare(slug: str, report_path: Path, run_id: str) -> dict:
    configs = json.loads(CONFIG.read_text(encoding='utf-8'))
    cfg = next((item for item in configs if item['slug'] == slug), None)
    if not cfg:
        raise ValueError(f'unknown supplier {slug}')
    manifest = json.loads((MANIFEST_ROOT / f'{slug}.json').read_text(encoding='utf-8'))
    report = json.loads(report_path.read_text(encoding='utf-8'))
    pages = [Page(**({'embedded_products': [], 'asset_candidates': []} | page)) for page in manifest.get('pages', [])]
    assets = {record['original_asset_url']: Asset(**record) for record in manifest.get('assets', [])}
    asset_domains = {domain.lower() for domain in cfg.get('asset_domains', cfg['allowed_domains'])}
    for page in pages:
        refresh_page_asset_candidates(page, cfg, asset_domains)
        page.assets = []
    aliases = {url: asset for asset in assets.values() for url in {asset.original_asset_url, asset.final_asset_url, *(asset.source_asset_urls or [])}}
    attach_available_asset_occurrences(pages, aliases)
    pages_by_url = {page.url: page for page in pages}

    selected: dict[str, dict] = {}
    products: dict[str, list[str]] = {}
    for missing in report.get('productsStillMissingMedia', []):
        for candidate in missing.get('qualifyingCandidates', []):
            if candidate.get('downloadedLocally'):
                continue
            page = pages_by_url.get(missing['sourceUrl'])
            if not page:
                continue
            occurrence = next((item for item in page.asset_candidates if item['url'] == candidate['url']), None)
            if not occurrence:
                continue
            record = dict(occurrence)
            record['page_url'] = page.url
            record['group'] = missing['id']
            signals = []
            if candidate.get('filenameIdentityMatch'): signals.append('filename-model-match')
            if candidate.get('structuredProductMatch'): signals.append('structured-product-image')
            if candidate.get('primaryHero'): signals.append('primary-product-hero')
            if candidate.get('primaryGallery'): signals.append('primary-product-gallery')
            record['relationship_signals'] = signals
            record['association_rank'] = 0 if any(signal in signals for signal in ('filename-model-match', 'structured-product-image')) else 1
            existing = selected.get(record['url'])
            if not existing or record['association_rank'] < existing['association_rank']:
                selected[record['url']] = record
            products.setdefault(record['url'], []).append(missing['id'])

    tasks = [AssetTask(group=item['group'], association_rank=item['association_rank'], relationship_signals=item['relationship_signals'], **{key: item[key] for key in ('url', 'source_url', 'page_url', 'kind', 'role', 'order')}) for item in sorted(selected.values(), key=lambda value: (value['association_rank'], value['page_url'], value['order'], value['url']))]
    plan = {
        'plannerVersion': ASSET_PLANNER_VERSION,
        'kind': 'saved-snapshot-corrective-resume',
        'groups': len({task.group for task in tasks}),
        'selected': len(tasks),
        'available': len(tasks),
        'complete': True,
        'noPageDiscovery': True,
        'existingValidatedAssetsReused': len(assets),
        'candidateProductsByUrl': {url: sorted(set(ids)) for url, ids in products.items()},
    }
    staging_root = ROOT / 'source-media' / 'staging' / slug / run_id
    staging_root.mkdir(parents=True, exist_ok=True)
    checkpoint_path = MANIFEST_ROOT / f'{slug}.checkpoint.json'
    if checkpoint_path.exists():
        raise ValueError(f'refusing to overwrite existing checkpoint {checkpoint_path}')
    state = {
        'version': 2,
        'runId': run_id,
        'phase': 'asset-planned',
        'pageDiscoveryComplete': True,
        'queue': [], 'queued': [],
        'seenRequests': sorted(page.url for page in pages),
        'seenCanonical': sorted(page.url for page in pages),
        'pages': [asdict(page) for page in pages],
        'assets': [asdict(asset) for asset in assets.values()],
        'errors': [],
        'assetTasks': [asdict(task) for task in tasks],
        'assetPlan': plan,
    }
    audit = {'supplier': slug, 'runId': run_id, 'sourceReport': str(report_path.relative_to(ROOT)), 'plan': plan, 'tasks': [asdict(task) for task in tasks]}
    atomic_write_json(staging_root / 'missing-asset-resume-plan.json', audit)
    atomic_write_json(checkpoint_path, state)
    return audit


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--supplier', required=True)
    parser.add_argument('--report', type=Path, required=True)
    parser.add_argument('--run-id', required=True)
    args = parser.parse_args()
    report_path = args.report if args.report.is_absolute() else ROOT / args.report
    result = prepare(args.supplier, report_path.resolve(), args.run_id)
    print(json.dumps({'supplier': result['supplier'], 'runId': result['runId'], 'plan': result['plan']}, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())