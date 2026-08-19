#!/usr/bin/env python3
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.ingest.cleanup import scan_staging_runs

from scripts.ingest.crawl import (
    Asset,
    PageParser,
    decode_html,
    embedded_caption_products,
    embedded_json_products,
    fair_asset_candidates,
    infer_category,
    is_product_candidate,
    jsonld_product_data,
    normalize,
    product_nodes,
    promote_referenced_assets,
    query_requirements_met,
    validate_product_records,
)


class CrawlerSafetyTests(unittest.TestCase):
    def test_generic_homepage_is_not_a_product(self):
        parser = PageParser(); parser.feed('<html><title>Windows and Doors</title><h1>Our Products</h1></html>')
        self.assertFalse(is_product_candidate('https://example.com/', parser, ['product', 'window'], {}))

    def test_exact_supplier_path_rule_can_accept_a_detail_page(self):
        parser = PageParser(); parser.feed('<title>Casement Windows</title><h1>Casement</h1>')
        self.assertTrue(is_product_candidate('https://example.com/windows/casement/', parser, [], {}, [r'^/windows/casement/?$']))
        self.assertFalse(is_product_candidate('https://example.com/windows/', parser, [], {}, [r'^/windows/casement/?$']))

    def test_supplier_asset_role_rule_is_scoped_to_parser_instance(self):
        parser = PageParser([{'role': 'hero', 'patterns': [r'\bcapri\b']}])
        parser.feed('<img class="capri" src="product.jpg"><img class="brand" src="logo.png">')
        self.assertEqual([('product.jpg', 'image', 'hero'), ('logo.png', 'image', 'generic')], parser.media)

    def test_img_src_does_not_duplicate_responsive_renditions(self):
        parser = PageParser()
        parser.feed('<img class="hero" src="original.jpg" srcset="small.jpg 500w, large.jpg 1000w">')
        self.assertEqual([('original.jpg', 'image', 'hero')], parser.media)

    def test_supplier_scoped_embedded_caption_products(self):
        parser = PageParser([{'role': 'gallery', 'patterns': [r'/WG[A-Z0-9]{2,3}(?:[-_.]|$)']}])
        parser.feed('<div data-description="&lt;strong&gt;2 Panel&lt;/strong&gt;&lt;br&gt;WG25"><img src="https://cdn.example/WG25-door.jpg"></div>')
        config = {'embedded_product_collections': {'/oak': 'Oak'}, 'embedded_product_model_pattern': r'\bWG[A-Z0-9]{2,3}\b'}
        self.assertEqual(embedded_caption_products(parser, '/other', config), [])
        self.assertEqual(embedded_caption_products(parser, '/oak', config)[0]['modelNumber'], 'WG25')
        self.assertEqual(parser.media[0][2], 'gallery')

    def test_supplier_scoped_embedded_json_products(self):
        parser = PageParser(); parser.feed('<div data-json="{&quot;productResults&quot;:{&quot;products&quot;:[{&quot;sku&quot;:&quot;DR-1&quot;,&quot;name&quot;:&quot;4 Panel ¼ Lite&quot;,&quot;image&quot;:{&quot;defaultSrc&quot;:&quot;https://cdn.example/door.webp&quot;}}]}}"></div>')
        config = {'embedded_json_product_paths': ['/doors/exterior'], 'embedded_slug_aliases': {'4-panel-lite': '4-panel-1-4-lite'}}
        self.assertEqual(embedded_json_products(parser, '/doors/interior', config), [])
        product = embedded_json_products(parser, '/doors/exterior/', config)[0]
        self.assertEqual((product['slug'], product['modelNumber']), ('4-panel-1-4-lite', 'DR-1'))

    def test_asset_provenance_schema_includes_final_url(self):
        fields = Asset.__dataclass_fields__
        self.assertIn('original_asset_url', fields)
        self.assertIn('final_asset_url', fields)

    def test_jsonld_product_is_classified_and_extracted(self):
        parser = PageParser()
        parser.feed('<html><title>Model 100</title><h1>Model 100 Casement</h1><script type="application/ld+json">{"@type":"Product","name":"Model 100","model":"M-100","description":"High performance window","additionalProperty":{"name":"Glazing","value":"Triple pane"}}</script></html>')
        nodes = product_nodes(parser.jsonld); data = jsonld_product_data(nodes[0])
        self.assertTrue(is_product_candidate('https://example.com/products/casement/model-100', parser, ['/products/'], data))
        self.assertEqual(data['modelNumber'], 'M-100')
        self.assertEqual(data['specifications'], {'Glazing': 'Triple pane'})

    def test_multi_category_supplier_can_be_unclassified(self):
        parser = PageParser(); parser.feed('<title>About our company</title><h1>About</h1>')
        config = {'categories': ['windows', 'entry-doors'], 'category_rules': []}
        self.assertEqual(infer_category('https://example.com/about', parser, config, {}), 'unclassified')

    def test_encoding_and_canonical_normalization(self):
        self.assertIn('–', decode_html('Products – Canada'.encode('windows-1252'), 'windows-1252'))
        self.assertEqual(normalize('/model?utm_source=x&b=2&a=1#details', 'https://EXAMPLE.com/'), 'https://example.com/model?a=1&b=2')

    def test_supplier_output_validation_rejects_wrong_manufacturer(self):
        config = {'slug': 'supplier', 'categories': ['windows'], 'allowed_domains': ['example.com']}
        product = {'id': 'other:model', 'manufacturer': 'other', 'slug': 'model', 'name': 'Model', 'category': 'windows', 'sourceUrl': 'https://example.com/model', 'sourceType': 'live-crawl', 'lastVerified': '2026-08-19', 'media': [], 'documents': [], 'specifications': {}}
        with self.assertRaisesRegex(ValueError, 'wrong supplier'):
            validate_product_records([product], config)

    def test_required_product_query_is_supplier_scoped(self):
        config = {'required_product_query': {'UILanguage': 'EN'}}
        self.assertTrue(query_requirements_met('https://example.com/product.php?ProductID=1&UILanguage=EN', config))
        self.assertFalse(query_requirements_met('https://example.com/product.php?ProductID=1&UILanguage=FR', config))
        self.assertTrue(query_requirements_met('https://example.com/product.php?ProductID=1', {}))

    def test_fair_asset_scheduling_reaches_late_products(self):
        groups = {
            'early': [
                {'url': 'https://example.com/early-hero.jpg', 'role': 'hero', 'order': 0},
                {'url': 'https://example.com/early-gallery.jpg', 'role': 'gallery', 'order': 1},
            ],
            'late': [{'url': 'https://example.com/late-hero.jpg', 'role': 'hero', 'order': 0}],
        }
        selected = fair_asset_candidates(groups, 2)
        self.assertEqual([item['url'] for item in selected], ['https://example.com/early-hero.jpg', 'https://example.com/late-hero.jpg'])

    def test_successful_promotion_excludes_unrelated_staging_assets(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            accepted_stage = root / 'source-media/staging/supplier/run/public/images/catalog/supplier/accepted.jpg'
            unrelated_stage = root / 'source-media/staging/supplier/run/public/images/catalog/supplier/unrelated.jpg'
            accepted_stage.parent.mkdir(parents=True); accepted_stage.write_bytes(b'accepted'); unrelated_stage.write_bytes(b'unrelated')
            accepted = Asset('supplier', ['https://example.com/a'], 'https://example.com/accepted.jpg', 'https://example.com/accepted.jpg', '/images/catalog/supplier/accepted.jpg', 'image', 'hero', __import__('hashlib').sha256(b'accepted').hexdigest(), 8, 'now', str(accepted_stage.relative_to(root)))
            unrelated = Asset('supplier', ['https://example.com/a'], 'https://example.com/unrelated.jpg', 'https://example.com/unrelated.jpg', '/images/catalog/supplier/unrelated.jpg', 'image', 'gallery', __import__('hashlib').sha256(b'unrelated').hexdigest(), 9, 'now', str(unrelated_stage.relative_to(root)))
            products = [{'media': [accepted.local_path], 'documents': []}]
            with patch('scripts.ingest.crawl.ROOT', root):
                promoted = promote_referenced_assets({'accepted': accepted, 'unrelated': unrelated}, products, [])
            self.assertEqual(list(promoted), ['accepted'])
            self.assertTrue((root / 'public/images/catalog/supplier/accepted.jpg').exists())
            self.assertTrue(unrelated_stage.exists())

    def test_failed_staging_run_is_preserved_until_explicit_cleanup(self):
        with tempfile.TemporaryDirectory() as temp:
            staging = Path(temp) / 'staging'; run = staging / 'supplier' / 'run-1'; run.mkdir(parents=True)
            (run / 'run.json').write_text(json.dumps({'supplier': 'supplier', 'runId': 'run-1', 'status': 'failed'}), encoding='utf-8')
            quarantined = run / 'asset.jpg'; quarantined.write_bytes(b'failed-run-asset')
            candidates, ambiguous = scan_staging_runs(staging, references='')
            self.assertEqual((len(candidates), ambiguous), (1, []))
            self.assertTrue(quarantined.exists())

    def test_trimlite_does_not_attach_every_related_hero(self):
        suppliers = json.loads((Path(__file__).parents[1] / 'ingest' / 'suppliers.json').read_text(encoding='utf-8'))
        trimlite = next(item for item in suppliers if item['slug'] == 'trimlite')
        self.assertEqual(trimlite.get('attach_page_roles'), [])

if __name__ == '__main__':
    unittest.main()
