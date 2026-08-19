#!/usr/bin/env python3
"""Validate the generated evidence, provenance, editorial, and link-status overlay."""
from __future__ import annotations
import json, re, sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse
ROOT=Path(__file__).resolve().parents[1]; CATALOG=ROOT/'src'/'data'/'catalog'; PUBLIC=ROOT/'public'
STATUSES={'active','redirected','unavailable','stale','blocked'}
def load(path): return json.loads(path.read_text(encoding='utf-8'))
def main():
    errors=[]; curated=load(CATALOG/'curated-products.json'); ids={x['id'] for x in curated}; manufacturers={x['id']:x['manufacturer'] for x in curated}
    for path in sorted((CATALOG/'discovered').glob('*.json')):
        for item in load(path): ids.add(item['id']); manufacturers[item['id']]=item['manufacturer']
    records=load(CATALOG/'enrichment-records.json'); links=load(CATALOG/'source-link-status.json')
    record_ids=[x.get('productId') for x in records]
    if set(record_ids)!=ids: errors.append(f'enrichment IDs differ from catalogue: missing={sorted(ids-set(record_ids))} extra={sorted(set(record_ids)-ids)}')
    if len(record_ids)!=len(set(record_ids)): errors.append('enrichment contains duplicate productId values')
    drafts=normalized=media=documents=0
    for index,item in enumerate(records):
        here=f'enrichment[{index}]'; product_id=item.get('productId'); facts=item.get('sourceFacts'); editorial=item.get('editorial')
        if not isinstance(facts,dict) or not isinstance(editorial,dict): errors.append(f'{here}: missing sourceFacts/editorial'); continue
        normalized_facts=facts.get('normalized')
        if not isinstance(normalized_facts,dict): errors.append(f'{here}.sourceFacts.normalized must be an object'); normalized_facts={}
        normalized+=bool(normalized_facts); media+=bool(facts.get('sourceMedia')); documents+=bool(facts.get('sourceDocuments'))
        all_facts=[facts.get('manufacturer'),facts.get('sourceUrl'),facts.get('modelNumber'),facts.get('collection'),*normalized_facts.values()]
        for fact_index,fact in enumerate(x for x in all_facts if x is not None):
            if not isinstance(fact,dict) or not isinstance(fact.get('sources'),list) or not fact['sources']: errors.append(f'{here}: fact {fact_index} lacks provenance'); continue
            if not isinstance(fact.get('value'),(str,list)) or not fact.get('value'): errors.append(f'{here}: fact {fact_index} has no value')
            for source in fact['sources']:
                if source.get('supplier')!=manufacturers.get(product_id): errors.append(f'{here}: provenance supplier mismatch')
                if source.get('status') not in STATUSES: errors.append(f'{here}: unsupported provenance status')
                parsed=urlparse(source.get('sourceUrl',''))
                if parsed.scheme not in {'http','https'} or not parsed.hostname: errors.append(f'{here}: invalid provenance URL')
                if not isinstance(source.get('extractedAt'),str) or not source['extractedAt']: errors.append(f'{here}: missing extraction timestamp')
        for group,root in (('sourceMedia','images/catalog'),('sourceDocuments','documents/catalog')):
            refs=facts.get(group)
            if not isinstance(refs,list): errors.append(f'{here}.{group} must be an array'); continue
            for source in refs:
                local=source.get('localPath','').lstrip('/')
                if source.get('status') not in STATUSES: errors.append(f'{here}.{group}: invalid status')
                if local and (not local.startswith(root) or not (PUBLIC/local).is_file()): errors.append(f'{here}.{group}: missing or invalid local path {local}')
        status=editorial.get('status')
        if status not in {'draft','incomplete'}: errors.append(f'{here}.editorial: invalid status'); continue
        if status=='draft':
            drafts+=1; summary=editorial.get('summary') or ''; words=len(summary.split()); features=editorial.get('keyFeatures')
            if not 50<=words<=120: errors.append(f'{here}.editorial.summary: {words} words, expected 50-120')
            if '�' in summary: errors.append(f'{here}.editorial.summary contains replacement characters')
            if not isinstance(features,list) or not 3<=len(features)<=7: errors.append(f'{here}.editorial.keyFeatures must contain 3-7 entries')
            for key in ('bestFor','configurationNotes','seoTitle','metaDescription'):
                if not isinstance(editorial.get(key),str) or not editorial[key].strip(): errors.append(f'{here}.editorial.{key}: required for a draft')
        elif editorial.get('summary') is not None: errors.append(f'{here}.editorial: incomplete records may not contain generated summaries')
    seen=set()
    for index,link in enumerate(links):
        key=(link.get('supplier'),link.get('url'),link.get('sourcePageUrl'))
        if key in seen: errors.append(f'source-link-status[{index}]: duplicate reference')
        seen.add(key)
        if link.get('status') not in STATUSES: errors.append(f'source-link-status[{index}]: invalid status')
        parsed=urlparse(link.get('url',''))
        if parsed.scheme not in {'http','https'} or not parsed.hostname: errors.append(f'source-link-status[{index}]: invalid URL')
    print(f'Enrichment records: {len(records)}'); print(f'Records with normalized facts: {normalized}'); print(f'Editorial drafts: {drafts}'); print(f'Editorial incomplete: {len(records)-drafts}'); print(f'Records with media provenance: {media}'); print(f'Records with document provenance: {documents}'); print(f'Source links by status: {dict(Counter(x.get("status") for x in links))}')
    if errors:
        print(f'Enrichment integrity: FAILED ({len(errors)} error(s))',file=sys.stderr)
        for error in errors: print(f'ERROR: {error}',file=sys.stderr)
        return 1
    print('Enrichment integrity: OK'); return 0
if __name__=='__main__': raise SystemExit(main())