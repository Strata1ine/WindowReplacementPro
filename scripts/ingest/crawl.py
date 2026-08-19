#!/usr/bin/env python3
"""Authorized, resumable supplier ingestion for WindowReplacement.pro.

Each supplier writes an independent discovered catalogue. Product output is
validated and atomically replaces the last-known-good file only after a viable
crawl. The crawler intentionally favors false negatives over generic pages.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import mimetypes
import os
import re
import socket
import sys
import tempfile
import time
from collections import deque
from dataclasses import asdict, dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urldefrag, urljoin, urlparse, urlunparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / 'scripts' / 'ingest' / 'suppliers.json'
SOURCE_ROOT = ROOT / 'source-media'
PUBLIC_IMG = ROOT / 'public' / 'images' / 'catalog'
PUBLIC_DOC = ROOT / 'public' / 'documents' / 'catalog'
MANIFEST_ROOT = SOURCE_ROOT / 'manifests'
CATALOG_DIR = ROOT / 'src' / 'data' / 'catalog' / 'discovered'
UA = 'WindowReplacementProAuthorizedMediaIngest/2.0 (+https://windowreplacement.pro/)'
MEDIA_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg'}
SKIP_EXTS = {'.zip', '.mp4', '.mov', '.mp3', '.woff', '.woff2', '.ttf', '.css', '.js'}
TRACKING_PARAMS = {'fbclid', 'gclid', 'mc_cid', 'mc_eid'}
GENERIC_SEGMENTS = {'', 'home', 'products', 'product', 'catalog', 'catalogs', 'collections', 'collection', 'category', 'categories', 'exterior', 'doors', 'windows', 'resources', 'brochures'}
DETAIL_TERMS = {'specification', 'dimensions', 'model', 'glass options', 'hardware', 'warranty', 'energy rating', 'sizes available'}


def slugify(value: str) -> str:
    value = html.unescape(value).lower().strip()
    value = re.sub(r'[^a-z0-9]+', '-', value)
    return value.strip('-')[:100] or 'item'


def clean_text(value: str | None) -> str:
    return re.sub(r'\s+', ' ', html.unescape(value or '')).strip()


def normalize(url: str, base: str) -> str | None:
    joined = urldefrag(urljoin(base, url))[0]
    parsed = urlparse(joined)
    if parsed.scheme.lower() not in {'http', 'https'} or not parsed.hostname:
        return None
    hostname = parsed.hostname.lower()
    port = parsed.port
    netloc = hostname if not port or (parsed.scheme == 'http' and port == 80) or (parsed.scheme == 'https' and port == 443) else f'{hostname}:{port}'
    query = urlencode(sorted((key, value) for key, value in parse_qsl(parsed.query, keep_blank_values=True) if not key.lower().startswith('utm_') and key.lower() not in TRACKING_PARAMS))
    path = re.sub(r'/{2,}', '/', parsed.path or '/')
    return urlunparse((parsed.scheme.lower(), netloc, path, '', query, ''))


def same_allowed(url: str, domains: set[str]) -> bool:
    return (urlparse(url).hostname or '').lower() in domains


class SafeRedirectHandler(HTTPRedirectHandler):
    def __init__(self, allowed_domains: set[str]):
        self.allowed_domains = allowed_domains

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not same_allowed(newurl, self.allowed_domains):
            raise URLError(f'redirect outside allowed domains: {newurl}')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


@dataclass
class FetchResponse:
    body: bytes
    content_type: str
    charset: str | None
    final_url: str


def content_type_allowed(content_type: str, kind: str) -> bool:
    if kind == 'page': return content_type in {'text/html', 'application/xhtml+xml', 'application/pdf', ''}
    if kind == 'image': return content_type.startswith('image/')
    if kind == 'document': return content_type == 'application/pdf'
    return False


def fetch(url: str, allowed_domains: set[str], timeout: int, max_bytes: int, kind: str, retries: int) -> FetchResponse:
    if not same_allowed(url, allowed_domains):
        raise URLError(f'URL outside allowed domains: {url}')
    opener = build_opener(SafeRedirectHandler(allowed_domains))
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            request = Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/pdf,image/avif,image/webp,image/*,*/*;q=0.5'})
            with opener.open(request, timeout=timeout) as response:
                final_url = response.geturl()
                if not same_allowed(final_url, allowed_domains):
                    raise URLError(f'final URL outside allowed domains: {final_url}')
                content_type = response.headers.get_content_type().lower()
                if not content_type_allowed(content_type, kind):
                    raise ValueError(f'disallowed {kind} content type: {content_type or "missing"}')
                declared_length = response.headers.get('Content-Length')
                if declared_length and int(declared_length) > max_bytes:
                    raise ValueError(f'response exceeds {max_bytes} bytes')
                body = response.read(max_bytes + 1)
                if len(body) > max_bytes:
                    raise ValueError(f'response exceeds {max_bytes} bytes')
                return FetchResponse(body, content_type, response.headers.get_content_charset(), final_url)
        except (HTTPError, URLError, TimeoutError, socket.timeout, OSError, ValueError) as error:
            last_error = error
            retryable = not isinstance(error, HTTPError) or error.code == 429 or error.code >= 500
            if attempt >= retries or not retryable: break
            time.sleep(0.5 * (2 ** attempt))
    raise last_error or RuntimeError(f'failed to fetch {url}')


def decode_html(body: bytes, header_charset: str | None) -> str:
    candidates: list[str] = []
    if header_charset: candidates.append(header_charset)
    head = body[:4096].decode('ascii', 'ignore')
    match = re.search(r'<meta[^>]+charset=["\']?\s*([a-zA-Z0-9._-]+)', head, re.I)
    if match: candidates.append(match.group(1))
    match = re.search(r'<meta[^>]+content=["\'][^"\']*charset=([a-zA-Z0-9._-]+)', head, re.I)
    if match: candidates.append(match.group(1))
    candidates.extend(['utf-8', 'windows-1252'])
    for encoding in dict.fromkeys(candidates):
        try: return body.decode(encoding)
        except (LookupError, UnicodeDecodeError): continue
    return body.decode('utf-8', 'replace')


class PageParser(HTMLParser):
    def __init__(self, asset_role_rules: list[dict] | None = None):
        super().__init__(convert_charrefs=True)
        self.asset_role_rules = asset_role_rules or []
        self.links: list[str] = []
        self.media: list[tuple[str, str, str]] = []
        self.title = ''
        self.description = ''
        self.h1 = ''
        self.canonical = ''
        self.jsonld: list[str] = []
        self.visible_text: list[str] = []
        self.embedded_descriptions: list[str] = []
        self.embedded_json_attributes: list[str] = []
        self._capture: str | None = None
        self._buffer: list[str] = []
        self._ignored_depth = 0

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if attributes.get('data-description'): self.embedded_descriptions.append(attributes['data-description'])
        if attributes.get('data-json'): self.embedded_json_attributes.append(attributes['data-json'])
        if tag in {'script', 'style', 'noscript'}: self._ignored_depth += 1
        if tag == 'a' and attributes.get('href'): self.links.append(attributes['href'])
        if tag in {'img', 'source'}:
            descriptor = ' '.join(str(attributes.get(key, '')) for key in ('class', 'id', 'alt')).lower()
            direct = next((attributes[key] for key in ('src', 'data-src', 'data-lazy-src') if attributes.get(key)), None)
            configured_role = next((rule.get('role') for rule in self.asset_role_rules if any(re.search(pattern, f'{descriptor} {direct or ""}', re.I) for pattern in rule.get('patterns', []))), None)
            role = configured_role or ('technical' if any(word in descriptor for word in ('drawing', 'diagram', 'technical', 'dimension')) else 'hero' if any(word in descriptor for word in ('hero', 'main-image', 'featured', 'primary')) else 'gallery' if any(word in descriptor for word in ('gallery', 'product', 'slide')) else 'generic')
            if direct:
                self.media.append((direct, 'image', role))
            else:
                srcset = next((attributes[key] for key in ('srcset', 'data-srcset') if attributes.get(key)), '')
                candidates = [part.strip().split(' ')[0] for part in srcset.split(',') if part.strip()]
                if candidates: self.media.append((candidates[-1], 'image', role))
        if tag == 'meta':
            key = (attributes.get('property') or attributes.get('name') or '').lower()
            if key in {'description', 'og:description'} and not self.description: self.description = attributes.get('content', '')
        if tag == 'link' and attributes.get('href'):
            rel = str(attributes.get('rel', '')).lower()
            if 'canonical' in rel: self.canonical = attributes['href']
        if tag == 'title': self._capture, self._buffer = 'title', []
        elif tag == 'h1' and not self.h1: self._capture, self._buffer = 'h1', []
        elif tag == 'script' and str(attributes.get('type', '')).lower() == 'application/ld+json': self._capture, self._buffer = 'jsonld', []

    def handle_endtag(self, tag):
        if self._capture == 'title' and tag == 'title': self.title, self._capture = clean_text(''.join(self._buffer)), None
        elif self._capture == 'h1' and tag == 'h1': self.h1, self._capture = clean_text(''.join(self._buffer)), None
        elif self._capture == 'jsonld' and tag == 'script': self.jsonld.append(''.join(self._buffer)); self._capture = None
        if tag in {'script', 'style', 'noscript'} and self._ignored_depth: self._ignored_depth -= 1

    def handle_data(self, data):
        if self._capture: self._buffer.append(data)
        elif not self._ignored_depth and data.strip(): self.visible_text.append(data)


def product_nodes(jsonld_blocks: Iterable[str]) -> list[dict]:
    nodes: list[dict] = []
    def visit(value):
        if isinstance(value, list):
            for item in value: visit(item)
        elif isinstance(value, dict):
            node_type = value.get('@type')
            types = node_type if isinstance(node_type, list) else [node_type]
            if any(str(item).lower() == 'product' for item in types): nodes.append(value)
            for key, item in value.items():
                if key not in {'itemListElement', 'offers'}: visit(item)
    for block in jsonld_blocks:
        try: visit(json.loads(block))
        except json.JSONDecodeError: continue
    return nodes


def jsonld_product_data(node: dict | None) -> dict:
    if not node: return {}
    images = node.get('image', [])
    if isinstance(images, str): images = [images]
    elif isinstance(images, dict): images = [images.get('url')]
    properties = {}
    additional = node.get('additionalProperty', [])
    if isinstance(additional, dict): additional = [additional]
    for item in additional if isinstance(additional, list) else []:
        if isinstance(item, dict) and item.get('name') and item.get('value') is not None:
            properties[clean_text(str(item['name']))] = clean_text(str(item['value']))
    return {
        'name': clean_text(str(node.get('name', ''))),
        'description': clean_text(str(node.get('description', ''))),
        'modelNumber': clean_text(str(node.get('model') or node.get('sku') or node.get('mpn') or '')) or None,
        'images': [value for value in images if isinstance(value, str)],
        'category': clean_text(str(node.get('category', ''))),
        'specifications': properties,
    }


def is_generic_page(url: str) -> bool:
    path = urlparse(url).path.strip('/').lower()
    if not path: return True
    segments = [segment for segment in path.split('/') if segment]
    if not segments: return True
    if any(segment in {'product-tag', 'category', 'categories', 'collections'} for segment in segments): return True
    return segments[-1].split('.')[0] in GENERIC_SEGMENTS


def is_product_candidate(url: str, parser: PageParser, hints: list[str], product_data: dict, path_rules: list[str] | None = None) -> bool:
    has_single_product_schema = bool(product_data)
    if path_rules is not None:
        return any(re.fullmatch(rule, urlparse(url).path, re.I) for rule in path_rules) and bool(parser.h1 or parser.title)
    if is_generic_page(url) and not has_single_product_schema: return False
    haystack = clean_text(f'{url} {parser.title} {parser.h1} {" ".join(parser.visible_text)}').lower()
    detail_score = sum(term in haystack for term in DETAIL_TERMS)
    model_signal = bool(product_data.get('modelNumber')) or bool(re.search(r'\b(?:model|series|sku|item)\s*[:#-]?\s*[a-z0-9][a-z0-9.-]{2,}\b', haystack, re.I))
    path_signal = any(hint.lower() in url.lower() for hint in hints) and len([part for part in urlparse(url).path.split('/') if part]) >= 2
    score = (3 if has_single_product_schema else 0) + (2 if model_signal else 0) + (1 if detail_score >= 2 else 0) + (1 if path_signal else 0)
    return score >= 3


def query_requirements_met(url: str, cfg: dict) -> bool:
    query = {key.lower(): value.lower() for key, value in parse_qsl(urlparse(url).query, keep_blank_values=True)}
    return all(query.get(key.lower()) == str(value).lower() for key, value in cfg.get('required_product_query', {}).items())


def infer_category(url: str, parser: PageParser, cfg: dict, product_data: dict) -> str:
    haystack = clean_text(f'{url} {parser.title} {parser.h1} {product_data.get("category", "")}').lower()
    for rule in cfg.get('category_rules', []):
        if any(re.search(pattern, haystack, re.I) for pattern in rule.get('patterns', [])): return rule['category']
    semantic = [
        ('door-glass', ('doorglass', 'door glass', 'doorlite', 'decorative glass')),
        ('patio-doors', ('patio door', 'sliding door', 'stacking door')),
        ('windows', ('casement', 'awning window', 'hung window', 'slider window', 'picture window', 'window series')),
        ('entry-doors', ('entry door', 'exterior door', 'fiberglass door', 'steel door')),
    ]
    for category, terms in semantic:
        if category in cfg['categories'] and any(term in haystack for term in terms): return category
    return cfg['categories'][0] if len(cfg['categories']) == 1 else 'unclassified'


def relevant_asset(url: str, role: str) -> bool:
    descriptor = urlparse(url).path.lower()
    if any(word in descriptor for word in ('favicon', 'logo', 'sprite', 'avatar', 'tracking', 'pixel')): return False
    return role in {'hero', 'gallery', 'technical', 'document', 'embedded-product'}


def embedded_caption_products(parser: PageParser, page_path: str, cfg: dict) -> list[dict]:
    collection = cfg.get('embedded_product_collections', {}).get(page_path.rstrip('/'))
    pattern = cfg.get('embedded_product_model_pattern')
    if not collection or not pattern: return []
    products: list[dict] = []
    seen: set[str] = set()
    for raw in parser.embedded_descriptions:
        description = clean_text(re.sub(r'<[^>]+>', ' ', html.unescape(raw)))
        matches = re.findall(pattern, description, re.I)
        if not matches: continue
        model = matches[-1] if isinstance(matches[-1], str) else matches[-1][0]
        model = model.upper()
        if model in seen: continue
        seen.add(model)
        products.append({'slug': slugify(model), 'name': f'{model} {description.replace(model, "").strip()}'.strip(), 'modelNumber': model, 'collection': collection})
    return products


def embedded_json_products(parser: PageParser, page_url: str, cfg: dict) -> list[dict]:
    parsed_page = urlparse(page_url)
    if parsed_page.path.rstrip('/') not in cfg.get('embedded_json_product_paths', []): return []
    if cfg.get('embedded_json_queryless_only') and parsed_page.query: return []
    products: list[dict] = []
    for raw in parser.embedded_json_attributes:
        try: payload = json.loads(raw)
        except (TypeError, json.JSONDecodeError): continue
        records = payload.get('productResults', {}).get('products', []) if isinstance(payload, dict) else []
        for record in records:
            if not isinstance(record, dict) or not clean_text(record.get('name')): continue
            name = clean_text(record['name']); generated_slug = slugify(name)
            products.append({'slug': cfg.get('embedded_slug_aliases', {}).get(generated_slug, generated_slug), 'name': name, 'modelNumber': clean_text(record.get('sku')) or None, 'collection': None, 'image': record.get('image', {}).get('defaultSrc') if isinstance(record.get('image'), dict) else None})
    return products


def safe_filename(url: str, fallback: str, extension: str) -> str:
    stem = slugify(Path(urlparse(url).path).stem or fallback)
    digest = hashlib.sha256(url.encode('utf-8')).hexdigest()[:12]
    return f'{stem}-{digest}{extension}'


@dataclass
class Asset:
    supplier: str
    source_page_urls: list[str]
    original_asset_url: str
    final_asset_url: str
    local_path: str
    asset_type: str
    role: str
    sha256: str
    bytes: int
    discovered_at: str


@dataclass
class Page:
    url: str
    title: str
    h1: str
    description: str
    snapshot: str
    is_product_candidate: bool
    category: str
    assets: list[str]
    product_data: dict
    embedded_products: list[dict] = field(default_factory=list)


def atomic_write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temp_name = tempfile.mkstemp(prefix=f'.{path.name}.', suffix='.tmp', dir=path.parent)
    temp = Path(temp_name)
    try:
        with os.fdopen(handle, 'w', encoding='utf-8', newline='\n') as stream: json.dump(value, stream, indent=2, ensure_ascii=False); stream.write('\n')
        json.loads(temp.read_text(encoding='utf-8'))
        os.replace(temp, path)
    finally:
        if temp.exists(): temp.unlink()


def validate_product_records(records: list[dict], cfg: dict) -> None:
    if not records: raise ValueError('validated product output is empty')
    ids: set[str] = set(); routes: set[tuple[str, str]] = set()
    allowed_categories = set(cfg['categories']) | {'unclassified'}
    allowed_domains = {domain.lower() for domain in cfg['allowed_domains']}
    required_strings = ('id', 'manufacturer', 'slug', 'name', 'category', 'sourceUrl', 'sourceType', 'lastVerified')
    for index, product in enumerate(records):
        for key in required_strings:
            if not isinstance(product.get(key), str) or not product[key].strip(): raise ValueError(f'product[{index}].{key} must be a non-empty string')
        if product['manufacturer'] != cfg['slug']: raise ValueError(f'product[{index}] belongs to the wrong supplier')
        if product['category'] not in allowed_categories: raise ValueError(f'product[{index}] has invalid category {product["category"]}')
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', product['slug']): raise ValueError(f'product[{index}] has invalid slug')
        if (urlparse(product['sourceUrl']).hostname or '').lower() not in allowed_domains: raise ValueError(f'product[{index}] source URL is outside supplier domains')
        if not isinstance(product.get('media'), list) or not isinstance(product.get('documents'), list) or not isinstance(product.get('specifications'), dict): raise ValueError(f'product[{index}] has invalid collections')
        route = (product['manufacturer'], product['slug'])
        if product['id'] in ids: raise ValueError(f'duplicate product id {product["id"]}')
        if route in routes: raise ValueError(f'duplicate product route {route[0]}/{route[1]}')
        ids.add(product['id']); routes.add(route)


def save_asset_body(supplier: str, url: str, page_url: str, kind: str, role: str, response: FetchResponse) -> Asset:
    extension = Path(urlparse(url).path).suffix.lower()
    if kind == 'image' and extension not in MEDIA_EXTS: extension = mimetypes.guess_extension(response.content_type) or '.img'
    if kind == 'document': extension = '.pdf'
    target_root = (PUBLIC_IMG if kind == 'image' else PUBLIC_DOC) / supplier
    target_root.mkdir(parents=True, exist_ok=True)
    path = target_root / safe_filename(url, kind, extension)
    path.write_bytes(response.body)
    final_url = normalize(response.final_url, url) or response.final_url
    return Asset(supplier, [page_url], url, final_url, '/' + path.relative_to(ROOT / 'public').as_posix(), kind, role, hashlib.sha256(response.body).hexdigest(), len(response.body), time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()))


def product_asset_paths(page: Page, assets: dict[str, Asset], attach_page_roles: list[str] | None = None) -> tuple[list[str], list[str]]:
    page_key = slugify(Path(urlparse(page.url).path.rstrip('/')).stem)
    model_key = slugify(str(page.product_data.get('modelNumber') or ''))
    images: list[str] = []; documents: list[str] = []
    by_local_path = {asset.local_path: asset for asset in assets.values()}
    for local_path in page.assets:
        asset = by_local_path.get(local_path)
        if not asset: continue
        asset_key = slugify(Path(urlparse(asset.original_asset_url).path).stem)
        specific = asset.role == 'product-jsonld' or asset.role in (attach_page_roles or []) or page_key in asset_key or (model_key != 'item' and model_key in asset_key)
        if not specific: continue
        (documents if asset.asset_type == 'document' else images).append(local_path)
    return sorted(set(images)), sorted(set(documents))


def checkpoint(path: Path, queue, queued, seen_requests, seen_canonical, pages, assets, errors) -> None:
    atomic_write_json(path, {'queue': list(queue), 'queued': sorted(queued), 'seenRequests': sorted(seen_requests), 'seenCanonical': sorted(seen_canonical), 'pages': [asdict(page) for page in pages], 'assets': [asdict(asset) for asset in assets.values()], 'errors': errors})


def crawl_supplier(cfg: dict, args) -> tuple[dict, bool]:
    slug = cfg['slug']
    page_domains = {domain.lower() for domain in cfg['allowed_domains']}
    asset_domains = {domain.lower() for domain in cfg.get('asset_domains', cfg['allowed_domains'])}
    snapshot_root = SOURCE_ROOT / slug / 'html'
    snapshot_root.mkdir(parents=True, exist_ok=True)
    checkpoint_path = MANIFEST_ROOT / f'{slug}.checkpoint.json'
    pages: list[Page] = []
    assets: dict[str, Asset] = {}
    errors: list[dict] = []
    if args.resume and checkpoint_path.exists():
        state = json.loads(checkpoint_path.read_text(encoding='utf-8'))
        queue = deque(state.get('queue', [])); queued = set(state.get('queued', [])); seen_requests = set(state.get('seenRequests', [])); seen_canonical = set(state.get('seenCanonical', []))
        pages = [Page(**page) for page in state.get('pages', [])]
        assets = {asset['original_asset_url']: Asset(**({'role': 'generic', 'final_asset_url': asset['original_asset_url']} | asset)) for asset in state.get('assets', [])}
        errors = state.get('errors', [])
    else:
        starts = [normalize(url, cfg['base_url']) for url in cfg['start_urls']]
        queue = deque(url for url in starts if url); queued = set(queue); seen_requests = set(); seen_canonical = set()
    print(f'\n== {cfg["name"]} ==')
    while queue and len(seen_requests) < args.max_pages:
        url = queue.popleft(); queued.discard(url)
        if url in seen_requests or not same_allowed(url, page_domains): continue
        extension = Path(urlparse(url).path).suffix.lower()
        if extension in SKIP_EXTS: continue
        seen_requests.add(url)
        try:
            response = fetch(url, page_domains, args.timeout, args.max_response_mb * 1024 * 1024, 'page', args.retries)
        except Exception as error:
            errors.append({'url': url, 'error': str(error)}); print(f'! {url}: {error}', file=sys.stderr)
            checkpoint(checkpoint_path, queue, queued, seen_requests, seen_canonical, pages, assets, errors)
            continue
        final_url = normalize(response.final_url, url) or url
        if response.content_type == 'application/pdf' or extension == '.pdf':
            if not args.no_download and final_url not in assets and len(assets) < args.max_assets:
                assets[final_url] = save_asset_body(slug, final_url, url, 'document', 'document', response)
            checkpoint(checkpoint_path, queue, queued, seen_requests, seen_canonical, pages, assets, errors)
            continue
        text = decode_html(response.body, response.charset)
        parser = PageParser(cfg.get('asset_role_rules')); parser.feed(text)
        canonical = normalize(parser.canonical, final_url) if parser.canonical else final_url
        if canonical and same_allowed(canonical, page_domains): final_url = canonical
        if final_url in seen_canonical:
            checkpoint(checkpoint_path, queue, queued, seen_requests, seen_canonical, pages, assets, errors); continue
        seen_canonical.add(final_url)
        nodes = product_nodes(parser.jsonld)
        product_data = jsonld_product_data(nodes[0]) if len(nodes) == 1 else {}
        embedded_products = embedded_caption_products(parser, urlparse(final_url).path, cfg) + embedded_json_products(parser, final_url, cfg)
        for embedded in embedded_products:
            if embedded.get('image'): parser.media.append((embedded['image'], 'image', 'embedded-product'))
        for image in product_data.get('images', []): parser.media.append((image, 'image', 'product-jsonld'))
        category = infer_category(final_url, parser, cfg, product_data)
        candidate = (bool(embedded_products) or is_product_candidate(final_url, parser, cfg.get('product_hints', []), product_data, cfg.get('product_path_rules'))) and query_requirements_met(final_url, cfg)
        if candidate and cfg.get('fixed_product_category'): category = cfg['fixed_product_category']
        if candidate and any(re.fullmatch(rule, urlparse(final_url).path, re.I) for rule in cfg.get('reject_product_paths', [])):
            candidate = False
        snapshot_name = f'{len(pages)+1:04d}-{slugify(parser.h1 or parser.title or final_url)}.html'
        snapshot = snapshot_root / snapshot_name; snapshot.write_text(text, encoding='utf-8', newline='\n')
        page_assets: list[str] = []
        discovered_assets = list(parser.media)
        for href in parser.links:
            link_candidate = normalize(href, final_url)
            if not link_candidate: continue
            is_configured_product_link = any(re.fullmatch(rule, urlparse(link_candidate).path, re.I) for rule in cfg.get('product_path_rules', []))
            if is_configured_product_link and cfg.get('product_link_parent_rules') and not any(re.search(rule, final_url, re.I) for rule in cfg['product_link_parent_rules']): continue
            if cfg.get('skip_nonmatching_product_queries') and is_configured_product_link and not query_requirements_met(link_candidate, cfg): continue
            candidate_extension = Path(urlparse(link_candidate).path).suffix.lower()
            if candidate_extension == '.pdf': discovered_assets.append((link_candidate, 'document', 'document'))
            elif '/cdn-cgi/' not in urlparse(link_candidate).path and same_allowed(link_candidate, page_domains) and candidate_extension not in (SKIP_EXTS | MEDIA_EXTS) and link_candidate not in seen_requests and link_candidate not in queued:
                if any(re.search(pattern, urlparse(link_candidate).path, re.I) for pattern in cfg.get('prioritize_link_patterns', [])):
                    queue.appendleft(link_candidate)
                else:
                    queue.append(link_candidate)
                queued.add(link_candidate)
        if not args.no_download and (candidate or not cfg.get('assets_on_product_pages_only')):
            for raw, kind, role in discovered_assets:
                asset_url = normalize(raw, final_url)
                if not asset_url or not relevant_asset(asset_url, role) or not same_allowed(asset_url, asset_domains): continue
                if Path(urlparse(asset_url).path).suffix.lower() in cfg.get('skip_asset_extensions', []): continue
                if asset_url in assets:
                    asset = assets[asset_url]
                    if final_url not in asset.source_page_urls: asset.source_page_urls.append(final_url); asset.source_page_urls.sort()
                    page_assets.append(asset.local_path)
                    continue
                if len(assets) >= args.max_assets: break
                try:
                    asset_response = fetch(asset_url, asset_domains, args.timeout, args.max_asset_mb * 1024 * 1024, kind, args.retries)
                    asset = save_asset_body(slug, asset_url, final_url, kind, role, asset_response); assets[asset_url] = asset; page_assets.append(asset.local_path)
                except Exception as error:
                    errors.append({'url': asset_url, 'page': final_url, 'error': str(error)})
        pages.append(Page(final_url, parser.title, parser.h1, parser.description, str(snapshot.relative_to(ROOT)), candidate, category, sorted(set(page_assets)), product_data, embedded_products))
        print(f'{len(pages):4d} {final_url}{" [product]" if candidate else ""}')
        checkpoint(checkpoint_path, queue, queued, seen_requests, seen_canonical, pages, assets, errors)
        if args.delay: time.sleep(args.delay)

    products = []
    ids: set[str] = set(); routes: set[tuple[str, str]] = set(); structural_errors = []
    for page in pages:
        if not page.is_product_candidate: continue
        if page.embedded_products:
            for embedded in page.embedded_products:
                product_slug = embedded['slug']; product_id = f'{slug}:{product_slug}'; route = (slug, product_slug)
                if product_id in ids or route in routes:
                    structural_errors.append({'url': page.url, 'error': f'duplicate product identity {product_id}'}); continue
                ids.add(product_id); routes.add(route)
                embedded_url = normalize(embedded.get('image'), page.url) if embedded.get('image') else None
                embedded_assets = [asset.local_path for asset in assets.values() if embedded_url and asset.original_asset_url == embedded_url]
                synthetic = Page(page.url, page.title, page.h1, page.description, page.snapshot, True, page.category, embedded_assets, {'modelNumber': embedded['modelNumber']})
                media, documents = product_asset_paths(synthetic, assets, cfg.get('attach_page_roles'))
                products.append({'id': product_id, 'manufacturer': slug, 'slug': product_slug, 'name': embedded['name'], 'category': page.category, 'collection': embedded['collection'], 'modelNumber': embedded['modelNumber'], 'type': None, 'summary': None, 'sourceDescription': None, 'sourceUrl': page.url, 'sourceType': 'live-crawl', 'media': media, 'documents': documents, 'specifications': {}, 'lastVerified': time.strftime('%Y-%m-%d')})
            continue
        page_path = urlparse(page.url).path
        identity = next((rule for rule in cfg.get('product_identity_rules', []) if re.fullmatch(rule['path_pattern'], page_path, re.I)), {})
        if not identity and cfg.get('model_path_identity'):
            match = re.fullmatch(r'/windows/(?:(heritage-maximum|heritage|classic)-)?((?:hc|wc)-\d+)-([^/]+)/?', page_path, re.I)
            if match:
                collection_key, model, style = match.groups()
                collections = {'heritage': 'Heritage Collection', 'heritage-maximum': 'Heritage Maximum Collection', 'classic': 'Classic Collection'}
                model = model.upper(); style = style.replace('-', ' ').title()
                identity = {'slug': model.lower(), 'name': f'{model} {style}', 'modelNumber': model, 'collection': collections.get((collection_key or '').lower()), 'type': style}
        if not identity and cfg.get('collection_from_parent_path'):
            segments = [part for part in page_path.strip('/').split('/') if part]
            if len(segments) >= 2:
                model_slug = segments[-1]
                collection = cfg['collection_from_parent_path'].get(segments[-2])
                if collection:
                    identity = {'slug': model_slug, 'modelNumber': model_slug.upper(), 'collection': collection}
        path_name = Path(urlparse(page.url).path.rstrip('/')).name.replace('-', ' ').title() if cfg.get('name_from_path') else ''
        name = clean_text(identity.get('name') or path_name or page.product_data.get('name') or page.h1 or page.title.split('|')[0])
        if not name: continue
        path_slug = Path(page_path.rstrip('/')).stem if cfg.get('slug_from_path') else ''
        model_match = re.match(cfg.get('model_number_from_name_pattern', r'(?!x)x'), name, re.I)
        inferred_model = model_match.group(1).upper() if model_match and model_match.groups() else None
        product_slug = cfg.get('slug_aliases', {}).get(path_slug) or identity.get('slug') or (slugify(inferred_model) if inferred_model and cfg.get('slug_from_inferred_model') else slugify(path_slug or name)); product_id = f'{slug}:{product_slug}'; route = (slug, product_slug)
        model_number = cfg.get('model_number_overrides', {}).get(path_slug)
        if not model_number and cfg.get('model_number_from_aliased_slug') and path_slug in cfg.get('slug_aliases', {}):
            model_number = product_slug.upper()
        model_number = model_number or identity.get('modelNumber') or page.product_data.get('modelNumber') or inferred_model
        if product_id in ids or route in routes:
            structural_errors.append({'url': page.url, 'error': f'duplicate product identity {product_id}'}); continue
        ids.add(product_id); routes.add(route)
        media, documents = product_asset_paths(page, assets, cfg.get('attach_page_roles'))
        products.append({'id': product_id, 'manufacturer': slug, 'slug': product_slug, 'name': name, 'category': identity.get('category') or page.category, 'collection': identity.get('collection'), 'modelNumber': model_number, 'type': identity.get('type'), 'summary': None, 'sourceDescription': page.product_data.get('description') or page.description or None, 'sourceUrl': page.url, 'sourceType': 'live-crawl', 'media': media, 'documents': documents, 'specifications': page.product_data.get('specifications', {}), 'lastVerified': time.strftime('%Y-%m-%d')})
    errors.extend(structural_errors)
    viable = bool(pages) and bool(products) and not structural_errors
    if viable:
        try: validate_product_records(products, cfg)
        except ValueError as error: errors.append({'error': str(error)}); viable = False
    result = {'supplier': {key: cfg[key] for key in ('slug', 'name', 'base_url', 'categories')}, 'crawledAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'pages': [asdict(page) for page in pages], 'assets': [asdict(asset) for asset in assets.values()], 'products': products, 'errors': errors}
    atomic_write_json(MANIFEST_ROOT / f'{slug}.json', result)
    if viable:
        atomic_write_json(CATALOG_DIR / f'{slug}.json', products)
        checkpoint_path.unlink(missing_ok=True)
    else:
        print(f'! Preserved last-known-good catalogue for {slug}: crawl produced no validated products', file=sys.stderr)
    return result, viable


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--supplier', action='append', help='Supplier slug; repeatable. Defaults to all.')
    parser.add_argument('--max-pages', type=int, default=250)
    parser.add_argument('--max-assets', type=int, default=500)
    parser.add_argument('--max-response-mb', type=int, default=12)
    parser.add_argument('--max-asset-mb', type=int, default=50)
    parser.add_argument('--delay', type=float, default=0.5)
    parser.add_argument('--timeout', type=int, default=30)
    parser.add_argument('--retries', type=int, default=2)
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--no-download', action='store_true', help='Save pages and product discoveries without downloading images/PDFs')
    args = parser.parse_args()
    configs = json.loads(CONFIG.read_text(encoding='utf-8'))
    known = {config['slug'] for config in configs}
    if args.supplier:
        unknown = sorted(set(args.supplier) - known)
        if unknown: parser.error(f'unknown supplier slug(s): {", ".join(unknown)}')
        wanted = set(args.supplier); configs = [config for config in configs if config['slug'] in wanted]
    MANIFEST_ROOT.mkdir(parents=True, exist_ok=True); CATALOG_DIR.mkdir(parents=True, exist_ok=True)
    failed = []
    for config in configs:
        _, viable = crawl_supplier(config, args)
        if not viable: failed.append(config['slug'])
    if failed:
        print(f'Ingestion failed validation for: {", ".join(failed)}', file=sys.stderr)
        return 1
    print(f'\nUpdated {len(configs)} independent supplier catalogue file(s).')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
