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
from urllib.parse import parse_qsl, quote, urlencode, urldefrag, urljoin, urlparse, urlunparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / 'scripts' / 'ingest' / 'suppliers.json'
SOURCE_ROOT = ROOT / 'source-media'
PUBLIC_IMG = ROOT / 'public' / 'images' / 'catalog'
PUBLIC_DOC = ROOT / 'public' / 'documents' / 'catalog'
SUPPLIER_ARCHIVE_ROOT = SOURCE_ROOT / 'suppliers'
MANIFEST_ROOT = SOURCE_ROOT / 'manifests'
STAGING_ROOT = SOURCE_ROOT / 'staging'
CATALOG_DIR = ROOT / 'src' / 'data' / 'catalog' / 'discovered'
UA = 'WindowReplacementProAuthorizedMediaIngest/2.0 (+https://windowreplacement.pro/)'
MEDIA_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg'}
SKIP_EXTS = {'.zip', '.mp4', '.mov', '.mp3', '.woff', '.woff2', '.ttf', '.css', '.js'}
TRACKING_PARAMS = {'fbclid', 'gclid', 'mc_cid', 'mc_eid'}
GENERIC_SEGMENTS = {'', 'home', 'products', 'product', 'catalog', 'catalogs', 'collections', 'collection', 'category', 'categories', 'exterior', 'doors', 'windows', 'resources', 'brochures'}
DETAIL_TERMS = {'specification', 'dimensions', 'model', 'glass options', 'hardware', 'warranty', 'energy rating', 'sizes available'}
ROLE_ALIASES = {
    'hero': 'product-hero', 'gallery': 'product-gallery', 'technical': 'technical-drawing',
    'document': 'reference-only', 'embedded-product': 'product-hero', 'product-jsonld': 'product-hero',
}
IMAGE_ROLES = {'product-hero', 'product-gallery', 'lifestyle-product', 'technical-drawing', 'profile-section', 'configuration-diagram', 'colour-chart', 'interior-option', 'finish-swatch', 'glass-design', 'hardware', 'open-graph-image'}
DOCUMENT_ROLES = {'brochure', 'specification-sheet', 'installation-guide', 'warranty', 'performance-document', 'catalogue'}


def explicit_role(role: str | None) -> str:
    return ROLE_ALIASES.get(role or '', role or 'reference-only')


def slugify(value: str) -> str:
    value = html.unescape(value).lower().strip()
    value = re.sub(r'[^a-z0-9]+', '-', value)
    return value.strip('-')[:100] or 'item'


def clean_text(value: str | None) -> str:
    return re.sub(r'\s+', ' ', html.unescape(value or '')).strip()


def normalize(url: str, base: str) -> str | None:
    if re.search(r'[\r\n\t{}"<>]', url): return None
    joined = urldefrag(urljoin(base, url))[0]
    parsed = urlparse(joined)
    if parsed.scheme.lower() not in {'http', 'https'} or not parsed.hostname:
        return None
    hostname = parsed.hostname.lower()
    port = parsed.port
    netloc = hostname if not port or (parsed.scheme == 'http' and port == 80) or (parsed.scheme == 'https' and port == 443) else f'{hostname}:{port}'
    query = urlencode(sorted((key, value) for key, value in parse_qsl(parsed.query, keep_blank_values=True) if not key.lower().startswith('utm_') and key.lower() not in TRACKING_PARAMS))
    path = quote(re.sub(r'/{2,}', '/', parsed.path or '/'), safe="/%:@!$&'()*+,;=-._~")
    return urlunparse((parsed.scheme.lower(), netloc, path, '', query, ''))


def same_allowed(url: str, domains: set[str]) -> bool:
    return (urlparse(url).hostname or '').lower() in domains


def rewrite_asset_url(url: str, cfg: dict) -> str:
    rewritten = url
    for rule in cfg.get('asset_url_rewrite_rules', []):
        rewritten = re.sub(rule['pattern'], rule['replacement'], rewritten, flags=re.I)
    return rewritten

def page_allowed(url: str, cfg: dict) -> bool:
    if not same_allowed(url, {domain.lower() for domain in cfg['allowed_domains']}): return False
    path = urlparse(url).path
    prefixes = cfg.get('allowed_path_prefixes', [])
    if prefixes and not any(path.startswith(prefix) for prefix in prefixes): return False
    patterns = cfg.get('allowed_path_patterns', [])
    return not patterns or any(re.search(pattern, path, re.I) for pattern in patterns)


def raw_link_allowed(url: str, cfg: dict) -> bool:
    value = html.unescape(url).strip()
    if not value:
        return False
    return not any(re.fullmatch(pattern, value, re.I) for pattern in cfg.get('reject_raw_link_patterns', []))


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
    if kind == 'page': return content_type in {'text/html', 'application/xhtml+xml', 'application/json', 'application/pdf', ''}
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


WP_SIZE_SUFFIX = re.compile(r'-\d{2,5}x\d{2,5}(?=\.[a-z0-9]{2,5}$)', re.I)
ASSET_PLANNER_VERSION = 4


def wordpress_master_candidate(attributes: dict, linked_url: str | None = None) -> str | None:
    explicit = next((attributes.get(key) for key in ('data-orig-file', 'data-original', 'data-full') if attributes.get(key)), None)
    direct = next((attributes.get(key) for key in ('src', 'data-src', 'data-lazy-src') if attributes.get(key)), None)
    srcset = next((attributes.get(key) for key in ('srcset', 'data-srcset') if attributes.get(key)), '')
    parsed = []
    for part in srcset.split(','):
        fields = part.strip().split()
        if not fields: continue
        score = 0
        if len(fields) > 1:
            match = re.fullmatch(r'(\d+)(w|x)', fields[-1], re.I)
            if match: score = int(match.group(1)) * (100000 if match.group(2).lower() == 'x' else 1)
        parsed.append((score, fields[0]))
    largest = max(parsed, key=lambda item: item[0])[1] if parsed else None
    selected = explicit or largest or attributes.get('data-large-file') or direct
    if linked_url and selected:
        linked_path = urlparse(linked_url).path
        selected_path = urlparse(selected).path
        if Path(linked_path).suffix.lower() in MEDIA_EXTS and WP_SIZE_SUFFIX.sub('', linked_path) == WP_SIZE_SUFFIX.sub('', selected_path):
            selected = linked_url
    return selected

