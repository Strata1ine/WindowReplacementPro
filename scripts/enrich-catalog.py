#!/usr/bin/env python3
"""Build a source-backed enrichment overlay without changing raw supplier JSON."""
from __future__ import annotations
import json, re
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "src" / "data" / "catalog"
MANIFESTS = ROOT / "source-media" / "manifests"
GENERATED_AT = "2026-08-19T23:30:00Z"
CATEGORY_NAMES = {"windows":"window","entry-doors":"entry door","patio-doors":"patio door","door-glass":"door glass design"}
FACT_LABELS = {"operatingStyle":"Operating style","productType":"Product type","material":"Material","frameDepth":"Frame depth","glazing":"Glazing","glassConfiguration":"Glass configuration","panelDesign":"Panel design","privacyLevel":"Privacy level","availableWidthsInches":"Available widths","availableSizes":"Available sizes","colours":"Colours/finishes","hardware":"Hardware","screen":"Screen","performance":"Performance","energyStar":"ENERGY STAR information","warranty":"Warranty","style":"Style","type":"Type","designName":"Design name"}

def read_json(path: Path) -> Any: return json.loads(path.read_text(encoding="utf-8"))
def write_json(path: Path, value: Any) -> None: path.write_text(json.dumps(value,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
def meaningful(value: Any) -> bool: return value not in (None,"",[],{})

def merge_catalog():
    curated=read_json(CATALOG/"curated-products.json"); by_id={x["id"]:dict(x) for x in curated}; curated_ids=set(by_id)
    for path in sorted((CATALOG/"discovered").glob("*.json")):
        for incoming in read_json(path):
            existing=by_id.get(incoming["id"])
            if not existing: by_id[incoming["id"]]=dict(incoming); continue
            merged=dict(existing)
            for key,value in incoming.items():
                if key in ("media","documents"): merged[key]=sorted(set(existing.get(key,[]))|set(value or []))
                elif key=="specifications": merged[key]={**existing.get(key,{}),**(value or {})}
                elif meaningful(value): merged[key]=value
            by_id[incoming["id"]]=merged
    return sorted(by_id.values(),key=lambda x:x["id"]),curated_ids

def load_evidence():
    assets={}; supplier_names={}; links=[]
    for path in sorted(MANIFESTS.glob("*.json")):
        if path.name=="verified-source-inventory.json": continue
        manifest=read_json(path); supplier=manifest["supplier"]["slug"]; supplier_names[supplier]=manifest["supplier"]["name"]
        for asset in manifest.get("assets",[]): assets[asset["local_path"]]=asset
        for error in manifest.get("errors",[]):
            message=error.get("error",""); status="stale" if "404" in message else "blocked" if "401" in message or "403" in message else "unavailable"
            links.append({"supplier":supplier,"url":error["url"],"sourcePageUrl":error.get("page"),"status":status,"checkedAt":manifest["crawledAt"],"detail":message})
    unique={(x["supplier"],x["url"],x.get("sourcePageUrl")):x for x in links}
    return assets,supplier_names,sorted(unique.values(),key=lambda x:(x["supplier"],x["url"],x.get("sourcePageUrl") or ""))

def reference(product,status="active",**extra):
    result={"supplier":product["manufacturer"],"sourceUrl":product["sourceUrl"],"extractedAt":f'{product["lastVerified"]}T00:00:00Z',"status":status}
    result.update({k:v for k,v in extra.items() if v}); return result

def fact(value,source): return {"value":value,"sources":[source]}

def find_explicit_facts(product):
    source=reference(product); normalized={k:fact(v,source) for k,v in sorted(product.get("specifications",{}).items()) if meaningful(v)}
    name=product["name"]; product_type=product.get("type"); description=product.get("sourceDescription") or ""
    evidence=" ".join(filter(None,[name,product_type or "",description if "�" not in description else ""])); lower=evidence.lower()
    if product["category"]=="windows":
        for style in ("awning","casement","double slider","single slider","end vent slider","double hung","single hung","picture window","fixed casement","bay","bow"):
            if re.search(rf"\b{re.escape(style)}\b",lower): normalized.setdefault("operatingStyle",fact(style.title(),source)); break
    elif product_type: normalized.setdefault("productType",fact(product_type,source))
    for pattern,value in ((r"\bfibreglass\b|\bfiberglass\b","Fiberglass"),(r"\bvinyl\b|\bpvc\b","Vinyl"),(r"\bsteel\b","Steel"),(r"\bmahogany\b","Mahogany"),(r"\bfir\b","Fir"),(r"\bwood\b","Wood"),(r"\baluminum\b|\baluminium\b","Aluminum")):
        if "material" not in normalized and re.search(pattern,lower): normalized["material"]=fact(value,source); break
    if product["category"]=="door-glass": normalized.setdefault("designName",fact(name,source))
    if product["category"] in ("entry-doors","patio-doors"):
        for pattern,value in ((r"\bfull[- ]lite\b","Full lite"),(r"\b3/4[- ]lite\b|\bthree[- ]quarter[- ]lite\b","3/4 lite"),(r"\b1/2[- ]lite\b|\bhalf[- ]lite\b","1/2 lite"),(r"\b1/4[- ]lite\b|\bquarter[- ]lite\b","1/4 lite"),(r"\bno glass\b","No glass")):
            if re.search(pattern,lower): normalized.setdefault("glassConfiguration",fact(value,source)); break
    panel=re.search(r"\b(\d+)[- ]panel\b",lower)
    if panel and product["category"]=="entry-doors": normalized.setdefault("panelDesign",fact(f'{panel.group(1)} panel',source))
    colour=re.search(r"\bover\s+(\d+)\s+custom\s+colou?rs\b",lower)
    if colour: normalized.setdefault("colours",fact(f'Over {colour.group(1)} custom colours',source))
    if "energy star" in lower: normalized.setdefault("energyStar",fact("ENERGY STAR information published by supplier",source))
    return normalized

def asset_references(product,paths,assets):
    refs=[]
    for local in paths:
        asset=assets.get(local)
        if not asset: refs.append(reference(product,"unavailable",localPath=local)); continue
        original=asset["original_asset_url"]; final=asset.get("final_asset_url") or original; status="redirected" if final!=original else "active"
        refs.append(reference(product,status,sourceUrl=final,sourceDocument=original if asset.get("asset_type")=="document" else None,localPath=local,extractedAt=asset.get("discovered_at")))
    return refs

def value_text(value): return ", ".join(value) if isinstance(value,list) else str(value)

def build_editorial(product,normalized,supplier_name):
    domain=[(k,x["value"]) for k,x in normalized.items() if k not in ("productType","designName")]
    features=[]
    if product.get("modelNumber"): features.append(f'Manufacturer model: {product["modelNumber"]}')
    if product.get("collection"): features.append(f'Collection: {product["collection"]}')
    for key,item in normalized.items():
        label=FACT_LABELS.get(key,re.sub(r"([A-Z])",r" \1",key).strip().title()); entry=f"{label}: {value_text(item['value'])}"
        if entry not in features: features.append(entry)
    features=features[:7]; enough=len(domain)>=1 and (len(normalized)>=2 or bool(product.get("modelNumber")) or bool(product.get("collection"))) and len(features)>=3
    if not enough: return {"status":"incomplete","summary":None,"bestFor":None,"keyFeatures":features,"considerations":["Supplier evidence is not yet detailed enough for independent editorial copy."],"configurationNotes":None,"seoTitle":None,"metaDescription":None,"generatedAt":GENERATED_AT}
    category=CATEGORY_NAMES[product["category"]]; article="an" if category[0].lower() in "aeiou" else "a"; identity=f'{product["name"]} is {article} {category} from {supplier_name}'
    if product.get("modelNumber"): identity+=f', identified by manufacturer model {product["modelNumber"]}'
    identity+="."; detail=" The saved supplier evidence documents "+"; ".join(f"{FACT_LABELS.get(k,k)}: {value_text(v)}" for k,v in domain[:3])+"."
    caution=" Available sizes, finishes, glazing, hardware, performance ratings and installation requirements vary by product; any option not listed in the supported facts should be confirmed with the manufacturer or installer before ordering."
    summary=identity+detail+caution
    best={"windows":f'Replacement projects seeking the documented {value_text(normalized.get("operatingStyle",{"value":"window"})["value"])} configuration.',"entry-doors":"Entry-door replacements where the documented model and configuration match the opening and design plan.","door-glass":f'Entry-door projects considering the {product["name"]} decorative glass design.',"patio-doors":"Patio-door replacements where the documented product line and options suit the opening."}[product["category"]]
    meta=f'Review supported specifications and source material for the {product["name"]} {category} from {supplier_name}. Confirm current options before ordering.'
    return {"status":"draft","summary":summary,"bestFor":best,"keyFeatures":features,"considerations":["Confirm current option combinations, availability and performance values before ordering."],"configurationNotes":"Only configurations explicitly listed in the supported facts are represented in this draft.","seoTitle":f'{product["name"]} {category.title()} | {supplier_name}'[:100],"metaDescription":meta[:170],"generatedAt":GENERATED_AT}

def normalized_identity(value): return re.sub(r"[^a-z0-9]","",(value or "").lower())
def review_new(products,curated_ids,enrichment):
    curated=[x for x in products if x["id"] in curated_ids]; review=[]
    for item in products:
        if item["id"] in curated_ids: continue
        possible=[]
        for candidate in curated:
            if candidate["manufacturer"]!=item["manufacturer"] or candidate["category"]!=item["category"]: continue
            model=bool(item.get("modelNumber") and candidate.get("modelNumber") and normalized_identity(item["modelNumber"])==normalized_identity(candidate["modelNumber"])); score=SequenceMatcher(None,normalized_identity(item["name"]),normalized_identity(candidate["name"])).ratio()
            if model or score>=.88: possible.append({"productId":candidate["id"],"nameSimilarity":round(score,3),"modelMatch":model})
        editorial=enrichment[item["id"]]["editorial"]
        review.append({"productId":item["id"],"decision":"retained-distinct","reason":"No curated record has the same normalized manufacturer model or product name.","manufacturer":item["manufacturer"],"category":item["category"],"modelNumber":item.get("modelNumber"),"sourceUrl":item["sourceUrl"],"possibleAliasesReviewed":possible,"enriched":bool(enrichment[item["id"]]["sourceFacts"]["normalized"]),"editorialStatus":editorial["status"]})
    return review

def main():
    products,curated_ids=merge_catalog(); assets,supplier_names,links=load_evidence(); records=[]; by_id={}
    for product in products:
        source=reference(product); normalized=find_explicit_facts(product)
        source_facts={"manufacturer":fact(product["manufacturer"],source),"sourceUrl":fact(product["sourceUrl"],source),"sourceDescription":product.get("sourceDescription"),"modelNumber":fact(product["modelNumber"],source) if product.get("modelNumber") else None,"collection":fact(product["collection"],source) if product.get("collection") else None,"normalized":normalized,"sourceDocuments":asset_references(product,product.get("documents",[]),assets),"sourceMedia":asset_references(product,product.get("media",[]),assets)}
        record={"productId":product["id"],"sourceFacts":source_facts,"editorial":build_editorial(product,normalized,supplier_names.get(product["manufacturer"],product["manufacturer"]))}; records.append(record); by_id[product["id"]]=record
    review=review_new(products,curated_ids,by_id); write_json(CATALOG/"enrichment-records.json",records); write_json(CATALOG/"new-record-review.json",review); write_json(CATALOG/"source-link-status.json",links)
    suppliers={}
    for supplier in sorted({x["manufacturer"] for x in products}):
        subset=[by_id[x["id"]] for x in products if x["manufacturer"]==supplier]
        suppliers[supplier]={"records":len(subset),"normalized":sum(bool(x["sourceFacts"]["normalized"]) for x in subset),"editorialDrafts":sum(x["editorial"]["status"]=="draft" for x in subset),"editorialIncomplete":sum(x["editorial"]["status"]=="incomplete" for x in subset),"media":sum(bool(x["sourceFacts"]["sourceMedia"]) for x in subset),"documents":sum(bool(x["sourceFacts"]["sourceDocuments"]) for x in subset)}
    report={"generatedAt":GENERATED_AT,"records":len(records),"normalizedRecords":sum(bool(x["sourceFacts"]["normalized"]) for x in records),"editorialDrafts":sum(x["editorial"]["status"]=="draft" for x in records),"editorialIncomplete":sum(x["editorial"]["status"]=="incomplete" for x in records),"newRecords":len(review),"newRetainedDistinct":Counter(x["decision"] for x in review)["retained-distinct"],"newEditorialDrafts":sum(x["editorialStatus"]=="draft" for x in review),"staleOrBlockedLinks":dict(Counter(x["status"] for x in links)),"suppliers":suppliers}
    write_json(CATALOG/"enrichment-report.json",report); print(json.dumps(report,indent=2))
if __name__=="__main__": main()