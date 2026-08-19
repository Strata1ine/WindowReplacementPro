#!/usr/bin/env python3
import json
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
cur=json.loads((ROOT/'src/data/catalog/curated-products.json').read_text())
disc=json.loads((ROOT/'src/data/catalog/discovered-products.json').read_text())
allp={p['id']:p for p in cur}
for p in disc:
    if p['id'] in allp:
        old=allp[p['id']]
        p={**old,**p,'media':sorted(set(old.get('media',[])+p.get('media',[]))),'documents':sorted(set(old.get('documents',[])+p.get('documents',[]))),'specifications':{**old.get('specifications',{}),**p.get('specifications',{})}}
    allp[p['id']]=p
products=list(allp.values())
print(f'Catalog records: {len(products)}')
for k,v in sorted(Counter(p['manufacturer'] for p in products).items()): print(f'  {k:16} {v:4}')
print(f'With media: {sum(bool(p.get("media")) for p in products)}')
print(f'With documents: {sum(bool(p.get("documents")) for p in products)}')
print(f'With model numbers: {sum(bool(p.get("modelNumber")) for p in products)}')
missing=[p for p in products if not p.get('sourceUrl')]
if missing: raise SystemExit(f'ERROR: {len(missing)} products missing sourceUrl')
ids=[p['id'] for p in products]
if len(ids)!=len(set(ids)): raise SystemExit('ERROR: duplicate product IDs after merge')
print('Catalog integrity: OK')