class PageParser(HTMLParser):
    def __init__(self, asset_role_rules: list[dict] | None = None, excluded_media_region_patterns: list[str] | None = None):
        super().__init__(convert_charrefs=True)
        self.asset_role_rules = asset_role_rules or []
        self.excluded_media_region_patterns = excluded_media_region_patterns or []
        self.links: list[str] = []
        self.link_titles: dict[str, str] = {}
        self.media: list[tuple[str, str, str]] = []
        self.title = ''
        self.description = ''
        self.h1 = ''
        self.canonical = ''
        self.jsonld: list[str] = []
        self.magento_init: list[str] = []
        self.visible_text: list[str] = []
        self.embedded_descriptions: list[str] = []
        self.embedded_json_attributes: list[str] = []
        self._capture: str | None = None
        self._buffer: list[str] = []
        self._ignored_depth = 0
        self._link_stack: list[str] = []
        self._media_regions: list[tuple[str, bool, bool]] = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        region_descriptor = ' '.join(str(attributes.get(key, '')) for key in ('class', 'id', 'role', 'aria-label')).lower()
        parent_excluded = self._media_regions[-1][1] if self._media_regions else False
        parent_primary = self._media_regions[-1][2] if self._media_regions else False
        excluded_region = parent_excluded or any(marker in region_descriptor for marker in (
            'up-sells', 'upsells', 'cross-sell', 'crosssell', 'related products', 'related-products',
            'recommendation', 'recommendations', 'recommended-products', 'you-may-also-like', 'you may also like',
            'footer-slider', 'footer slider', 'category-thumbnail', 'collection-navigation',
        )) or any(re.search(pattern, region_descriptor, re.I) for pattern in self.excluded_media_region_patterns)
        primary_region = not excluded_region and (parent_primary or any(marker in region_descriptor for marker in (
            'woocommerce-product-gallery', 'avada-single-product-gallery', 'product-gallery__wrapper',
        )))
        if tag not in {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}:
            self._media_regions.append((tag, excluded_region, primary_region))
        if attributes.get('data-description'): self.embedded_descriptions.append(attributes['data-description'])
        if attributes.get('data-json'): self.embedded_json_attributes.append(attributes['data-json'])
        if tag in {'script', 'style', 'noscript'}: self._ignored_depth += 1
        if tag == 'a':
            self._link_stack.append(attributes.get('href', ''))
            if attributes.get('href'):
                self.links.append(attributes['href'])
                self.link_titles[attributes['href']] = clean_text(attributes.get('title') or attributes.get('aria-label') or '')
        if tag in {'img', 'source'} and not excluded_region:
            descriptor = ' '.join(str(attributes.get(key, '')) for key in ('class', 'id', 'alt')).lower()
            selected = wordpress_master_candidate(attributes, self._link_stack[-1] if self._link_stack else None)
            configured_role = next((explicit_role(rule.get('role')) for rule in self.asset_role_rules if any(re.search(pattern, f'{descriptor} {selected or ""}', re.I) for pattern in rule.get('patterns', []))), None)
            if configured_role: role = configured_role
            elif any(word in descriptor for word in ('configuration', 'size chart', 'opening panel')): role = 'configuration-diagram'
            elif any(word in descriptor for word in ('profile', 'cross-section', 'cross section', 'section drawing')): role = 'profile-section'
            elif any(word in descriptor for word in ('drawing', 'diagram', 'technical', 'dimension')): role = 'technical-drawing'
            elif any(word in descriptor for word in ('colour', 'color', 'finish', 'swatch')): role = 'finish-swatch'
            elif any(word in descriptor for word in ('handle', 'hardware', 'lock', 'roller')): role = 'hardware'
            elif any(word in descriptor for word in ('glass design', 'doorglass', 'door glass')): role = 'glass-design'
            elif primary_region: role = 'product-gallery'
            elif any(word in descriptor for word in ('hero', 'main-image', 'featured', 'primary')): role = 'product-hero'
            elif any(word in descriptor for word in ('gallery', 'product', 'slide')): role = 'product-gallery'
            else: role = 'generic'
            if selected: self.media.append((selected, 'image', role))
        style = attributes.get('style', '')
        if not excluded_region:
            for background in re.findall(r'url\(["\']?([^"\')]+)', style, re.I):
                self.media.append((background, 'image', 'product-gallery' if primary_region or any(word in str(attributes.get('class', '')).lower() for word in ('product', 'gallery', 'hero')) else 'generic'))
        if tag == 'meta':
            key = (attributes.get('property') or attributes.get('name') or '').lower()
            if key in {'description', 'og:description'} and not self.description: self.description = attributes.get('content', '')
            if key in {'og:image', 'og:image:url', 'twitter:image'} and attributes.get('content'):
                self.media.append((attributes['content'], 'image', 'open-graph-image'))
        if tag == 'link' and attributes.get('href'):
            rel = str(attributes.get('rel', '')).lower()
            if 'canonical' in rel: self.canonical = attributes['href']
        if tag == 'title': self._capture, self._buffer = 'title', []
        elif tag == 'h1' and not self.h1: self._capture, self._buffer = 'h1', []
        elif tag == 'script' and str(attributes.get('type', '')).lower() == 'application/ld+json': self._capture, self._buffer = 'jsonld', []
        elif tag == 'script' and str(attributes.get('type', '')).lower() == 'text/x-magento-init': self._capture, self._buffer = 'magento', []

    def handle_endtag(self, tag):
        if self._capture == 'title' and tag == 'title': self.title, self._capture = clean_text(''.join(self._buffer)), None
        elif self._capture == 'h1' and tag == 'h1': self.h1, self._capture = clean_text(''.join(self._buffer)), None
        elif self._capture == 'jsonld' and tag == 'script': self.jsonld.append(''.join(self._buffer)); self._capture = None
        elif self._capture == 'magento' and tag == 'script': self.magento_init.append(''.join(self._buffer)); self._capture = None
        if tag == 'a' and self._link_stack: self._link_stack.pop()
        if tag in {'script', 'style', 'noscript'} and self._ignored_depth: self._ignored_depth -= 1
        for index in range(len(self._media_regions) - 1, -1, -1):
            if self._media_regions[index][0] == tag:
                del self._media_regions[index:]
                break

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


def magento_gallery_assets(blocks: Iterable[str]) -> list[tuple[str, str, str]]:
    """Extract full-size product gallery assets from Magento init payloads."""
    found: list[tuple[str, str, str]] = []
    for block in blocks:
        try: payload = json.loads(block)
        except json.JSONDecodeError: continue
        if not isinstance(payload, dict): continue
        for component in payload.values():
            if not isinstance(component, dict): continue
            gallery = component.get('mage/gallery/gallery')
            if not isinstance(gallery, dict): continue
            for item in gallery.get('data', []):
                if not isinstance(item, dict) or item.get('type', 'image') != 'image': continue
                url = item.get('full') or item.get('img') or item.get('thumb')
                if isinstance(url, str) and url:
                    found.append((url, 'image', 'product-hero' if item.get('isMain') else 'product-gallery'))
    return found


def document_role(url: str, descriptor: str = '', cfg: dict | None = None) -> str:
    value = clean_text(f'{url} {descriptor}').lower()
    rules = (
        ('warranty', ('warranty', 'garantie')),
        ('installation-guide', ('install', 'assembly', 'instructions', 'guide de pose')),
        ('specification-sheet', ('specification', 'data sheet', 'product sheet', 'sell sheet', 'fiche produit', 'fiche_produit')),
        ('performance-document', ('performance', 'energy star', 'energy-star', 'rating', 'structural', 'thermal')),
        ('colour-chart', ('colour', 'color', 'finish chart', 'glass chart')),
        ('catalogue', ('catalogue', 'catalog')),
        ('brochure', ('brochure', 'collection')),
    )
    role = next((role for role, terms in rules if any(term in value for term in terms)), 'reference-only')
    if role != 'reference-only': return role
    return next((rule['role'] for rule in (cfg or {}).get('document_role_rules', []) if any(re.search(pattern, value, re.I) for pattern in rule['patterns'])), 'reference-only')


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
    path_category = next((rule['category'] for rule in cfg.get('category_path_rules', []) if re.fullmatch(rule['path_pattern'], urlparse(url).path, re.I)), None)
    if path_category: return path_category
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
    return explicit_role(role) in IMAGE_ROLES | DOCUMENT_ROLES | {'colour-chart', 'reference-only'}


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


def api_json_products(payload, cfg: dict) -> list[dict]:
    key = cfg.get('api_product_list_key')
    if not key or not isinstance(payload, dict): return []
    records = payload.get(key, [])
    if not isinstance(records, list): return []
    products = []
    for record in records:
        if not isinstance(record, dict): continue
        sku = clean_text(record.get(cfg.get('api_model_key', 'sku')))
        if any(re.search(pattern, sku, re.I) for pattern in cfg.get('api_exclude_model_patterns', [])): continue
        name = clean_text(record.get(cfg.get('api_name_key', 'name')))
        source_url = clean_text(record.get(cfg.get('api_url_key', 'url')))
        image_record = record.get(cfg.get('api_image_key', 'image'), {})
        image = image_record.get(cfg.get('api_image_url_key', 'defaultSrc')) if isinstance(image_record, dict) else None
        if not name or not sku or not source_url: continue
        base_slug = cfg.get('embedded_slug_aliases', {}).get(slugify(name), slugify(name))
        suffix = next((rule['suffix'] for rule in cfg.get('api_slug_suffix_rules', []) if re.search(rule['model_pattern'], sku, re.I)), '')
        product_slug = f'{base_slug}-{slugify(suffix)}' if suffix else base_slug
        products.append({'slug': product_slug, 'name': name, 'modelNumber': sku, 'collection': None, 'image': image, 'sourceUrl': source_url, 'description': clean_text(image_record.get('altText')) if isinstance(image_record, dict) else None})
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
    staging_path: str = ''
    source_asset_urls: list[str] = field(default_factory=list)
    product_ids: list[str] = field(default_factory=list)
    collections: list[str] = field(default_factory=list)
    scope: str = 'unassociated'
    relationship_state: str = 'uncertain/review'
    relationship_evidence: list[str] = field(default_factory=list)
    master_asset_url: str | None = None
    selected_asset_url: str | None = None
    mime_type: str | None = None
    width: int | None = None
    height: int | None = None


ASSET_TASK_STATES = {'pending', 'downloaded', 'validated', 'rejected', 'retryable', 'promoted'}


@dataclass
class AssetTask:
    url: str
    source_url: str
    page_url: str
    kind: str
    role: str
    order: int
    group: str
    association_rank: int = 9
    relationship_signals: list[str] = field(default_factory=list)
    status: str = 'pending'
    attempts: int = 0
    error: str | None = None
    asset_url: str | None = None
    downloaded_at: str | None = None
    validated_at: str | None = None
    promoted_at: str | None = None


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
    asset_candidates: list[dict] = field(default_factory=list)


