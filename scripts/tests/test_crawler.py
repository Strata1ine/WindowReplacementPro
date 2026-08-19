#!/usr/bin/env python3
import unittest

from scripts.ingest.crawl import (
    PageParser,
    decode_html,
    infer_category,
    is_product_candidate,
    jsonld_product_data,
    normalize,
    product_nodes,
    validate_product_records,
)


class CrawlerSafetyTests(unittest.TestCase):
    def test_generic_homepage_is_not_a_product(self):
        parser = PageParser(); parser.feed('<html><title>Windows and Doors</title><h1>Our Products</h1></html>')
        self.assertFalse(is_product_candidate('https://example.com/', parser, ['product', 'window'], {}))

    def test_exact_supplier_path_rule_can_accept_a_detail_page(self):
        parser = PageParser(); parser.feed('<title>Casement Windows</title><h1>Casement</h1>')
        self.assertTrue(is_product_candidate('https://example.com/windows/casement/', parser, [], {}, [r'^/windows/casement/?$']))

    def test_supplier_asset_role_rule_is_scoped_to_parser_instance(self):
        parser = PageParser([{'role': 'hero', 'patterns': [r'\bcapri\b']}])
        parser.feed('<img class="capri" src="product.jpg"><img class="brand" src="logo.png">')
        self.assertEqual([('product.jpg', 'image', 'hero'), ('logo.png', 'image', 'generic')], parser.media)

    def test_img_src_does_not_duplicate_responsive_renditions(self):
        parser = PageParser()
        parser.feed('<img class="hero" src="original.jpg" srcset="small.jpg 500w, large.jpg 1000w">')
        self.assertEqual([('original.jpg', 'image', 'hero')], parser.media)
        self.assertFalse(is_product_candidate('https://example.com/windows/', parser, [], {}, [r'^/windows/casement/?$']))

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


if __name__ == '__main__':
    unittest.main()
