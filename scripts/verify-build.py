#!/usr/bin/env python3
from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urldefrag, urlparse

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
SITE_HOST = 'windowreplacement.pro'


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links: list[str] = []
        self.canonicals: list[str] = []
        self.noindex = False

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'a' and values.get('href'): self.links.append(values['href'])
        if tag == 'link' and 'canonical' in str(values.get('rel', '')).lower() and values.get('href'): self.canonicals.append(values['href'])
        if tag == 'meta' and str(values.get('name', '')).lower() == 'robots' and 'noindex' in str(values.get('content', '')).lower(): self.noindex = True


def route_for_file(path: Path) -> str:
    relative = path.relative_to(DIST).as_posix()
    if relative == 'index.html': return '/'
    if relative.endswith('/index.html'): return '/' + relative[:-10]
    return '/' + relative


def file_for_route(route: str) -> Path:
    clean = route.lstrip('/')
    if not clean: return DIST / 'index.html'
    if route.endswith('/'): return DIST / clean / 'index.html'
    return DIST / clean


def main() -> int:
    errors: list[str] = []
    index_path = DIST / 'sitemap-index.xml'
    if not index_path.is_file():
        print('ERROR: sitemap-index.xml is missing', file=sys.stderr)
        return 1
    namespace = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
    index = ET.parse(index_path)
    sitemap_urls = [node.text for node in index.findall('.//sm:loc', namespace) if node.text]
    pages: list[str] = []
    for sitemap_url in sitemap_urls:
        child = DIST / Path(urlparse(sitemap_url).path).name
        if not child.is_file():
            errors.append(f'sitemap child is missing: {child.name}'); continue
        tree = ET.parse(child)
        pages.extend(node.text for node in tree.findall('.//sm:loc', namespace) if node.text)
    if len(pages) != len(set(pages)): errors.append('sitemap contains duplicate URLs')

    sitemap_paths = {urlparse(url).path for url in pages}
    html_files = sorted(path for path in DIST.rglob('*.html') if '.prerender' not in path.parts)
    parsed_pages: dict[str, LinkParser] = {}
    for path in html_files:
        route = route_for_file(path)
        parser = LinkParser(); parser.feed(path.read_text(encoding='utf-8'))
        parsed_pages[route] = parser
        if len(parser.canonicals) != 1: errors.append(f'{route}: expected exactly one canonical link')
        if parser.noindex and route in sitemap_paths: errors.append(f'{route}: noindex page leaked into sitemap')
        if not parser.noindex and route != '/404.html' and route not in sitemap_paths: errors.append(f'{route}: indexable page missing from sitemap')
        for href in parser.links:
            href = urldefrag(href)[0]
            if not href or href.startswith(('mailto:', 'tel:', 'javascript:')): continue
            parsed = urlparse(href)
            if parsed.scheme and parsed.hostname != SITE_HOST: continue
            target_route = parsed.path or '/'
            target = file_for_route(target_route)
            if not target.is_file(): errors.append(f'{route}: broken internal link {href}')

    for path in sitemap_paths:
        if not file_for_route(path).is_file(): errors.append(f'sitemap URL has no generated file: {path}')
    product_routes = [route for route in parsed_pages if route.startswith('/products/')]
    brand_routes = [route for route in parsed_pages if route.startswith('/brands')]
    allowed_product_categories = {'windows', 'entry-doors', 'door-glass', 'patio-doors'}
    if brand_routes: errors.append(f'public brand routes remain: {len(brand_routes)}')
    if len(product_routes) != 4: errors.append(f'expected 4 identity-approved product routes, found {len(product_routes)}')
    for route in product_routes:
        parts = route.strip('/').split('/')
        if len(parts) != 3 or parts[1] not in allowed_product_categories:
            errors.append(f'invalid supplier-neutral product route: {route}')
    print(f'Generated HTML routes: {len(html_files)}')
    print(f'Sitemap URLs: {len(sitemap_paths)}')
    print(f'Public identity-approved product routes: {len(product_routes)}')
    if errors:
        print(f'Build validation: FAILED ({len(errors)} error(s))', file=sys.stderr)
        for error in errors: print(f'ERROR: {error}', file=sys.stderr)
        return 1
    print('Build validation: OK')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