def refresh_page_asset_candidates(page: Page, cfg: dict, asset_domains: set[str]) -> None:
    snapshot = ROOT / page.snapshot
    if not snapshot.is_file() or snapshot.suffix.lower() == '.json':
        return
    parser = PageParser(cfg.get('asset_role_rules'), cfg.get('excluded_media_region_patterns'))
    parser.feed(snapshot.read_text(encoding='utf-8'))
    discovered_assets = list(parser.media)
    if cfg.get('trust_structured_product_images', True):
        for image in page.product_data.get('images', []): discovered_assets.append((image, 'image', 'product-hero'))
    parser.media.extend(magento_gallery_assets(parser.magento_init))
    discovered_assets.extend(magento_gallery_assets(parser.magento_init))
    for href in parser.links:
        if not raw_link_allowed(href, cfg): continue
        link_candidate = normalize(href, page.url)
        if link_candidate and Path(urlparse(link_candidate).path).suffix.lower() == '.pdf':
            discovered_assets.append((link_candidate, 'document', document_role(link_candidate, parser.link_titles.get(href, ''), cfg)))
    refreshed: list[dict] = []
    for order, (raw, kind, role) in enumerate(discovered_assets):
        role = explicit_role(role)
        if not page.is_product_candidate and cfg.get('assets_on_product_pages_only') and kind != 'document' and role not in set(cfg.get('archive_shared_roles', [])): continue
        source_asset_url = normalize(raw, page.url)
        if not source_asset_url or not relevant_asset(source_asset_url, role) or not same_allowed(source_asset_url, asset_domains): continue
        asset_url = rewrite_asset_url(source_asset_url, cfg)
        if not same_allowed(asset_url, asset_domains): continue
        if Path(urlparse(asset_url).path).suffix.lower() in cfg.get('skip_asset_extensions', []): continue
        if asset_url not in {item['url'] for item in refreshed}:
            refreshed.append({'url': asset_url, 'source_url': source_asset_url, 'kind': kind, 'role': role, 'order': order})
    page.asset_candidates = refreshed

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


def image_dimensions(body: bytes, content_type: str | None = None) -> tuple[int | None, int | None]:
    if body.startswith(b'\x89PNG\r\n\x1a\n') and len(body) >= 24:
        return int.from_bytes(body[16:20], 'big'), int.from_bytes(body[20:24], 'big')
    if body[:6] in {b'GIF87a', b'GIF89a'} and len(body) >= 10:
        return int.from_bytes(body[6:8], 'little'), int.from_bytes(body[8:10], 'little')
    if body.startswith(b'\xff\xd8'):
        index = 2
        while index + 9 < len(body):
            if body[index] != 0xFF: index += 1; continue
            marker = body[index + 1]; index += 2
            if marker in {0xD8, 0xD9}: continue
            if index + 2 > len(body): break
            length = int.from_bytes(body[index:index + 2], 'big')
            if marker in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF} and index + 7 < len(body):
                return int.from_bytes(body[index + 5:index + 7], 'big'), int.from_bytes(body[index + 3:index + 5], 'big')
            index += max(length, 2)
    if body.startswith(b'RIFF') and body[8:12] == b'WEBP' and len(body) >= 30 and body[12:16] == b'VP8X':
        return int.from_bytes(body[24:27], 'little') + 1, int.from_bytes(body[27:30], 'little') + 1
    return None, None


def hydrate_asset_metadata(asset: Asset) -> None:
    path = asset_storage_path(asset)
    if not path.is_file(): return
    body = path.read_bytes()
    asset.selected_asset_url = asset.selected_asset_url or asset.final_asset_url
    asset.master_asset_url = asset.master_asset_url or (asset.original_asset_url if not WP_SIZE_SUFFIX.search(urlparse(asset.original_asset_url).path) else None)
    asset.mime_type = asset.mime_type or mimetypes.guess_type(urlparse(asset.selected_asset_url or asset.original_asset_url).path)[0]
    if asset.asset_type == 'image' and (asset.width is None or asset.height is None):
        asset.width, asset.height = image_dimensions(body, asset.mime_type)

def save_asset_body(supplier: str, url: str, page_url: str, kind: str, role: str, response: FetchResponse, staging_root: Path) -> Asset:
    extension = Path(urlparse(url).path).suffix.lower()
    if kind == 'image' and extension not in MEDIA_EXTS: extension = mimetypes.guess_extension(response.content_type) or '.img'
    if kind == 'document': extension = '.pdf'
    permanent_root = (PUBLIC_IMG if kind == 'image' else PUBLIC_DOC) / supplier
    permanent_path = permanent_root / safe_filename(url, kind, extension)
    staged_path = staging_root / permanent_path.relative_to(ROOT)
    staged_path.parent.mkdir(parents=True, exist_ok=True)
    staged_path.write_bytes(response.body)
    final_url = normalize(response.final_url, url) or response.final_url
    asset = Asset(supplier, [page_url], url, final_url, '/' + permanent_path.relative_to(ROOT / 'public').as_posix(), kind, explicit_role(role), hashlib.sha256(response.body).hexdigest(), len(response.body), time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), str(staged_path.relative_to(ROOT)), [url])
    asset.selected_asset_url = final_url
    asset.master_asset_url = url if not WP_SIZE_SUFFIX.search(urlparse(url).path) else None
    asset.mime_type = response.content_type
    if kind == 'image': asset.width, asset.height = image_dimensions(response.body, response.content_type)
    return asset


def merge_duplicate_asset(canonical: Asset, duplicate: Asset) -> Asset:
    canonical.source_page_urls = sorted(set(canonical.source_page_urls + duplicate.source_page_urls))
    canonical.source_asset_urls = sorted(set((canonical.source_asset_urls or [canonical.original_asset_url]) + (duplicate.source_asset_urls or [duplicate.original_asset_url])))
    duplicate_stage = ROOT / duplicate.staging_path if duplicate.staging_path else None
    if duplicate_stage and duplicate_stage.exists(): duplicate_stage.unlink()
    return canonical


def asset_storage_path(asset: Asset) -> Path:
    if asset.staging_path:
        return ROOT / asset.staging_path
    return public_path(asset.local_path)


def validate_asset_binary(asset: Asset) -> bool:
    path = asset_storage_path(asset)
    if not path.is_file() or path.stat().st_size != asset.bytes:
        return False
    return hashlib.sha256(path.read_bytes()).hexdigest() == asset.sha256


def build_asset_tasks(groups: dict[str, list[dict]], max_assets: int, saved: list[dict] | None = None) -> tuple[list[AssetTask], dict]:
    if saved:
        tasks = [AssetTask(**task) for task in saved]
        invalid = [task.status for task in tasks if task.status not in ASSET_TASK_STATES]
        if invalid:
            raise ValueError(f'invalid asset task state(s): {sorted(set(invalid))}')
        return tasks, {'plannerVersion': ASSET_PLANNER_VERSION, 'groups': len(groups), 'selected': len(tasks), 'available': len({item['url'] for items in groups.values() for item in items}), 'complete': len(tasks) >= len({item['url'] for items in groups.values() for item in items})}
    required_groups = sum(1 for items in groups.values() if items)
    if required_groups > max_assets:
        raise ValueError(f'asset budget {max_assets} cannot attempt one asset for each of {required_groups} product/source groups; rerun with --max-assets at least {required_groups}')
    selected = fair_asset_candidates(groups, max_assets)
    tasks = [AssetTask(group=item['group'], association_rank=item.get('association_rank', 9), relationship_signals=item.get('relationship_signals', []), **{key: item[key] for key in ('url', 'source_url', 'page_url', 'kind', 'role', 'order')}) for item in selected]
    available = len({item['url'] for items in groups.values() for item in items})
    return tasks, {'plannerVersion': ASSET_PLANNER_VERSION, 'groups': required_groups, 'selected': len(tasks), 'available': available, 'complete': len(tasks) >= available}


def restore_retryable_task_states(tasks: list[AssetTask], saved: list[dict]) -> None:
    saved_by_url: dict[str, dict] = {}
    for record in saved:
        current = saved_by_url.get(record.get('url', ''))
        if not current or record.get('status') == 'retryable': saved_by_url[record.get('url', '')] = record
    for task in tasks:
        prior = saved_by_url.get(task.url)
        if task.status == 'pending' and prior and prior.get('status') == 'retryable':
            task.status = 'retryable'
            task.attempts = int(prior.get('attempts') or 0)
            task.error = prior.get('error')

