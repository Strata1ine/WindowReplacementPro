#!/usr/bin/env python3
"""WindowReplacement.pro authorized supplier ingestion crawler.

Crawls supplier websites, saves HTML snapshots, downloads images/PDFs, extracts
basic product metadata, and writes deterministic manifests consumed by Astro.
Uses only the Python standard library so it can run without pip installs.
"""
from __future__ import annotations

import argparse, hashlib, html, json, mimetypes, os, re, sys, time
from collections import deque
from dataclasses import dataclass, asdict
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse, urldefrag
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "scripts" / "ingest" / "suppliers.json"
SOURCE_ROOT = ROOT / "source-media"
PUBLIC_IMG = ROOT / "public" / "images" / "catalog"
PUBLIC_DOC = ROOT / "public" / "documents" / "catalog"
MANIFEST_ROOT = SOURCE_ROOT / "manifests"
CATALOG_OUT = ROOT / "src" / "data" / "catalog" / "discovered-products.json"
UA = "WindowReplacementProAuthorizedMediaIngest/1.0 (+https://windowreplacement.pro/)"
MEDIA_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".svg"}
DOC_EXTS = {".pdf"}
SKIP_EXTS = {".zip", ".mp4", ".mov", ".mp3", ".woff", ".woff2", ".ttf", ".css", ".js"}


def slugify(value: str) -> str:
    value = html.unescape(value).lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")[:100] or "item"


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(value or "")).strip()


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links: list[str] = []
        self.media: list[tuple[str, str]] = []
        self.title = ""
        self.description = ""
        self.h1 = ""
        self.jsonld: list[str] = []
        self._capture: str | None = None
        self._buf: list[str] = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "a" and a.get("href"):
            self.links.append(a["href"])
        if tag in {"img", "source"}:
            for key in ("src", "data-src", "data-lazy-src"):
                if a.get(key): self.media.append((a[key], "image"))
            for key in ("srcset", "data-srcset"):
                if a.get(key):
                    for part in a[key].split(","):
                        u = part.strip().split(" ")[0]
                        if u: self.media.append((u, "image"))
        if tag == "meta":
            key = (a.get("property") or a.get("name") or "").lower()
            if key in {"description", "og:description"} and not self.description:
                self.description = a.get("content", "")
            if key == "og:image" and a.get("content"):
                self.media.append((a["content"], "image"))
        if tag == "link" and a.get("href"):
            rel = " ".join(a.get("rel", "").split()).lower()
            typ = a.get("type", "").lower()
            if "image" in typ or "icon" in rel:
                self.media.append((a["href"], "image"))
        if tag == "title": self._capture, self._buf = "title", []
        elif tag == "h1" and not self.h1: self._capture, self._buf = "h1", []
        elif tag == "script" and a.get("type", "").lower() == "application/ld+json":
            self._capture, self._buf = "jsonld", []

    def handle_endtag(self, tag):
        if self._capture == "title" and tag == "title":
            self.title = clean_text("".join(self._buf)); self._capture = None
        elif self._capture == "h1" and tag == "h1":
            self.h1 = clean_text("".join(self._buf)); self._capture = None
        elif self._capture == "jsonld" and tag == "script":
            self.jsonld.append("".join(self._buf)); self._capture = None

    def handle_data(self, data):
        if self._capture: self._buf.append(data)


@dataclass
class Asset:
    source_url: str
    local_path: str
    kind: str
    sha256: str
    bytes: int
    page_url: str

@dataclass
class Page:
    url: str
    title: str
    h1: str
    description: str
    snapshot: str
    is_product_candidate: bool
    assets: list[str]


def fetch(url: str, timeout=30) -> tuple[bytes, str]:
    req = Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/pdf,image/avif,image/webp,image/*,*/*;q=0.8"})
    with urlopen(req, timeout=timeout) as r:
        return r.read(), r.headers.get("Content-Type", "").split(";")[0].lower()


def normalize(url: str, base: str) -> str | None:
    u = urldefrag(urljoin(base, url))[0]
    p = urlparse(u)
    if p.scheme not in {"http", "https"}: return None
    return u


def ext_for(url: str, ctype: str) -> str:
    ext = Path(urlparse(url).path).suffix.lower()
    if ext: return ext
    return mimetypes.guess_extension(ctype) or ""


def same_allowed(url: str, domains: set[str]) -> bool:
    return (urlparse(url).hostname or "").lower() in domains


def is_product_candidate(url: str, title: str, h1: str, hints: list[str]) -> bool:
    hay = f"{url} {title} {h1}".lower()
    return any(h.lower() in hay for h in hints) and bool(h1 or title)


def safe_filename(url: str, fallback: str, ext: str) -> str:
    stem = Path(urlparse(url).path).stem or fallback
    stem = slugify(stem)
    digest = hashlib.sha1(url.encode()).hexdigest()[:8]
    return f"{stem}-{digest}{ext}"


def save_asset(supplier: str, url: str, page_url: str, kind: str, timeout: int) -> Asset | None:
    try:
        body, ctype = fetch(url, timeout)
    except Exception as e:
        print(f"  ! asset {url}: {e}", file=sys.stderr); return None
    ext = ext_for(url, ctype)
    if kind == "image" and ext not in MEDIA_EXTS:
        if ctype.startswith("image/"): ext = mimetypes.guess_extension(ctype) or ".img"
        else: return None
    if kind == "document" and ext != ".pdf" and ctype != "application/pdf": return None
    if kind == "document": ext = ".pdf"
    target_root = PUBLIC_IMG / supplier if kind == "image" else PUBLIC_DOC / supplier
    target_root.mkdir(parents=True, exist_ok=True)
    name = safe_filename(url, kind, ext)
    path = target_root / name
    path.write_bytes(body)
    rel = "/" + path.relative_to(ROOT / "public").as_posix()
    return Asset(url, rel, kind, hashlib.sha256(body).hexdigest(), len(body), page_url)


