"""Generate the WindowReplacement.pro customer taxonomy and editorial overlays."""

from editorial_taxonomy import build_all


if __name__ == "__main__":
    result = build_all(write=True)
    records = result["products"]["records"]
    canonical = sum(item["recordClass"] == "canonical-product" for item in records)
    live_canonical = sum(item["liveCanonical"] for item in records)
    historical_canonical = sum(item["historicalCanonical"] for item in records)
    variants = sum(item["recordClass"] == "variant-configuration" for item in records)
    source_only = sum(item["recordClass"] == "source-only" for item in records)
    published = sum(item["editorialState"] == "published" for item in records)
    print(f"Editorial taxonomy records: {len(records)}")
    print(f"Live canonical supplier identities: {live_canonical}")
    print(f"Historical canonical products retained: {historical_canonical}")
    print(f"Customer-facing canonical records: {canonical}")
    print(f"Variant/configuration records: {variants}")
    print(f"Source-only records: {source_only}")
    print(f"Published records preserved: {published}")