def reconcile_asset_tasks(tasks: list[AssetTask], assets: dict[str, Asset]) -> tuple[dict[str, Asset], list[str]]:
    aliases = {source_url: asset for asset in assets.values() for source_url in (asset.source_asset_urls or [asset.original_asset_url])}
    invalid_urls: list[str] = []
    now = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    for task in tasks:
        asset = aliases.get(task.url) or (aliases.get(task.asset_url) if task.asset_url else None)
        if not asset:
            if task.status in {'downloaded', 'validated', 'promoted'}:
                task.status = 'pending'; task.error = 'checkpoint referenced no saved asset'; task.asset_url = None
            continue
        if validate_asset_binary(asset):
            hydrate_asset_metadata(asset)
            current_role = explicit_role(asset.role)
            planned_role = explicit_role(task.role)
            asset.role = planned_role if current_role == 'reference-only' and planned_role != 'reference-only' else current_role
            task.status = 'validated'; task.error = None; task.asset_url = asset.original_asset_url; task.validated_at = now
        else:
            invalid_urls.extend(asset.source_asset_urls or [asset.original_asset_url])
            task.status = 'pending'; task.error = 'saved asset failed checksum/size validation'; task.asset_url = None
    return aliases, sorted(set(invalid_urls))


def fair_asset_candidates(groups: dict[str, list[dict]], max_assets: int) -> list[dict]:
    priority = {'product-hero': 0, 'open-graph-image': 1, 'technical-drawing': 1, 'profile-section': 1, 'configuration-diagram': 1, 'interior-option': 5, 'specification-sheet': 2, 'installation-guide': 2, 'warranty': 2, 'performance-document': 2, 'brochure': 3, 'catalogue': 3, 'product-gallery': 4, 'lifestyle-product': 5, 'finish-swatch': 5, 'colour-chart': 5, 'glass-design': 5, 'hardware': 5, 'reference-only': 6}
    queues = {key: sorted(items, key=lambda item: (item.get('association_rank', 9), priority.get(item['role'], 4), item['order'], item['url'])) for key, items in groups.items()}
    selected: list[dict] = []; selected_indexes: dict[str, int] = {}
    while len(selected) < max_assets and any(queues.values()):
        for key in groups:
            if len(selected) >= max_assets: break
            while queues[key]:
                item = queues[key].pop(0)
                prior_index = selected_indexes.get(item['url'])
                if prior_index is not None:
                    if item.get('association_rank', 9) < selected[prior_index].get('association_rank', 9): selected[prior_index] = item
                    continue
                selected_indexes[item['url']] = len(selected)
                selected.append(item); break
    return selected


def public_path(local_path: str) -> Path:
    return ROOT / 'public' / local_path.lstrip('/').replace('/', os.sep)


def promote_referenced_assets(assets: dict[str, Asset], products: list[dict], pages: list[Page]) -> dict[str, Asset]:
    referenced = {path for product in products for path in [*product.get('media', []), *product.get('documents', [])]}
    shared_roles = DOCUMENT_ROLES | {'colour-chart', 'technical-drawing', 'profile-section', 'configuration-diagram', 'interior-option', 'finish-swatch', 'glass-design', 'hardware'}
    accepted = {url: asset for url, asset in assets.items() if asset.local_path in referenced or (asset.scope in {'collection', 'supplier'} and asset.role in shared_roles)}
    accepted_paths = {asset.local_path for asset in accepted.values()}
    replacements: dict[str, str] = {}
    for asset in accepted.values():
        old_local = asset.local_path
        destination = public_path(old_local)
        staged = ROOT / asset.staging_path if asset.staging_path else destination
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            existing_hash = hashlib.sha256(destination.read_bytes()).hexdigest()
            if existing_hash == asset.sha256:
                if staged != destination: staged.unlink(missing_ok=True)
            else:
                destination = destination.with_name(f'{destination.stem}-{asset.sha256[:8]}{destination.suffix}')
                if not destination.exists(): os.replace(staged, destination)
        elif staged.exists():
            os.replace(staged, destination)
        asset.local_path = '/' + destination.relative_to(ROOT / 'public').as_posix()
        asset.staging_path = ''
        replacements[old_local] = asset.local_path
    for product in products:
        product['media'] = [replacements.get(path, path) for path in product.get('media', [])]
        product['documents'] = [replacements.get(path, path) for path in product.get('documents', [])]
    for page in pages:
        page.assets = sorted({replacements.get(path, path) for path in page.assets if path in accepted_paths})
    return accepted


def manifest_asset(asset: Asset) -> dict:
    return {key: value for key, value in asdict(asset).items() if key != 'staging_path'}


def manifest_page(page: Page) -> dict:
    return {key: value for key, value in asdict(page).items() if key != 'asset_candidates'}


def enforce_wordpress_master_precedence(assets: dict[str, Asset], products: list[dict]) -> None:
    """Remove responsive derivative relationships when a validated original URL is present; retain binaries."""
    def source_key(url: str) -> tuple[str, str]:
        parsed = urlparse(url)
        return parsed.netloc.lower(), WP_SIZE_SUFFIX.sub('', parsed.path).lower()
    originals = {
        source_key(asset.selected_asset_url or asset.final_asset_url): asset
        for asset in assets.values()
        if not WP_SIZE_SUFFIX.search(urlparse(asset.selected_asset_url or asset.final_asset_url).path)
    }
    for asset in assets.values():
        selected = asset.selected_asset_url or asset.final_asset_url
        if not WP_SIZE_SUFFIX.search(urlparse(selected).path):
            continue
        master = originals.get(source_key(selected))
        if not master or not validate_asset_binary(master):
            continue
        asset.relationship_evidence = sorted(set(asset.relationship_evidence + ['superseded-by-wordpress-original']))
        for product in products:
            if asset.local_path in product.get('media', []) and master.local_path in product.get('media', []):
                product['media'] = [path for path in product['media'] if path != asset.local_path]


def enforce_filename_owner_precedence(assets: dict[str, Asset], products: list[dict]) -> None:
    """When a reused binary has exact filename/model owners, discard weaker cross-page relationships."""
    by_local_path = {asset.local_path: asset for asset in assets.values()}
    related_by_path: dict[str, list[dict]] = {}
    for product in products:
        for local_path in product.get('media', []) + product.get('documents', []):
            if local_path in by_local_path:
                related_by_path.setdefault(local_path, []).append(product)
    for local_path, related in related_by_path.items():
        asset = by_local_path[local_path]
        owners = {
            product['id'] for product in related
            if asset_identity_match(asset, identity_keys([product.get('slug'), product.get('modelNumber'), product.get('name')]))
        }
        if not owners or len(owners) == len(related):
            continue
        for product in related:
            if product['id'] not in owners:
                product['media'] = [path for path in product.get('media', []) if path != local_path]
                product['documents'] = [path for path in product.get('documents', []) if path != local_path]


def apply_asset_relationship_rules(assets: dict[str, Asset], products: list[dict], rules: list[dict] | None = None) -> None:
    """Apply reviewed supplier image-to-product mappings after heuristic association."""
    if not rules:
        return
    products_by_id = {product['id']: product for product in products}
    for asset in assets.values():
        if asset.asset_type != 'image':
            continue
        urls = {asset.original_asset_url, asset.final_asset_url, *(asset.source_asset_urls or [])}
        matching = [rule for rule in rules if any(re.search(pattern, url, re.I) for pattern in rule.get('patterns', []) for url in urls)]
        if not matching:
            continue
        configured_ids = {product_id for rule in matching for product_id in rule.get('product_ids', [])}
        unknown = configured_ids - products_by_id.keys()
        if unknown:
            raise ValueError(f'asset relationship rule references unknown products: {sorted(unknown)}')
        for product in products:
            product['media'] = [path for path in product.get('media', []) if path != asset.local_path]
        for product_id in sorted(configured_ids):
            product = products_by_id[product_id]
            product['media'] = sorted(set(product.get('media', [])) | {asset.local_path})
        asset.relationship_evidence = sorted(set(asset.relationship_evidence + ['supplier-scoped-asset-map']))


def apply_document_relationship_rules(assets: dict[str, Asset], products: list[dict], rules: list[dict] | None = None) -> None:
    """Apply reviewed supplier document-to-product mappings after heuristic association."""
    if not rules:
        return
    products_by_id = {product['id']: product for product in products}
    for asset in assets.values():
        if asset.asset_type != 'document':
            continue
        urls = {asset.original_asset_url, asset.final_asset_url, *(asset.source_asset_urls or [])}
        matching = [rule for rule in rules if any(re.search(pattern, url, re.I) for pattern in rule.get('patterns', []) for url in urls)]
        if not matching:
            continue
        configured_ids = {product_id for rule in matching for product_id in rule.get('product_ids', [])}
        unknown = configured_ids - products_by_id.keys()
        if unknown:
            raise ValueError(f'document relationship rule references unknown products: {sorted(unknown)}')
        for product in products:
            product['documents'] = [path for path in product.get('documents', []) if path != asset.local_path]
        for product_id in sorted(configured_ids):
            product = products_by_id[product_id]
            product['documents'] = sorted(set(product.get('documents', [])) | {asset.local_path})
        asset.relationship_evidence = sorted(set(asset.relationship_evidence + ['supplier-scoped-document-map']))