def crawl_supplier(cfg: dict, max_pages: int, delay: float, timeout: int, download: bool) -> dict:
    slug = cfg["slug"]; domains = {d.lower() for d in cfg["allowed_domains"]}
    snap_root = SOURCE_ROOT / slug / "html"; snap_root.mkdir(parents=True, exist_ok=True)
    q = deque(cfg["start_urls"]); seen: set[str] = set(); pages: list[Page] = []; assets: dict[str, Asset] = {}
    errors: list[dict] = []
    print(f"\n== {cfg['name']} ==")
    while q and len(seen) < max_pages:
        url = q.popleft()
        if url in seen or not same_allowed(url, domains): continue
        ext = Path(urlparse(url).path).suffix.lower()
        if ext in SKIP_EXTS: continue
        seen.add(url)
        try:
            body, ctype = fetch(url, timeout)
        except Exception as e:
            errors.append({"url": url, "error": str(e)}); print(f"! {url}: {e}", file=sys.stderr); continue
        if ctype == "application/pdf" or ext == ".pdf":
            if download:
                a = save_asset(slug, url, url, "document", timeout)
                if a: assets[url] = a
            continue
        if "html" not in ctype and not body.lstrip().startswith(b"<"):
            continue
        text = body.decode("utf-8", "replace")
        parser = PageParser(); parser.feed(text)
        snap_name = f"{len(pages)+1:04d}-{slugify(parser.h1 or parser.title or url)}.html"
        snap = snap_root / snap_name; snap.write_text(text, encoding="utf-8")
        page_assets: list[str] = []
        discovered_media = list(parser.media)
        # Anchor-linked PDFs are documents, other links remain crawl targets.
        for href in parser.links:
            nu = normalize(href, url)
            if not nu: continue
            ne = Path(urlparse(nu).path).suffix.lower()
            if ne == ".pdf": discovered_media.append((nu, "document"))
            elif same_allowed(nu, domains) and ne not in SKIP_EXTS and nu not in seen:
                q.append(nu)
        if download:
            for raw, kind in discovered_media:
                nu = normalize(raw, url)
                if not nu or nu in assets: continue
                if kind == "image" or Path(urlparse(nu).path).suffix.lower() == ".pdf":
                    actual_kind = "document" if Path(urlparse(nu).path).suffix.lower() == ".pdf" else "image"
                    a = save_asset(slug, nu, url, actual_kind, timeout)
                    if a: assets[nu] = a; page_assets.append(a.local_path)
        pages.append(Page(url, parser.title, parser.h1, parser.description, str(snap.relative_to(ROOT)), is_product_candidate(url, parser.title, parser.h1, cfg["product_hints"]), page_assets))
        print(f"{len(pages):4d} {url}")
        if delay: time.sleep(delay)

    product_records = []
    for p in pages:
        if not p.is_product_candidate: continue
        name = clean_text(p.h1 or p.title.split("|")[0])
        if not name: continue
        product_records.append({
            "id": f"{slug}:{slugify(name)}",
            "manufacturer": slug,
            "slug": slugify(name),
            "name": name,
            "category": cfg["categories"][0],
            "collection": None,
            "modelNumber": None,
            "summary": p.description or None,
            "sourceUrl": p.url,
            "sourceType": "live-crawl",
            "media": p.assets,
            "documents": [x for x in p.assets if x.endswith(".pdf")],
            "specifications": {},
            "lastVerified": time.strftime("%Y-%m-%d")
        })
    return {
        "supplier": {k: cfg[k] for k in ("slug", "name", "base_url", "categories")},
        "crawledAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "pages": [asdict(p) for p in pages],
        "assets": [asdict(a) for a in assets.values()],
        "products": product_records,
        "errors": errors,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--supplier", action="append", help="Supplier slug; repeatable. Defaults to all.")
    ap.add_argument("--max-pages", type=int, default=250)
    ap.add_argument("--delay", type=float, default=0.15)
    ap.add_argument("--timeout", type=int, default=30)
    ap.add_argument("--no-download", action="store_true", help="Discover only; do not save images/PDFs")
    args = ap.parse_args()
    configs = json.loads(CONFIG.read_text())
    if args.supplier:
        wanted = set(args.supplier); configs = [c for c in configs if c["slug"] in wanted]
    MANIFEST_ROOT.mkdir(parents=True, exist_ok=True)
    all_products = []
    for cfg in configs:
        result = crawl_supplier(cfg, args.max_pages, args.delay, args.timeout, not args.no_download)
        out = MANIFEST_ROOT / f"{cfg['slug']}.json"; out.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
        all_products.extend(result["products"])
    CATALOG_OUT.parent.mkdir(parents=True, exist_ok=True)
    CATALOG_OUT.write_text(json.dumps(all_products, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nWrote {len(all_products)} discovered product records to {CATALOG_OUT.relative_to(ROOT)}")

if __name__ == "__main__": main()
