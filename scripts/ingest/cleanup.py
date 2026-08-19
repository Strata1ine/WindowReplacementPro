#!/usr/bin/env python3
"""Dry-run-first cleanup for completed supplier-ingestion staging runs."""
from __future__ import annotations

import argparse
import json
import shutil
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STAGING_ROOT = ROOT / 'source-media' / 'staging'
PRODUCTION_REFERENCE_ROOTS = (
    ROOT / 'source-media' / 'manifests',
    ROOT / 'src',
    ROOT / 'scripts',
)


@dataclass
class CleanupCandidate:
    path: Path
    supplier: str
    run_id: str
    status: str
    files: int
    bytes: int


def production_reference_text() -> str:
    chunks: list[str] = []
    for root in PRODUCTION_REFERENCE_ROOTS:
        if not root.exists(): continue
        for path in root.rglob('*'):
            if path.is_file() and STAGING_ROOT not in path.parents:
                try: chunks.append(path.read_text(encoding='utf-8'))
                except (OSError, UnicodeDecodeError): continue
    return '\n'.join(chunks)


def scan_staging_runs(staging_root: Path = STAGING_ROOT, references: str | None = None) -> tuple[list[CleanupCandidate], list[Path]]:
    references = production_reference_text() if references is None else references
    candidates: list[CleanupCandidate] = []
    ambiguous: list[Path] = []
    if not staging_root.exists(): return candidates, ambiguous
    for metadata_path in sorted(staging_root.glob('*/*/run.json')):
        run_root = metadata_path.parent.resolve()
        if staging_root.resolve() not in run_root.parents:
            ambiguous.append(run_root); continue
        try: metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError):
            ambiguous.append(run_root); continue
        status = str(metadata.get('status', 'unknown'))
        if status not in {'accepted', 'failed', 'abandoned'}: continue
        files = [path for path in run_root.rglob('*') if path.is_file()]
        relative_tokens = []
        for path in files:
            try: relative_tokens.append(path.relative_to(ROOT).as_posix())
            except ValueError: relative_tokens.append(path.relative_to(staging_root).as_posix())
        if any(token in references for token in relative_tokens):
            ambiguous.append(run_root); continue
        candidates.append(CleanupCandidate(run_root, str(metadata.get('supplier', run_root.parent.name)), str(metadata.get('runId', run_root.name)), status, len(files), sum(path.stat().st_size for path in files)))
    return candidates, ambiguous


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--delete', action='store_true', help='Delete confirmed completed/failed staging runs. Without this flag, only print a dry run.')
    args = parser.parse_args()
    candidates, ambiguous = scan_staging_runs()
    mode = 'DELETE' if args.delete else 'DRY RUN'
    print(f'{mode}: {len(candidates)} confirmed staging run(s), {sum(item.files for item in candidates)} file(s), {sum(item.bytes for item in candidates)} byte(s)')
    for item in candidates:
        print(f'  {item.status:9} {item.supplier}/{item.run_id}  files={item.files} bytes={item.bytes}')
    for path in ambiguous:
        print(f'  AMBIGUOUS {path.relative_to(ROOT)}')
    if args.delete:
        for item in candidates: shutil.rmtree(item.path)
        print(f'Deleted {len(candidates)} confirmed staging run(s).')
    elif candidates:
        print('No files deleted. Re-run with --delete to remove only this confirmed set.')
    return 1 if ambiguous else 0


if __name__ == '__main__':
    raise SystemExit(main())