def associate_assets(assets: dict[str, Asset], products: list[dict]) -> None:
    shared_roles = DOCUMENT_ROLES | {'colour-chart', 'technical-drawing', 'profile-section', 'configuration-diagram', 'interior-option', 'finish-swatch', 'glass-design', 'hardware'}
    for asset in assets.values():
        related = [product for product in products if asset.local_path in product.get('media', []) + product.get('documents', [])]
        asset.product_ids = sorted({product['id'] for product in related})
        asset.collections = sorted({product['collection'] for product in related if product.get('collection')})
        if asset.product_ids:
            asset.scope = 'product'
            if len(asset.product_ids) > 1:
                asset.relationship_state = 'collection-shared' if len(asset.collections) == 1 else 'supplier-shared'
            else:
                asset.relationship_state = 'product-specific'
        elif asset.role in shared_roles:
            asset.scope = 'collection' if asset.collections else 'supplier'
            asset.relationship_state = 'collection-shared' if asset.collections else 'supplier-shared'
        else:
            asset.scope = 'unassociated'
            asset.relationship_state = 'uncertain/review'


def write_supplier_archive(slug: str, assets: dict[str, Asset]) -> None:
    archive_root = SUPPLIER_ARCHIVE_ROOT / slug
    records = []
    by_product: dict[str, list[dict]] = {}
    documents: list[dict] = []
    for asset in sorted(assets.values(), key=lambda item: (item.role, item.local_path)):
        record = {
            'supplier': slug,
            'sourcePageUrls': asset.source_page_urls,
            'productIds': asset.product_ids,
            'collections': asset.collections,
            'scope': asset.scope,
            'role': asset.role,
            'originalUrl': asset.original_asset_url,
            'sourceUrls': asset.source_asset_urls or [asset.original_asset_url],
            'finalUrl': asset.final_asset_url,
            'localPath': asset.local_path,
            'sha256': asset.sha256,
            'bytes': asset.bytes,
            'discoveredAt': asset.discovered_at,
            'assetType': asset.asset_type,
            'relationshipState': asset.relationship_state,
            'relationshipEvidence': asset.relationship_evidence,
            'masterUrl': asset.master_asset_url,
            'selectedUrl': asset.selected_asset_url,
            'mimeType': asset.mime_type,
            'width': asset.width,
            'height': asset.height,
        }
        records.append(record)
        if asset.asset_type == 'document': documents.append(record)
        for product_id in asset.product_ids: by_product.setdefault(product_id, []).append(record)
    atomic_write_json(archive_root / 'asset-index.json', records)
    atomic_write_json(archive_root / 'documents' / 'index.json', documents)
    for product_id, product_assets in by_product.items():
        atomic_write_json(archive_root / 'products' / product_id.split(':', 1)[-1] / 'assets.json', product_assets)


def attach_available_asset_occurrences(pages: list[Page], asset_aliases: dict[str, Asset]) -> None:
    for page in pages:
        for item in page.asset_candidates:
            asset = asset_aliases.get(item['url']) or asset_aliases.get(item.get('source_url', ''))
            if asset and validate_asset_binary(asset) and asset.local_path not in page.assets:
                page.assets.append(asset.local_path)
        page.assets = sorted(set(page.assets))

IDENTITY_STOPWORDS = {
    'black', 'clear', 'decorative', 'design', 'door', 'doorlite', 'doors', 'exterior', 'fiberglass',
    'finish', 'glass', 'grain', 'impact', 'insert', 'interior', 'lite', 'panel', 'panels', 'product',
    'series', 'sidelite', 'skin', 'smooth', 'straight', 'traditional', 'trimlite', 'white', 'window', 'windows', 'wood',
}


def identity_keys(values: Iterable[str | None]) -> set[str]:
    keys: set[str] = set()
    for value in values:
        if not value: continue
        raw = Path(urlparse(str(value)).path.rstrip('/')).stem if '/' in str(value) else str(value)
        raw = re.sub(r'-[12]$', '', raw)
        lower = raw.lower()
        pieces = [raw, *re.findall(r'[a-z]+\d+[a-z]*', lower), *re.findall(r'[a-z]{4,}', lower), *re.findall(r'\d{3,}', lower)]
        for piece in pieces:
            key = re.sub(r'[^a-z0-9]', '', piece.lower())
            if len(key) >= 4 and key not in IDENTITY_STOPWORDS: keys.add(key)
    return keys


def urls_identity_match(urls: Iterable[str], product_keys: set[str]) -> bool:
    for url in urls:
        stem = Path(WP_SIZE_SUFFIX.sub('', Path(urlparse(url).path).name)).stem
        stem = re.sub(r'-e\d+$', '', stem, flags=re.I)
        stem = re.sub(r'[-_]1$', '', stem)
        stem = re.sub(r'(?<=[A-Za-z])(?:19|20)\d{2}$', '', stem)
        asset_keys = identity_keys([stem])
        if asset_keys & product_keys:
            return True
    return False


def asset_identity_match(asset: Asset, product_keys: set[str]) -> bool:
    return urls_identity_match(set([asset.original_asset_url, asset.final_asset_url, *(asset.source_asset_urls or [])]), product_keys)


def product_asset_paths(page: Page, assets: dict[str, Asset], attach_page_roles: list[str] | None = None, product_identity: Iterable[str | None] | None = None, trust_structured_images: bool = True, trust_product_open_graph: bool = False) -> tuple[list[str], list[str]]:
    page_slug = Path(urlparse(page.url).path.rstrip('/')).stem
    product_keys = identity_keys([page_slug, page.product_data.get('modelNumber'), *(product_identity or [])])
    images: list[str] = []; documents: list[str] = []
    by_local_path = {asset.local_path: asset for asset in assets.values()}
    attach_roles = {explicit_role(role) for role in (attach_page_roles or [])}
    hero_candidates = [item for item in page.asset_candidates if explicit_role(item.get('role')) == 'product-hero']
    first_hero_order = min((item.get('order', 0) for item in hero_candidates), default=None)
    primary_hero_urls = {item['url'] for item in hero_candidates if item.get('order', 0) == first_hero_order}
    primary_gallery_urls = {item['url'] for item in page.asset_candidates if explicit_role(item.get('role')) == 'product-gallery'}
    product_open_graph_urls = {item['url'] for item in page.asset_candidates if explicit_role(item.get('role')) == 'open-graph-image'} if trust_product_open_graph else set()
    structured_urls = {normalize(url, page.url) for url in page.product_data.get('images', []) if normalize(url, page.url)} if trust_structured_images else set()
    for local_path in page.assets:
        asset = by_local_path.get(local_path)
        if not asset: continue
        asset_urls = set([asset.original_asset_url, asset.final_asset_url, *(asset.source_asset_urls or [])])
        filename_match = asset_identity_match(asset, product_keys)
        primary_hero = bool(asset_urls & primary_hero_urls)
        primary_gallery = bool(asset_urls & primary_gallery_urls)
        product_open_graph = bool(asset_urls & product_open_graph_urls)
        structured_match = bool(asset_urls & structured_urls)
        shared_role = asset.role in DOCUMENT_ROLES | {'technical-drawing', 'profile-section', 'configuration-diagram', 'colour-chart', 'interior-option', 'finish-swatch', 'glass-design', 'hardware'}
        structured_conflict = bool(structured_urls and (primary_hero or primary_gallery) and not structured_match and not filename_match and not shared_role)
        specific = filename_match or primary_hero or primary_gallery or product_open_graph or structured_match or asset.role in attach_roles or (asset.asset_type == 'document' and shared_role)
        if not specific or structured_conflict: continue
        if filename_match: asset.relationship_evidence.append('filename-model-match')
        if primary_hero: asset.relationship_evidence.append('primary-product-hero')
        if primary_gallery: asset.relationship_evidence.append('primary-product-gallery')
        if product_open_graph: asset.relationship_evidence.append('product-page-open-graph')
        if structured_match: asset.relationship_evidence.append('structured-product-image')
        if asset.role in attach_roles: asset.relationship_evidence.append('supplier-scoped-explicit-role')
        asset.relationship_evidence = sorted(set(asset.relationship_evidence))
        (documents if asset.asset_type == 'document' else images).append(local_path)
    return sorted(set(images)), sorted(set(documents))


def checkpoint(path: Path, queue, queued, seen_requests, seen_canonical, pages, assets, errors, run_id: str, *, phase: str = 'page-discovery', asset_tasks: list[AssetTask] | None = None, asset_plan: dict | None = None) -> None:
    atomic_write_json(path, {
        'version': 2,
        'runId': run_id,
        'phase': phase,
        'pageDiscoveryComplete': phase != 'page-discovery',
        'queue': list(queue),
        'queued': sorted(queued),
        'seenRequests': sorted(seen_requests),
        'seenCanonical': sorted(seen_canonical),
        'pages': [asdict(page) for page in pages],
        'assetPlan': asset_plan or {},
        'assetTasks': [asdict(task) for task in (asset_tasks or [])],
        'assets': [asdict(asset) for asset in assets.values()],
        'errors': errors,
    })


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
    failed_assets: set[str] = set()
    saved_asset_tasks: list[dict] = []
    saved_asset_plan: dict = {}
    state: dict = {}
    resume_phase = 'page-discovery'
    run_id = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()) + f'-{os.getpid()}'
    if args.resume and checkpoint_path.exists():
        state = json.loads(checkpoint_path.read_text(encoding='utf-8'))
        run_id = state.get('runId') or run_id
        queue = deque(state.get('queue', [])); queued = set(state.get('queued', [])); seen_requests = set(state.get('seenRequests', [])); seen_canonical = set(state.get('seenCanonical', []))
        pages = [Page(**({'embedded_products': [], 'asset_candidates': []} | page)) for page in state.get('pages', [])]
        assets = {asset['original_asset_url']: Asset(**({'role': 'generic', 'final_asset_url': asset['original_asset_url'], 'staging_path': '', 'source_asset_urls': [asset['original_asset_url']]} | asset)) for asset in state.get('assets', [])}
        errors = state.get('errors', [])
        saved_asset_tasks = state.get('assetTasks', [])
        saved_asset_plan = state.get('assetPlan', {})
        resume_phase = state.get('phase') or ('asset-download' if assets else 'page-discovery')
        if resume_phase != 'page-discovery':
            queue.clear(); queued.clear()
    else:
        starts = [normalize(url, cfg['base_url']) for url in cfg['start_urls']]
        queue = deque(url for url in starts if url); queued = set(queue); seen_requests = set(); seen_canonical = set()
    asset_aliases = {source_url: asset for asset in assets.values() for source_url in (asset.source_asset_urls or [asset.original_asset_url])}
    assets_by_hash = {asset.sha256: asset for asset in assets.values()}
    request_delay = max(args.delay, float(cfg.get('crawl_delay', 0)))
    last_request_at = [0.0]
    def supplier_fetch(*fetch_args):
        wait = request_delay - (time.monotonic() - last_request_at[0])
        if wait > 0: time.sleep(wait)
        response = fetch(*fetch_args)
        last_request_at[0] = time.monotonic()
        return response
    staging_root = STAGING_ROOT / slug / run_id
    staging_root.mkdir(parents=True, exist_ok=True)
    run_path = staging_root / 'run.json'
    prior_run = json.loads(run_path.read_text(encoding='utf-8')) if args.resume and run_path.exists() else {}
    atomic_write_json(run_path, {'supplier': slug, 'runId': run_id, 'status': 'running', 'phase': resume_phase, 'startedAt': prior_run.get('startedAt') or time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'resumedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()) if args.resume else None})
    print(f'\n== {cfg["name"]} ==')
    while queue and len(seen_requests) < args.max_pages:
        url = queue.popleft(); queued.discard(url)
        if url in seen_requests or not page_allowed(url, cfg): continue
        extension = Path(urlparse(url).path).suffix.lower()
        if extension in SKIP_EXTS: continue
        seen_requests.add(url)
        try:
            response = supplier_fetch(url, page_domains, args.timeout, args.max_response_mb * 1024 * 1024, 'page', args.retries)
        except Exception as error:
            errors.append({'url': url, 'error': str(error)}); print(f'! {url}: {error}', file=sys.stderr)
            checkpoint(checkpoint_path, queue, queued, seen_requests, seen_canonical, pages, assets, errors, run_id)
            continue
        final_url = normalize(response.final_url, url) or url
        if not page_allowed(final_url, cfg):
            errors.append({'url': url, 'finalUrl': final_url, 'error': 'redirect/final URL outside allowed supplier path scope'})
            continue
        if response.content_type == 'application/pdf' or extension == '.pdf':
            if not args.no_download and final_url not in assets and len(assets) < args.max_assets:
                assets[final_url] = save_asset_body(slug, final_url, url, 'document', 'document', response, staging_root)
            checkpoint(checkpoint_path, queue, queued, seen_requests, seen_canonical, pages, assets, errors, run_id)
            continue
        text = decode_html(response.body, response.charset)
        parser = PageParser(cfg.get('asset_role_rules'), cfg.get('excluded_media_region_patterns'))
        api_products = []
        if response.content_type == 'application/json':
            try: api_products = api_json_products(json.loads(text), cfg)
            except json.JSONDecodeError as error: errors.append({'url': final_url, 'error': f'invalid JSON API response: {error}'})
        else:
            parser.feed(text)
        canonical = normalize(parser.canonical, final_url) if parser.canonical else final_url
        if canonical and page_allowed(canonical, cfg): final_url = canonical
        if final_url in seen_canonical:
            checkpoint(checkpoint_path, queue, queued, seen_requests, seen_canonical, pages, assets, errors, run_id); continue
        seen_canonical.add(final_url)
        nodes = product_nodes(parser.jsonld)
        product_data = jsonld_product_data(nodes[0]) if len(nodes) == 1 else {}
        embedded_products = api_products + embedded_caption_products(parser, urlparse(final_url).path, cfg) + embedded_json_products(parser, final_url, cfg)
        for embedded in embedded_products:
            if embedded.get('image'): parser.media.append((embedded['image'], 'image', 'embedded-product'))
        if cfg.get('trust_structured_product_images', True):
            for image in product_data.get('images', []): parser.media.append((image, 'image', 'product-hero'))
        parser.media.extend(magento_gallery_assets(parser.magento_init))
        category = infer_category(final_url, parser, cfg, product_data)
        candidate = (bool(embedded_products) or is_product_candidate(final_url, parser, cfg.get('product_hints', []), product_data, cfg.get('product_path_rules'))) and query_requirements_met(final_url, cfg)
        if candidate and cfg.get('fixed_product_category'): category = cfg['fixed_product_category']
        if candidate and any(re.fullmatch(rule, urlparse(final_url).path, re.I) for rule in cfg.get('reject_product_paths', [])):
            candidate = False
        snapshot_name = f'{len(pages)+1:04d}-{slugify(parser.h1 or parser.title or final_url)}' + ('.json' if response.content_type == 'application/json' else '.html')
        snapshot = snapshot_root / snapshot_name; snapshot.write_text(text, encoding='utf-8', newline='\n')
        page_assets: list[str] = []
        discovered_assets = list(parser.media)
        for href in parser.links:
            if not raw_link_allowed(href, cfg): continue
            link_candidate = normalize(href, final_url)
            if not link_candidate: continue
            is_configured_product_link = any(re.fullmatch(rule, urlparse(link_candidate).path, re.I) for rule in cfg.get('product_path_rules', []))
            if is_configured_product_link and cfg.get('product_link_parent_rules') and not any(re.search(rule, final_url, re.I) for rule in cfg['product_link_parent_rules']): continue
            if cfg.get('skip_nonmatching_product_queries') and is_configured_product_link and not query_requirements_met(link_candidate, cfg): continue
            candidate_extension = Path(urlparse(link_candidate).path).suffix.lower()
            if candidate_extension == '.pdf': discovered_assets.append((link_candidate, 'document', document_role(link_candidate, parser.link_titles.get(href, ''), cfg)))
            elif '/cdn-cgi/' not in urlparse(link_candidate).path and page_allowed(link_candidate, cfg) and candidate_extension not in (SKIP_EXTS | MEDIA_EXTS) and link_candidate not in seen_requests and link_candidate not in queued:
                if any(re.search(pattern, urlparse(link_candidate).path, re.I) for pattern in cfg.get('prioritize_link_patterns', [])):
                    queue.appendleft(link_candidate)
                else:
                    queue.append(link_candidate)
                queued.add(link_candidate)
        asset_candidates: list[dict] = []
        if not args.no_download:
            for order, (raw, kind, role) in enumerate(discovered_assets):
                role = explicit_role(role)
                if not candidate and cfg.get('assets_on_product_pages_only') and kind != 'document' and role not in set(cfg.get('archive_shared_roles', [])): continue
                source_asset_url = normalize(raw, final_url)
                if not source_asset_url or not relevant_asset(source_asset_url, role) or not same_allowed(source_asset_url, asset_domains): continue
                asset_url = rewrite_asset_url(source_asset_url, cfg)
                if not same_allowed(asset_url, asset_domains): continue
                if Path(urlparse(asset_url).path).suffix.lower() in cfg.get('skip_asset_extensions', []): continue
                if asset_url not in {item['url'] for item in asset_candidates}: asset_candidates.append({'url': asset_url, 'source_url': source_asset_url, 'kind': kind, 'role': role, 'order': order})
        pages.append(Page(final_url, parser.title, parser.h1, parser.description, str(snapshot.relative_to(ROOT)), candidate, category, sorted(set(page_assets)), product_data, embedded_products, asset_candidates))
        print(f'{len(pages):4d} {final_url}{" [product]" if candidate else ""}')
        checkpoint(checkpoint_path, queue, queued, seen_requests, seen_canonical, pages, assets, errors, run_id)

    if args.resume and resume_phase != 'page-discovery' and saved_asset_plan.get('plannerVersion') != ASSET_PLANNER_VERSION:
        for page in pages:
            refresh_page_asset_candidates(page, cfg, asset_domains)
            page.assets = []
        for asset in assets.values():
            asset.relationship_evidence = []
            asset.product_ids = []
            asset.collections = []
            asset.scope = 'unassociated'
            asset.relationship_state = 'uncertain/review'
        saved_asset_tasks = []
        saved_asset_plan = {}
    groups: dict[str, list[dict]] = {}
    occurrences_by_url: dict[str, set[str]] = {}
    pages_by_url = {page.url: page for page in pages}
    for page in pages:
        embedded_groups = {normalize(product.get('image'), page.url): f'{page.url}#{product["slug"]}' for product in page.embedded_products if product.get('image')}
        hero_candidates = [item for item in page.asset_candidates if explicit_role(item.get('role')) == 'product-hero']
        first_hero_order = min((item.get('order', 0) for item in hero_candidates), default=None)
        primary_gallery_urls = {item['url'] for item in page.asset_candidates if explicit_role(item.get('role')) == 'product-gallery'}
        page_keys = identity_keys([Path(urlparse(page.url).path.rstrip('/')).stem, page.h1, page.product_data.get('modelNumber')])
        structured_urls = {normalize(url, page.url) for url in page.product_data.get('images', []) if normalize(url, page.url)} if cfg.get('trust_structured_product_images', True) else set()
        for item in page.asset_candidates:
            occurrences_by_url.setdefault(item['url'], set()).add(page.url)
            if not page.is_product_candidate and item['kind'] != 'document' and item['role'] not in set(cfg.get('archive_shared_roles', [])): continue
            candidate_item = dict(item); candidate_item['page_url'] = page.url
            group = embedded_groups.get(item['url'], page.url)
            signals = []
            if urls_identity_match([item['url'], item.get('source_url', item['url'])], page_keys): signals.append('filename-model-match')
            if explicit_role(item.get('role')) == 'product-hero' and item.get('order', 0) == first_hero_order: signals.append('primary-product-hero')
            if item['url'] in primary_gallery_urls: signals.append('primary-product-gallery')
            if cfg.get('trust_structured_product_images', True) and item['url'] in structured_urls: signals.append('structured-product-image')
            candidate_item['group'] = group
            candidate_item['relationship_signals'] = signals
            candidate_item['association_rank'] = 0 if any(signal in signals for signal in ('filename-model-match', 'structured-product-image')) else (1 if any(signal in signals for signal in ('primary-product-hero', 'primary-product-gallery')) else (3 if item['role'] in DOCUMENT_ROLES else 9))
            groups.setdefault(group, []).append(candidate_item)
    asset_plan_error: str | None = None
    try:
        asset_tasks, asset_plan = build_asset_tasks(groups, args.max_assets, saved_asset_tasks if saved_asset_plan.get('plannerVersion') == ASSET_PLANNER_VERSION else None)
    except ValueError as error:
        asset_tasks = []
        asset_plan = saved_asset_plan or {'groups': len(groups), 'selected': 0, 'available': sum(len(items) for items in groups.values()), 'complete': False}
        asset_plan_error = str(error)
        errors.append({'phase': 'asset-planning', 'error': asset_plan_error})
    if saved_asset_plan:
        asset_plan = asset_plan | saved_asset_plan
    asset_aliases, invalid_asset_urls = reconcile_asset_tasks(asset_tasks, assets)
    restore_retryable_task_states(asset_tasks, state.get('assetTasks', []))
    for asset in assets.values():
        observed = set(asset.source_page_urls)
        for url in set([asset.original_asset_url, asset.final_asset_url, *(asset.source_asset_urls or [])]): observed.update(occurrences_by_url.get(url, set()))
        asset.source_page_urls = sorted(observed)
    if invalid_asset_urls:
        invalid_objects = {id(asset_aliases[url]) for url in invalid_asset_urls if url in asset_aliases}
        assets = {key: asset for key, asset in assets.items() if id(asset) not in invalid_objects}
        asset_aliases = {source_url: asset for asset in assets.values() for source_url in (asset.source_asset_urls or [asset.original_asset_url])}
        assets_by_hash = {asset.sha256: asset for asset in assets.values()}
    checkpoint(checkpoint_path, queue, queued, seen_requests, seen_canonical, pages, assets, errors, run_id, phase='asset-download', asset_tasks=asset_tasks, asset_plan=asset_plan)
    for task in asset_tasks:
        page = pages_by_url[task.page_url]
        if task.status in {'validated', 'promoted'} and task.url in asset_aliases:
            asset = asset_aliases[task.url]
            if page.url not in asset.source_page_urls: asset.source_page_urls.append(page.url); asset.source_page_urls.sort()
            if asset.local_path not in page.assets: page.assets.append(asset.local_path)
            continue
        if task.status not in {'pending', 'retryable'}:
            continue
        if args.plan_only:
            continue
        if task.url in asset_aliases:
            asset = asset_aliases[task.url]
            if validate_asset_binary(asset):
                task.status = 'validated'; task.error = None; task.asset_url = asset.original_asset_url; task.validated_at = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                asset.relationship_evidence = sorted(set(asset.relationship_evidence + task.relationship_signals))
                if page.url not in asset.source_page_urls: asset.source_page_urls.append(page.url); asset.source_page_urls.sort()
                if asset.local_path not in page.assets: page.assets.append(asset.local_path)
                checkpoint(checkpoint_path, queue, queued, seen_requests, seen_canonical, pages, assets, errors, run_id, phase='asset-download', asset_tasks=asset_tasks, asset_plan=asset_plan)
                continue
        try:
            task.attempts += 1; task.error = None
            asset_response = supplier_fetch(task.url, asset_domains, args.timeout, args.max_asset_mb * 1024 * 1024, task.kind, args.retries)
            asset = save_asset_body(slug, task.source_url, page.url, task.kind, task.role, asset_response, staging_root)
            if task.url not in asset.source_asset_urls: asset.source_asset_urls.append(task.url)
            asset.relationship_evidence = sorted(set(asset.relationship_evidence + task.relationship_signals))
            task.status = 'downloaded'; task.asset_url = asset.original_asset_url; task.downloaded_at = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            assets[task.url] = asset
            checkpoint(checkpoint_path, queue, queued, seen_requests, seen_canonical, pages, assets, errors, run_id, phase='asset-download', asset_tasks=asset_tasks, asset_plan=asset_plan)
            if not validate_asset_binary(asset):
                raise ValueError('downloaded asset failed checksum/size validation')
            duplicate = next((existing for digest, existing in assets_by_hash.items() if digest == asset.sha256 and existing is not asset), None)
            if duplicate:
                assets.pop(task.url, None)
                asset = merge_duplicate_asset(duplicate, asset)
            else:
                assets_by_hash[asset.sha256] = asset
            asset_aliases[task.url] = asset
            for source_url in asset.source_asset_urls: asset_aliases[source_url] = asset
            task.status = 'validated'; task.validated_at = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            if asset.local_path not in page.assets: page.assets.append(asset.local_path)
        except Exception as error:
            task.status = 'retryable'; task.error = str(error)
            errors.append({'url': task.url, 'page': page.url, 'phase': 'asset-download', 'retryable': True, 'error': str(error)})
        checkpoint(checkpoint_path, queue, queued, seen_requests, seen_canonical, pages, assets, errors, run_id, phase='asset-download', asset_tasks=asset_tasks, asset_plan=asset_plan)
    attach_available_asset_occurrences(pages, asset_aliases)
    incomplete_asset_tasks = [task for task in asset_tasks if task.status in {'pending', 'downloaded', 'retryable'}]

    products = []
    ids: set[str] = set(); routes: set[tuple[str, str]] = set(); structural_errors = []
    for page in pages:
        if not page.is_product_candidate: continue
        page_path = urlparse(page.url).path
        if any(re.fullmatch(rule, page_path, re.I) for rule in cfg.get('reject_product_paths', [])): continue
        if page.embedded_products:
            for embedded in page.embedded_products:
                product_slug = embedded['slug']; product_id = f'{slug}:{product_slug}'; route = (slug, product_slug)
                if product_id in ids or route in routes:
                    structural_errors.append({'url': page.url, 'error': f'duplicate product identity {product_id}'}); continue
                ids.add(product_id); routes.add(route)
                embedded_url = normalize(embedded.get('image'), page.url) if embedded.get('image') else None
                embedded_assets = [asset.local_path for asset in assets.values() if embedded_url and embedded_url in (asset.source_asset_urls or [asset.original_asset_url])]
                synthetic = Page(page.url, page.title, page.h1, page.description, page.snapshot, True, page.category, embedded_assets, {'modelNumber': embedded['modelNumber']})
                media, documents = product_asset_paths(synthetic, assets, cfg.get('attach_page_roles'))
                products.append({'id': product_id, 'manufacturer': slug, 'slug': product_slug, 'name': embedded['name'], 'category': page.category, 'collection': embedded['collection'], 'modelNumber': embedded['modelNumber'], 'type': None, 'summary': None, 'sourceDescription': embedded.get('description'), 'sourceUrl': embedded.get('sourceUrl') or page.url, '_associationPageUrl': page.url, 'sourceType': 'live-crawl', 'media': media, 'documents': documents, 'specifications': {}, 'lastVerified': time.strftime('%Y-%m-%d')})
            continue
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
        use_path_name = cfg.get('name_from_path') or any(re.fullmatch(pattern, page_path, re.I) for pattern in cfg.get('name_from_path_patterns', []))
        path_name = Path(page_path.rstrip('/')).name.replace('-', ' ').title() if use_path_name else ''
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
        media, documents = product_asset_paths(page, assets, cfg.get('attach_page_roles'), [product_slug, model_number, name], cfg.get('trust_structured_product_images', True), cfg.get('trust_product_open_graph_images', False))
        products.append({'id': product_id, 'manufacturer': slug, 'slug': product_slug, 'name': name, 'category': identity.get('category') or page.category, 'collection': identity.get('collection'), 'modelNumber': model_number, 'type': identity.get('type'), 'summary': None, 'sourceDescription': page.product_data.get('description') or (None if cfg.get('ignore_page_description') else page.description) or None, 'sourceUrl': page.url, 'sourceType': 'live-crawl', 'media': media, 'documents': documents, 'specifications': page.product_data.get('specifications', {}), 'lastVerified': time.strftime('%Y-%m-%d')})
    errors.extend(structural_errors)
    enforce_filename_owner_precedence(assets, products)
    enforce_wordpress_master_precedence(assets, products)
    apply_document_relationship_rules(assets, products, cfg.get('document_product_rules'))
    apply_asset_relationship_rules(assets, products, cfg.get('asset_product_rules'))
    associate_assets(assets, products)
    for product in products: product.pop('_associationPageUrl', None)
    if args.plan_only:
        preview = {'supplier': slug, 'runId': run_id, 'phase': 'asset-planned', 'assetPlan': asset_plan, 'assetStates': {state: sum(task.status == state for task in asset_tasks) for state in sorted(ASSET_TASK_STATES)}, 'products': products, 'assets': [asdict(asset) for asset in assets.values()], 'errors': errors}
        atomic_write_json(staging_root / 'relationship-preview.json', preview)
        atomic_write_json(staging_root / 'run.json', {'supplier': slug, 'runId': run_id, 'status': 'planned', 'phase': 'asset-planned', 'assetPlan': asset_plan, 'assetStates': preview['assetStates']})
        checkpoint(checkpoint_path, queue, queued, seen_requests, seen_canonical, pages, assets, errors, run_id, phase='asset-planned', asset_tasks=asset_tasks, asset_plan=asset_plan)
        print(f'Planned {len(asset_tasks)} unique asset requests; {sum(task.status == "validated" for task in asset_tasks)} validated binaries reused; no network asset requests made.')
        return preview, True
    viable = bool(pages) and bool(products) and not structural_errors and not asset_plan_error and not incomplete_asset_tasks
    if viable:
        try: validate_product_records(products, cfg)
        except ValueError as error: errors.append({'error': str(error)}); viable = False
    accepted_assets: dict[str, Asset] = {}
    if viable:
        try:
            accepted_assets = promote_referenced_assets(assets, products, pages)
            accepted_ids = {id(asset) for asset in accepted_assets.values()}
            promoted_at = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            for task in asset_tasks:
                asset = asset_aliases.get(task.url) or (asset_aliases.get(task.asset_url) if task.asset_url else None)
                if asset and id(asset) in accepted_ids:
                    task.status = 'promoted'; task.promoted_at = promoted_at
                elif task.status == 'validated':
                    task.status = 'rejected'; task.error = 'validated asset was not referenced by an accepted product/shared role'
            checkpoint(checkpoint_path, queue, queued, seen_requests, seen_canonical, pages, assets, errors, run_id, phase='promotion-complete', asset_tasks=asset_tasks, asset_plan=asset_plan)
        except Exception as error:
            errors.append({'error': f'asset promotion failed: {error}'}); viable = False
    crawled_at = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    result = {'supplier': {key: cfg[key] for key in ('slug', 'name', 'base_url', 'categories')}, 'crawledAt': crawled_at, 'pages': [manifest_page(page) for page in pages], 'assets': [manifest_asset(asset) for asset in accepted_assets.values()], 'products': products, 'errors': errors}
    if viable and args.no_download:
        atomic_write_json(MANIFEST_ROOT / f'{slug}.discovery.json', result)
        atomic_write_json(staging_root / 'run.json', {'supplier': slug, 'runId': run_id, 'status': 'discovery-only', 'finishedAt': crawled_at, 'discoveredProducts': len(products), 'downloadedAssets': 0, 'promotedAssets': 0, 'quarantinedAssets': 0})
        checkpoint_path.unlink(missing_ok=True)
    elif viable:
        atomic_write_json(MANIFEST_ROOT / f'{slug}.json', result)
        atomic_write_json(CATALOG_DIR / f'{slug}.json', products)
        write_supplier_archive(slug, accepted_assets)
        atomic_write_json(staging_root / 'run.json', {'supplier': slug, 'runId': run_id, 'status': 'accepted', 'phase': 'promotion-complete', 'finishedAt': crawled_at, 'downloadedAssets': len(assets), 'promotedAssets': len(accepted_assets), 'quarantinedAssets': len(assets) - len(accepted_assets), 'assetPlan': asset_plan, 'assetStates': {state: sum(task.status == state for task in asset_tasks) for state in sorted(ASSET_TASK_STATES)}})
        atomic_write_json(staging_root / 'asset-task-index.json', {'supplier': slug, 'runId': run_id, 'plannerVersion': ASSET_PLANNER_VERSION, 'tasks': [asdict(task) for task in asset_tasks]})
        checkpoint_path.unlink(missing_ok=True)
    else:
        quarantined_result = result | {'assets': [asdict(asset) for asset in assets.values()]}
        atomic_write_json(staging_root / 'run-manifest.json', quarantined_result)
        atomic_write_json(staging_root / 'run.json', {'supplier': slug, 'runId': run_id, 'status': 'failed', 'phase': 'asset-download' if incomplete_asset_tasks else 'validation', 'finishedAt': crawled_at, 'downloadedAssets': len(assets), 'promotedAssets': 0, 'quarantinedAssets': len(assets), 'assetPlan': asset_plan, 'assetStates': {state: sum(task.status == state for task in asset_tasks) for state in sorted(ASSET_TASK_STATES)}})
        print(f'! Preserved last-known-good catalogue and manifest for {slug}: crawl produced no validated products', file=sys.stderr)
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
    parser.add_argument('--plan-only', action='store_true', help='Rebuild and persist an asset plan from saved pages without making asset requests or promoting output')
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
