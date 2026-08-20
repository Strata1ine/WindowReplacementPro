#!/usr/bin/env python3
import json
import hashlib
import tempfile
import unittest
from pathlib import Path
from dataclasses import asdict
from unittest.mock import patch

from PIL import Image
import scripts.ingest.fliphtml5_extract as fliphtml5

from scripts.ingest.cleanup import scan_staging_runs
from scripts.ingest.pdf_evidence import configured_document_metadata, configured_page_products
from scripts.ingest.pdf_ocr import ocr_pdf_pages
from scripts.ingest.pdf_extract import repair_extracted_text
from scripts.ingest.reassociate import recover_downloaded_candidates, relationship_page_for_product

from scripts.ingest.crawl import (
    Asset,
    AssetTask,
    FetchResponse,
    Page,
    PageParser,
    api_json_products,
    apply_asset_relationship_rules,
    apply_document_relationship_rules,
    associate_assets,
    attach_available_asset_occurrences,
    build_asset_tasks,
    clear_resolved_asset_errors,
    configured_unseen_start_urls,
    configured_source_products,
    decode_html,
    embedded_caption_products,
    embedded_json_products,
    enforce_filename_owner_precedence,
    enforce_wordpress_master_precedence,
    fair_asset_candidates,
    identity_keys,
    infer_category,
    is_product_candidate,
    jsonld_product_data,
    document_role,
    magento_gallery_assets,
    merge_duplicate_asset,
    normalize,
    page_allowed,
    product_asset_paths,
    promote_identity_matched_gallery_heroes,
    product_nodes,
    promote_referenced_assets,
    query_requirements_met,
    raw_link_allowed,
    reconcile_asset_tasks,
    refresh_page_asset_candidates,
    restore_retryable_task_states,
    rewrite_asset_url,
    save_asset_body,
    urls_identity_match,
    validate_product_records,
    wordpress_master_candidate,
)


class CrawlerSafetyTests(unittest.TestCase):
    def test_pdf_text_repairs_common_utf8_cp1252_mojibake(self):
        mojibake = '6\u00e2\u20ac\u21228\u00e2\u20ac\u00b3'
        self.assertEqual(repair_extracted_text(mojibake), '6\u20198\u2033')
        self.assertEqual(repair_extracted_text('Already clean'), 'Already clean')
    def test_pdf_viewer_iframe_exposes_underlying_document_without_crawling_viewer(self):
        parser = PageParser()
        parser.feed('<iframe src="https://example.com/viewer.html?file=https%3A%2F%2Fexample.com%2Fcurrent.pdf"></iframe>')
        self.assertEqual(parser.links, ['https://example.com/current.pdf'])
    def test_supplier_document_role_override_precedes_generic_catalogue_name(self):
        config = {'document_role_rules': [{'patterns': [r'catalogue-model-drawing'], 'role': 'specification-sheet'}]}
        self.assertEqual(document_role('https://example.com/Catalogue-Model-Drawing.pdf', cfg=config), 'specification-sheet')

    def test_mennie_drawing_pdf_is_not_misclassified_as_catalogue(self):
        suppliers = json.loads((Path(__file__).parents[1] / 'ingest' / 'suppliers.json').read_text(encoding='utf-8'))
        config = next(item for item in suppliers if item['slug'] == 'mennie-canada')
        url = 'https://menniecanada.com/uploads/Mennie-Canada-Catalogue-CR-6-Panel-Craftsman.pdf'
        self.assertEqual(document_role(url, cfg=config), 'specification-sheet')

    def test_mennie_numeric_model_filename_remains_product_gallery(self):
        suppliers = json.loads((Path(__file__).parents[1] / 'ingest' / 'suppliers.json').read_text(encoding='utf-8'))
        config = next(item for item in suppliers if item['slug'] == 'mennie-canada')
        parser = PageParser(config['asset_role_rules'])
        parser.feed('<img class="wp-image-123" src="https://menniecanada.com/uploads/sm-bg-1843.jpg">')
        self.assertEqual(parser.media[0][2], 'product-gallery')

    def test_generic_flush_term_does_not_create_mennie_product_identity(self):
        product_keys = identity_keys(['wg-f', 'WG-F', '6 ft 8 in Oak Grain Flush Panel (WG-F)'])
        self.assertFalse(urls_identity_match(['https://menniecanada.com/uploads/68-flush.jpg'], product_keys))
        self.assertTrue(urls_identity_match(['https://menniecanada.com/uploads/WG-F.jpg'], product_keys))

    def test_wordpress_scaled_master_preserves_model_identity(self):
        product_keys = identity_keys(['mah-ss8', 'MAH-SS8'])
        self.assertTrue(urls_identity_match(['https://example.com/wp-content/uploads/MAH-SS8-scaled.webp'], product_keys))

    def test_identity_matched_gallery_promotes_only_one_product_hero(self):
        asset = Asset('supplier', [], 'https://example.com/SM-CR.jpg', 'https://example.com/SM-CR.jpg', '/images/sm-cr.jpg', 'image', 'product-gallery', 'hash', 1, 'now', source_asset_urls=['https://example.com/SM-CR.jpg'])
        products = [
            {'slug': 'sm-cr', 'modelNumber': 'SM-CR', 'name': 'Smooth SM-CR'},
            {'slug': 'sm-rp', 'modelNumber': 'SM-RP', 'name': 'Smooth SM-RP'},
        ]
        promote_identity_matched_gallery_heroes({'asset': asset}, products, True)
        self.assertEqual(asset.role, 'product-hero')
        self.assertIn('supplier-scoped-hero-promotion', asset.relationship_evidence)
    def test_verre_fliphtml5_product_crops_have_unique_reviewed_page_relationships(self):
        config_path = Path(__file__).resolve().parents[2] / 'scripts' / 'ingest' / 'publications' / 'verre-select-2026.json'
        config = json.loads(config_path.read_text(encoding='utf-8'))
        cropped = [page for page in config['pages'] if page.get('cropBox')]
        self.assertEqual(len(cropped), 23)
        self.assertEqual(len({page['pageNumber'] for page in cropped}), 23)
        product_ids = [page['productIds'][0] for page in cropped]
        self.assertEqual(len(set(product_ids)), 23)
        self.assertIn('verre-select:satine', product_ids)
        self.assertTrue(all(len(page['productIds']) == 1 for page in cropped))
        self.assertTrue(all(page['relationshipState'] == 'product-specific' for page in cropped))
        technical = [page for page in config['pages'] if page.get('assetRole') in {'configuration-diagram', 'colour-chart', 'profile-section', 'technical-drawing'}]
        self.assertTrue(all(not page['productIds'] for page in technical))
    def test_verre_fliphtml5_page_assets_preserve_required_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            image_path = root / 'page.webp'
            Image.new('RGB', (4, 6), 'white').save(image_path, 'WEBP')
            manifest = {
                'supplier': 'verre-select',
                'publicationTitle': 'Verre Test Publication',
                'publicationSourceUrl': 'https://online.fliphtml5.com/example/book/',
                'publicationYear': 2026,
                'viewerCreatedUtc': '2026-01-01T00:00:00+00:00',
                'extractionTimestamp': '2026-01-02T00:00:00+00:00',
                'pageAssetSelection': {'selectedFormat': 'webp'},
                'textLayer': {'available': False, 'pageCount': 0},
                'pages': [{
                    'supplier': 'verre-select',
                    'publicationTitle': 'Verre Test Publication',
                    'publicationSourceUrl': 'https://online.fliphtml5.com/example/book/',
                    'pageNumber': 1,
                    'underlyingAssetUrl': 'https://online.fliphtml5.com/example/book/files/large/page.webp',
                    'localPath': 'page.webp',
                    'sha256': hashlib.sha256(image_path.read_bytes()).hexdigest(),
                    'width': 4,
                    'height': 6,
                    'extractedAt': '2026-01-02T00:00:00+00:00',
                }],
            }
            config = {
                'supplier': 'verre-select',
                'supplierName': 'Verre Select',
                'publicationManifest': 'manifest.json',
                'pages': [],
            }
            manifest_path = root / 'manifest.json'
            config_path = root / 'config.json'
            manifest_path.write_text(json.dumps(manifest), encoding='utf-8')
            config_path.write_text(json.dumps(config), encoding='utf-8')
            with patch.object(fliphtml5, 'ROOT', root), patch.object(fliphtml5, 'AUDIT_ROOT', root / 'audit'):
                fliphtml5.extract(config_path)
            page = json.loads(manifest_path.read_text(encoding='utf-8'))['pages'][0]
            required = {
                'supplier', 'supplierName', 'publicationTitle', 'publicationSourceUrl',
                'pageNumber', 'underlyingAssetUrl', 'localPath', 'sha256', 'width',
                'height', 'extractionTimestamp', 'associatedProducts', 'assetRole',
            }
            self.assertTrue(required <= page.keys())
            self.assertEqual(page['supplierName'], 'Verre Select')
            self.assertEqual(page['extractionTimestamp'], '2026-01-02T00:00:00+00:00')
    def test_configured_publication_product_is_normalized_and_held_outside_page_discovery(self):
        config = {
            'slug': 'supplier',
            'source_products': [{
                'slug': 'satine',
                'name': 'Satine',
                'category': 'door-glass',
                'sourceUrl': 'https://example.com/brochures',
                'specifications': {'publicationPage': '24'},
            }],
        }
        products = configured_source_products(config, '2026-08-20')
        self.assertEqual(products[0]['id'], 'supplier:satine')
        self.assertEqual(products[0]['sourceType'], 'supplier-publication')
        self.assertEqual(products[0]['specifications']['publicationPage'], '24')
        self.assertEqual(products[0]['media'], [])
    def test_offline_reassociation_replays_embedded_caption_image_mapping(self):
        url = 'https://cdn.example/BlackBrushFull.png'
        asset = Asset('richersons', [], url, url, '/images/black.png', 'image', 'product-gallery', 'hash', 1, 'now', source_asset_urls=[url])
        page = Page('https://www.richersonsdoors.com/flush-glazed', '', '', '', '', True, 'entry-doors', [], {}, [{'modelNumber': 'BK10', 'images': [url], 'image': url}], [])
        product = {'modelNumber': 'BK10'}
        relationship_page = relationship_page_for_product(page, product, {'asset': asset})
        self.assertEqual(relationship_page.assets, ['/images/black.png'])
        self.assertEqual(relationship_page.product_data['images'], [url])
        self.assertEqual(asset.role, 'product-hero')
        self.assertIn('embedded-caption-model-association', asset.relationship_evidence)

    def test_offline_reassociation_upgrades_inferred_gallery_to_configured_hero(self):
        url = 'https://example.com/userfiles/productimages/product_867.jpg'
        asset = Asset('supplier', [], url, url, '/images/product-867.jpg', 'image', 'product-gallery', 'hash', 1, 'now', source_asset_urls=[url])
        page = Page('https://example.com/product.php?id=867', '', 'Paris', '', '', True, 'door-glass', [], {}, asset_candidates=[{'url': url, 'source_url': url, 'kind': 'image', 'role': 'product-hero', 'order': 0}])
        recovered = recover_downloaded_candidates('supplier', [page], {url: asset}, None)
        self.assertEqual(recovered, 0)
        self.assertEqual(asset.role, 'product-hero')
    def test_reviewed_pdf_document_metadata_overrides_inferred_freshness(self):
        rules = [{
            'patterns': [r'consumerbook2022.*\.pdf$'],
            'document_metadata': {
                'title': 'Window City 2022/2023 Consumer Book',
                'documentDate': '2022-01-01',
                'freshnessStatus': 'historical-superseded',
            },
        }]
        metadata = configured_document_metadata(Path('consumerbook2022-hash.pdf'), rules)
        self.assertEqual(metadata['freshnessStatus'], 'historical-superseded')
        self.assertEqual(configured_document_metadata(Path('other.pdf'), rules), {})

    def test_richersons_pdf_mapping_uses_reviewed_current_model_evidence(self):
        suppliers = json.loads((Path(__file__).parents[1] / 'ingest' / 'suppliers.json').read_text(encoding='utf-8'))
        config = next(item for item in suppliers if item['slug'] == 'richersons')
        rules = config['pdf_evidence_rules']
        full_line = Path('richersons-full-line-apr2025-c7c105cf37d9.pdf')
        contemporary = Path('richersons2022-23-contemporary-7a90ef29b614.pdf')
        self.assertEqual(
            configured_page_products(full_line, 23, rules),
            ['richersons:fg30', 'richersons:sg30', 'richersons:sg3j'],
        )
        self.assertNotIn('richersons:wg3j', configured_page_products(full_line, 23, rules))
        self.assertEqual(configured_page_products(contemporary, 2, rules), [])
        self.assertEqual(configured_document_metadata(full_line, rules)['freshnessStatus'], 'current-source-linked')
    def test_reviewed_pdf_page_mapping_overrides_generic_name_matching(self):
        rules = [{
            'patterns': [r'system-brochure\.pdf$'],
            'default_product_ids': ['supplier:a', 'supplier:b'],
            'exclude_pages': [1, 2],
            'page_product_ids': {'5': ['supplier:a']},
        }]
        self.assertEqual(configured_page_products(Path('system-brochure.pdf'), 1, rules), [])
        self.assertEqual(configured_page_products(Path('system-brochure.pdf'), 3, rules), ['supplier:a', 'supplier:b'])
        self.assertEqual(configured_page_products(Path('system-brochure.pdf'), 5, rules), ['supplier:a'])
        self.assertIsNone(configured_page_products(Path('other.pdf'), 5, rules))
    def test_image_only_pdf_ocr_preserves_page_level_text(self):
        closed = []

        class FakeImage:
            def convert(self, mode):
                self.mode = mode
                return self

        class FakeBitmap:
            def to_pil(self):
                return FakeImage()

        class FakePage:
            def render(self, scale):
                self.scale = scale
                return FakeBitmap()

        class FakeDocument:
            def __init__(self, path):
                self.pages = [FakePage(), FakePage()]

            def __len__(self):
                return len(self.pages)

            def __getitem__(self, index):
                return self.pages[index]

            def close(self):
                closed.append(True)

        class FakePdfium:
            PdfDocument = FakeDocument

        class FakeEngine:
            def __call__(self, image):
                return ([[None, "First line"], [None, "Second line"]], 0.01)

        with patch('scripts.ingest.pdf_ocr.pdfium', FakePdfium), patch('scripts.ingest.pdf_ocr.RapidOCR', return_value=FakeEngine()):
            pages, errors = ocr_pdf_pages(Path('image-only.pdf'), scale=2.0)
        self.assertEqual(pages, {1: "First line\nSecond line", 2: "First line\nSecond line"})
        self.assertEqual(errors, [])
        self.assertEqual(closed, [True])
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
        self.assertEqual([('product.jpg', 'image', 'product-hero'), ('logo.png', 'image', 'generic')], parser.media)

    def test_supplier_scoped_media_region_excludes_recommendation_cards(self):
        parser = PageParser(excluded_media_region_patterns=[r'\bcards-row\b'])
        parser.feed('<div class="cards-row"><div class="card-img"><img src="other-product.png"></div></div><div><img class="hero" src="current-product.png"></div>')
        self.assertEqual(parser.media, [('current-product.png', 'image', 'product-hero')])

    def test_global_squarespace_related_product_style_does_not_exclude_page_media(self):
        parser = PageParser()
        parser.feed('<html><body class="tweak-v1-related-products-image-aspect-ratio-11-square"><main><img class="hero" src="current-product.png"></main></body></html>')
        self.assertEqual(parser.media, [('current-product.png', 'image', 'product-hero')])

    def test_generic_window_token_does_not_claim_shared_configuration_diagram(self):
        product_keys = identity_keys(['picture-window', 'Picture Window'])
        self.assertFalse(urls_identity_match(['https://example.com/sps-window-1.png'], product_keys))
        self.assertTrue(urls_identity_match(['https://example.com/picture_window.png'], product_keys))

    def test_img_src_does_not_duplicate_responsive_renditions(self):
        parser = PageParser()
        parser.feed('<img class="hero" src="original.jpg" srcset="small.jpg 500w, large.jpg 1000w">')
        self.assertEqual([('large.jpg', 'image', 'product-hero')], parser.media)

    def test_transform_free_supplier_image_beats_responsive_query_variants(self):
        parser = PageParser()
        parser.feed('<img data-src="https://images.squarespace-cdn.com/door.png" srcset="https://images.squarespace-cdn.com/door.png?format=1000w 1000w, https://images.squarespace-cdn.com/door.png?format=2500w 2500w">')
        self.assertEqual(parser.media[0][0], 'https://images.squarespace-cdn.com/door.png')

    def test_figure_caption_binds_model_to_stale_named_image(self):
        parser = PageParser([{'role': 'product-gallery', 'patterns': [r'\bBK[A-Z0-9]{2,3}\b']}])
        parser.feed('<figure><img src="https://cdn.example/BlackBrushFull.png"><figcaption>Brush Black BK10 / BK11</figcaption></figure>')
        config = {'embedded_product_collections': {'/flush': 'Flush Glazed'}, 'embedded_product_model_pattern': r'\bBK[A-Z0-9]{2,3}\b'}
        self.assertEqual([product['modelNumber'] for product in embedded_caption_products(parser, '/flush', config)], ['BK10', 'BK11'])
        self.assertEqual(parser.media[0][2], 'product-gallery')

    def test_supplier_scoped_embedded_caption_products(self):
        parser = PageParser([{'role': 'product-gallery', 'patterns': [r'\b(?:BK|WG)[A-Z0-9]{2,3}\b']}])
        parser.feed('<button data-description="&lt;strong&gt;Brush Black&lt;/strong&gt;&lt;br&gt;BK10 (79) / BK11 (95)"><img src="https://cdn.example/BlackBrushFull.png"></button>')
        config = {'embedded_product_collections': {'/flush': 'Flush Glazed'}, 'embedded_product_model_pattern': r'\b(?:BK|WG)[A-Z0-9]{2,3}\b'}
        self.assertEqual(embedded_caption_products(parser, '/other', config), [])
        products = embedded_caption_products(parser, '/flush', config)
        self.assertEqual([product['modelNumber'] for product in products], ['BK10', 'BK11'])
        self.assertEqual(products[0]['images'], ['https://cdn.example/BlackBrushFull.png'])
        self.assertEqual(parser.media[0][2], 'product-gallery')

        asset = Asset('richersons', [], 'https://cdn.example/BlackBrushFull.png', 'https://cdn.example/BlackBrushFull.png', '/images/black-brush.png', 'image', 'product-gallery', 'hash', 1, 'now', source_asset_urls=['https://cdn.example/BlackBrushFull.png'])
        page = Page('https://www.richersonsdoors.com/flush-glazed', '', '', '', '', True, 'entry-doors', [asset.local_path], {'modelNumber': 'BK10', 'images': products[0]['images']})
        media, _ = product_asset_paths(page, {'asset': asset}, product_identity=['BK10'], require_gallery_identity_match=True)
        self.assertEqual(media, ['/images/black-brush.png'])

    def test_supplier_scoped_embedded_caption_include_filter(self):
        parser = PageParser()
        parser.feed('<div data-description="BK10 and BW2J"><img src="https://cdn.example/new.jpg"></div>')
        config = {'embedded_product_collections': {'/whats-new': 'New Products'}, 'embedded_product_model_pattern': r'\b(?:BK|BW)[A-Z0-9]{2,3}\b', 'embedded_product_include_patterns_by_path': {'/whats-new': [r'BW2JS?']}}
        self.assertEqual([product['modelNumber'] for product in embedded_caption_products(parser, '/whats-new', config)], ['BW2J'])

    def test_configured_api_products_filter_material_and_keep_canonical_url(self):
        payload = {'products': [
            {'sku': 'DR-ST-X-2P-X-80', 'name': 'Square 2 Panel', 'url': 'https://www.masonite.com/doors/exterior/dr-st-x-2p-x-80/', 'image': {'defaultSrc': 'https://embed.widencdn.net/steel.webp', 'altText': 'Steel door'}},
            {'sku': 'DR-WSR-X-C22-X-80', 'name': '2 Panel Traditional', 'url': 'https://www.masonite.com/doors/exterior/dr-wsr-x-c22-x-80/', 'image': {'defaultSrc': 'https://embed.widencdn.net/wood.webp'}},
        ]}
        config = {'api_product_list_key': 'products', 'api_exclude_model_patterns': ['^DR-WSR-'], 'api_slug_suffix_rules': [{'model_pattern': '^DR-ST-', 'suffix': 'steel'}]}
        products = api_json_products(payload, config)
        self.assertEqual(len(products), 1)
        self.assertEqual((products[0]['slug'], products[0]['modelNumber']), ('square-2-panel-steel', 'DR-ST-X-2P-X-80'))
        self.assertEqual(products[0]['sourceUrl'], 'https://www.masonite.com/doors/exterior/dr-st-x-2p-x-80/')
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

    def test_content_hash_deduplication_retains_all_provenance(self):
        first = Asset('supplier', ['https://example.com/p1'], 'https://example.com/a.jpg', 'https://example.com/a.jpg', '/images/a.jpg', 'image', 'product-gallery', 'same-hash', 10, 'now', '', ['https://example.com/a.jpg'])
        second = Asset('supplier', ['https://example.com/p2'], 'https://example.com/a-copy.jpg', 'https://example.com/a-copy.jpg', '/images/a-copy.jpg', 'image', 'product-gallery', 'same-hash', 10, 'now', '', ['https://example.com/a-copy.jpg'])
        merged = merge_duplicate_asset(first, second)
        self.assertIs(merged, first)
        self.assertEqual(merged.source_page_urls, ['https://example.com/p1', 'https://example.com/p2'])
        self.assertEqual(merged.source_asset_urls, ['https://example.com/a-copy.jpg', 'https://example.com/a.jpg'])
    def test_magento_gallery_prefers_full_product_assets(self):
        parser = PageParser()
        parser.feed('<script type="text/x-magento-init">{"[data-gallery-role=gallery-placeholder]":{"mage/gallery/gallery":{"data":[{"full":"https://example.com/full.jpg","img":"https://example.com/small.jpg","isMain":true},{"full":"https://example.com/detail.jpg","isMain":false}]}}}</script>')
        self.assertEqual(magento_gallery_assets(parser.magento_init), [
            ('https://example.com/full.jpg', 'image', 'product-hero'),
            ('https://example.com/detail.jpg', 'image', 'product-gallery'),
        ])

    def test_supplier_asset_mapping_attaches_reviewed_shared_configuration(self):
        url = 'https://example.com/2-panel.svg'
        asset = Asset('supplier', ['https://example.com/patio/'], url, url, '/images/2-panel.svg', 'image', 'configuration-diagram', 'a' * 64, 100, '2026-08-20T00:00:00Z', source_asset_urls=[url])
        products = [
            {'id': 'supplier:a', 'collection': 'Ultra', 'media': [], 'documents': []},
            {'id': 'supplier:b', 'collection': 'Ultra', 'media': [], 'documents': []},
        ]
        apply_asset_relationship_rules({url: asset}, products, [{'patterns': [r'2-panel\.svg$'], 'product_ids': ['supplier:a', 'supplier:b']}])
        associate_assets({url: asset}, products)
        self.assertEqual(asset.relationship_state, 'collection-shared')
        self.assertEqual(asset.product_ids, ['supplier:a', 'supplier:b'])
        self.assertIn('supplier-scoped-asset-map', asset.relationship_evidence)

    def test_supplier_document_mapping_overrides_heuristic_cross_attachment(self):
        path = '/documents/catalog/supplier/current-brochure.pdf'
        asset = Asset('supplier', ['https://example.com/products'], 'https://example.com/current-brochure.pdf', 'https://example.com/current-brochure.pdf', path, 'document', 'brochure', 'hash', 10, 'now')
        products = [
            {'id': 'supplier:a', 'collection': 'System A', 'media': [], 'documents': [path]},
            {'id': 'supplier:b', 'collection': 'System A', 'media': [], 'documents': [path]},
            {'id': 'supplier:c', 'collection': 'System B', 'media': [], 'documents': [path]},
        ]
        rules = [{'patterns': [r'current-brochure\.pdf$'], 'product_ids': ['supplier:a', 'supplier:b']}]
        apply_document_relationship_rules({asset.original_asset_url: asset}, products, rules)
        associate_assets({asset.original_asset_url: asset}, products)
        self.assertEqual(products[0]['documents'], [path])
        self.assertEqual(products[1]['documents'], [path])
        self.assertEqual(products[2]['documents'], [])
        self.assertEqual(asset.product_ids, ['supplier:a', 'supplier:b'])
        self.assertEqual(asset.relationship_state, 'collection-shared')
        self.assertIn('supplier-scoped-document-map', asset.relationship_evidence)
    def test_document_roles_are_explicit(self):
        self.assertEqual(document_role('https://example.com/urbania-sheet.pdf', 'Product Data Sheet'), 'specification-sheet')
        self.assertEqual(document_role('https://example.com/install.pdf'), 'installation-guide')
        self.assertEqual(document_role('https://example.com/catalogue.pdf'), 'catalogue')
        self.assertEqual(document_role('https://embed.widencdn.net/pdf/plus/masonite/steel.pdf', '', {'document_role_rules': [{'patterns': ['/pdf/plus/masonite/'], 'role': 'specification-sheet'}]}), 'specification-sheet')
        self.assertEqual(document_role('https://embed.widencdn.net/pdf/plus/other/steel.pdf', '', {'document_role_rules': [{'patterns': ['/pdf/plus/masonite/'], 'role': 'specification-sheet'}]}), 'reference-only')
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
        self.assertIsNone(normalize('/products/{{media url=', 'https://example.com/'))
        self.assertIsNone(normalize('/"quoted"/', 'https://example.com/'))

    def test_supplier_scoped_bare_video_id_is_not_crawled_as_relative_page(self):
        config = {'reject_raw_link_patterns': [r'^[A-Za-z0-9_-]{11}$']}
        self.assertFalse(raw_link_allowed('dvEVjtYGVLY', config))
        self.assertTrue(raw_link_allowed('dvEVjtYGVLY', {}))
        self.assertTrue(raw_link_allowed('https://www.youtube.com/watch?v=dvEVjtYGVLY', config))
        self.assertEqual(
            normalize('https://example.com/detail/3¼ Casement.png', 'https://example.com/'),
            'https://example.com/detail/3%C2%BC%20Casement.png',
        )

    def test_resume_refresh_preserves_supplier_rejected_document_links(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            snapshot = root / 'snapshot.html'
            snapshot.write_text(
                '<a href="https://example.com/accessibility-policy.pdf">Policy</a>'
                '<a href="https://example.com/product-catalogue.pdf">Catalogue</a>',
                encoding='utf-8',
            )
            page = Page('https://example.com/product/', '', '', '', 'snapshot.html', True, 'windows', [], {})
            config = {
                'allowed_domains': ['example.com'],
                'reject_raw_link_patterns': [r'.*accessibility-policy\.pdf'],
                'document_role_rules': [{'role': 'catalogue', 'patterns': [r'product-catalogue\.pdf']}],
            }
            with patch('scripts.ingest.crawl.ROOT', root):
                refresh_page_asset_candidates(page, config, {'example.com'})
            self.assertEqual([item['url'] for item in page.asset_candidates], ['https://example.com/product-catalogue.pdf'])

    def test_resume_refresh_rebuilds_embedded_caption_products(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            snapshot = root / 'snapshot.html'
            snapshot.write_text('<figure><img src="https://example.com/BlackBrushFull.png"><figcaption>Brush Black BK10 / BK11</figcaption></figure>', encoding='utf-8')
            page = Page('https://example.com/flush', '', '', '', 'snapshot.html', True, 'entry-doors', [], {}, [{'modelNumber': 'BK11'}])
            config = {'embedded_product_collections': {'/flush': 'Flush'}, 'embedded_product_model_pattern': r'\bBK[A-Z0-9]{2,3}\b', 'asset_role_rules': [{'role': 'product-gallery', 'patterns': [r'\bBK[A-Z0-9]{2,3}\b']}]}
            with patch('scripts.ingest.crawl.ROOT', root):
                refresh_page_asset_candidates(page, config, {'example.com'})
            self.assertEqual([product['modelNumber'] for product in page.embedded_products], ['BK10', 'BK11'])
            self.assertEqual(page.asset_candidates[0]['url'], 'https://example.com/BlackBrushFull.png')

    def test_supplier_page_scope_rejects_other_regional_catalogues(self):
        config = {
            'allowed_domains': ['groupenovatech.com', 'www.groupenovatech.com'],
            'allowed_path_prefixes': ['/en_canada_ontario/'],
        }
        self.assertTrue(page_allowed('https://www.groupenovatech.com/en_canada_ontario/products/doorglass.html', config))
        self.assertFalse(page_allowed('https://www.groupenovatech.com/en_canada_west/products/doorglass.html', config))
        self.assertFalse(page_allowed('https://example.com/en_canada_ontario/products/doorglass.html', config))
        trimlite = {'allowed_domains': ['trimlite.com'], 'allowed_path_patterns': [r'^/(?:product-category/doorlites|products/doorlites)(?:/|$)']}
        self.assertTrue(page_allowed('https://trimlite.com/products/doorlites/decorative-doorlites/adelaide/', trimlite))
        self.assertFalse(page_allowed('https://trimlite.com/product-category/interior-doors/', trimlite))

    def test_supplier_output_validation_rejects_wrong_manufacturer(self):
        config = {'slug': 'supplier', 'categories': ['windows'], 'allowed_domains': ['example.com']}
        product = {'id': 'other:model', 'manufacturer': 'other', 'slug': 'model', 'name': 'Model', 'category': 'windows', 'sourceUrl': 'https://example.com/model', 'sourceType': 'live-crawl', 'lastVerified': '2026-08-19', 'media': [], 'documents': [], 'specifications': {}}
        with self.assertRaisesRegex(ValueError, 'wrong supplier'):
            validate_product_records([product], config)

    def test_supplier_asset_url_rewrite_is_scoped_and_preserves_domain(self):
        config = {'asset_url_rewrite_rules': [{'pattern': r'^https://embed\.widencdn\.net/pdf/plus/', 'replacement': 'https://embed.widencdn.net/download/'}]}
        source = 'https://embed.widencdn.net/pdf/plus/masonite/key/spec.pdf'
        self.assertEqual(rewrite_asset_url(source, config), 'https://embed.widencdn.net/download/masonite/key/spec.pdf')
        self.assertEqual(rewrite_asset_url(source, {}), source)
    def test_widen_viewer_download_and_signed_cdn_provenance(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            viewer = 'https://embed.widencdn.net/pdf/plus/masonite/key/spec.pdf'
            download = 'https://embed.widencdn.net/download/masonite/key/spec.pdf'
            signed = 'https://cf-store.widencdn.net/masonite/signed/spec.pdf?Signature=test'
            response = FetchResponse(b'%PDF-test', 'application/pdf', None, signed)
            with patch('scripts.ingest.crawl.ROOT', root), patch('scripts.ingest.crawl.PUBLIC_DOC', root / 'public/documents/catalog'):
                asset = save_asset_body('masonite', viewer, 'https://www.masonite.com/for-pros/resources/', 'document', 'specification-sheet', response, root / 'stage')
            asset.source_asset_urls.append(download)
            self.assertEqual(asset.original_asset_url, viewer)
            self.assertEqual(asset.final_asset_url, signed)
            self.assertEqual(asset.source_asset_urls, [viewer, download])
            self.assertEqual(asset.role, 'specification-sheet')

    def test_persisted_asset_plan_rejects_unknown_lifecycle_state(self):
        task = AssetTask('https://example.com/a.jpg', 'https://example.com/a.jpg', 'https://example.com/p', 'image', 'product-hero', 0, 'group')
        saved = asdict(task)
        saved['status'] = 'mystery'
        with self.assertRaisesRegex(ValueError, 'invalid asset task state'):
            build_asset_tasks({}, 1, [saved])

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

    def test_multi_product_api_page_uses_exact_media_references(self):
        first = Asset('supplier', ['https://example.com/api'], 'https://cdn.example/a.jpg', 'https://cdn.example/a.jpg', '/images/a.jpg', 'image', 'product-hero', 'a', 10, 'now')
        second = Asset('supplier', ['https://example.com/api'], 'https://cdn.example/b.jpg', 'https://cdn.example/b.jpg', '/images/b.jpg', 'image', 'product-hero', 'b', 10, 'now')
        products = [
            {'id': 'supplier:a', 'sourceUrl': 'https://example.com/a', '_associationPageUrl': 'https://example.com/api', 'media': ['/images/a.jpg'], 'documents': [], 'collection': None},
            {'id': 'supplier:b', 'sourceUrl': 'https://example.com/b', '_associationPageUrl': 'https://example.com/api', 'media': ['/images/b.jpg'], 'documents': [], 'collection': None},
        ]
        associate_assets({'a': first, 'b': second}, products)
        self.assertEqual(first.product_ids, ['supplier:a'])
        self.assertEqual(second.product_ids, ['supplier:b'])
    def test_shared_supplier_document_is_promoted_with_relationship_scope(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            stage = root / 'source-media/staging/supplier/run/public/documents/catalog/supplier/catalogue.pdf'
            stage.parent.mkdir(parents=True); stage.write_bytes(b'catalogue')
            asset = Asset('supplier', ['https://example.com/catalogues'], 'https://example.com/catalogue.pdf', 'https://example.com/catalogue.pdf', '/documents/catalog/supplier/catalogue.pdf', 'document', 'catalogue', __import__('hashlib').sha256(b'catalogue').hexdigest(), 9, 'now', str(stage.relative_to(root)))
            associate_assets({'catalogue': asset}, [])
            self.assertEqual((asset.scope, asset.product_ids), ('supplier', []))
            with patch('scripts.ingest.crawl.ROOT', root):
                promoted = promote_referenced_assets({'catalogue': asset}, [], [])
            self.assertEqual(list(promoted), ['catalogue'])
            self.assertTrue((root / 'public/documents/catalog/supplier/catalogue.pdf').exists())
    def test_failed_staging_run_is_preserved_until_explicit_cleanup(self):
        with tempfile.TemporaryDirectory() as temp:
            staging = Path(temp) / 'staging'; run = staging / 'supplier' / 'run-1'; run.mkdir(parents=True)
            (run / 'run.json').write_text(json.dumps({'supplier': 'supplier', 'runId': 'run-1', 'status': 'failed'}), encoding='utf-8')
            quarantined = run / 'asset.jpg'; quarantined.write_bytes(b'failed-run-asset')
            candidates, ambiguous = scan_staging_runs(staging, references='')
            self.assertEqual((len(candidates), ambiguous), (1, []))
            self.assertTrue(quarantined.exists())

    def test_duplicate_asset_plan_prefers_strong_product_occurrence(self):
        shared = 'https://trimlite.com/wp-content/uploads/2023/05/DRF2K2023.jpg'
        groups = {
            'related': [{'url': shared, 'source_url': shared, 'page_url': 'https://trimlite.com/products/sls3c/', 'kind': 'image', 'role': 'product-hero', 'order': 20, 'group': 'related', 'association_rank': 9, 'relationship_signals': []}],
            'correct': [{'url': shared, 'source_url': shared, 'page_url': 'https://trimlite.com/products/drf2k/', 'kind': 'image', 'role': 'product-hero', 'order': 3, 'group': 'correct', 'association_rank': 0, 'relationship_signals': ['filename-model-match', 'primary-product-hero']}],
        }
        selected = fair_asset_candidates(groups, 2)
        self.assertEqual(len(selected), 1)
        self.assertEqual(selected[0]['page_url'], 'https://trimlite.com/products/drf2k/')
        self.assertEqual(selected[0]['association_rank'], 0)

    def test_trimlite_parser_excludes_upsells_and_related_product_images(self):
        parser = PageParser()
        parser.feed('''
            <div class="woocommerce-product-gallery">
              <a href="https://trimlite.com/wp-content/uploads/2023/05/DRF3F2023.jpg">
                <img class="wp-post-image" src="https://trimlite.com/wp-content/uploads/2023/05/DRF3F2023-300x660.jpg"
                     srcset="https://trimlite.com/wp-content/uploads/2023/05/DRF3F2023-300x660.jpg 300w, https://trimlite.com/wp-content/uploads/2023/05/DRF3F2023.jpg 318w">
              </a>
            </div>
            <section class="up-sells upsells products">
              <div class="featured-image"><img class="wp-post-image" src="https://trimlite.com/wp-content/uploads/2023/05/DRF2K2023.jpg"></div>
            </section>
            <section class="related products">
              <div class="featured-image"><img class="wp-post-image" src="https://trimlite.com/wp-content/uploads/2019/07/DRF36.jpg"></div>
            </section>
        ''')
        self.assertEqual(parser.media, [('https://trimlite.com/wp-content/uploads/2023/05/DRF3F2023.jpg', 'image', 'product-gallery')])

    def test_primary_product_gallery_is_strong_association_evidence(self):
        url = 'https://trimlite.com/wp-content/uploads/2023/05/DRF3F2023.jpg'
        asset = Asset('trimlite', [], url, url, '/images/drf3f.jpg', 'image', 'product-gallery', 'hash', 1, 'now', source_asset_urls=[url])
        page = Page('https://trimlite.com/products/drf3f/', '', 'DRF3F', '', '', True, 'entry-doors', [asset.local_path], {}, asset_candidates=[{'url': url, 'source_url': url, 'role': 'product-gallery', 'order': 0}])
        self.assertEqual(product_asset_paths(page, {url: asset}, [], ['DRF3F'])[0], [asset.local_path])
        self.assertIn('primary-product-gallery', asset.relationship_evidence)

    def test_open_graph_image_is_not_dom_primary_hero(self):
        parser = PageParser([{'role': 'hero', 'patterns': ['wp-post-image']}])
        parser.feed('<meta property="og:image" content="https://trimlite.com/related.jpg"><img class="wp-post-image" src="https://trimlite.com/DRF36.jpg">')
        self.assertEqual(parser.media, [('https://trimlite.com/related.jpg', 'image', 'open-graph-image'), ('https://trimlite.com/DRF36.jpg', 'image', 'product-hero')])

    def test_product_page_open_graph_requires_explicit_supplier_trust(self):
        url = 'https://www.vinyl-pro.ca/storage/4-916-Small-Fix-Window_1.png'
        asset = Asset('vinyl-pro', [], url, url, '/images/small-fix.png', 'image', 'open-graph-image', 'hash', 1, 'now', source_asset_urls=[url])
        page = Page('https://www.vinyl-pro.ca/windows/4-9-16-picture-window/', '', '4 9/16 Picture Window', '', '', True, 'windows', [asset.local_path], {}, asset_candidates=[{'url': url, 'source_url': url, 'role': 'open-graph-image', 'order': 0}])
        self.assertEqual(product_asset_paths(page, {url: asset}, [], ['4-9-16-picture-window'])[0], [])
        self.assertEqual(product_asset_paths(page, {url: asset}, [], ['4-9-16-picture-window'], True, True)[0], [asset.local_path])
        self.assertIn('product-page-open-graph', asset.relationship_evidence)

    def test_exact_design_token_matches_descriptive_filename_without_prefix_collision(self):
        self.assertTrue(urls_identity_match(['https://trimlite.com/764_1LITE_WHITE_NARROWREED-e1509.jpg'], identity_keys(['narrow-reed'])))
        self.assertTrue(urls_identity_match(['https://trimlite.com/Manhattan2248Glass.jpg'], identity_keys(['manhattan-decorative-doorlite'])))
        self.assertFalse(urls_identity_match(['https://trimlite.com/DRS12B-1.jpg'], identity_keys(['DRS12'])))

    def test_genuine_numeric_model_suffix_is_not_stripped(self):
        self.assertTrue(urls_identity_match(['https://trimlite.com/wp-content/uploads/ezvent_2264.jpg'], identity_keys(['2264 Ez Lift Clear Internal Venting Doorlite'])))
        self.assertFalse(urls_identity_match(['https://trimlite.com/wp-content/uploads/ezvent_2264.jpg'], identity_keys(['2064 Ez Lift Clear Internal Venting Doorlite'])))
        self.assertTrue(urls_identity_match(['https://trimlite.com/wp-content/uploads/DRS12B-1.jpg'], identity_keys(['DRS12B'])))
        self.assertTrue(urls_identity_match(['https://trimlite.com/wp-content/uploads/blind-2064-e1585163996307.jpg'], identity_keys(['Miniblind 2064'])))
        self.assertFalse(urls_identity_match(['https://trimlite.com/wp-content/uploads/blind-2064-e1585163996307.jpg'], identity_keys(['Internal Blinds 2264'])))

    def test_validated_wordpress_master_supersedes_derivative_without_deleting_binary(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); derivative_body = b'derivative'; master_body = b'master'
            derivative_path = root / 'public/images/DRF36-300x300.jpg'; derivative_path.parent.mkdir(parents=True); derivative_path.write_bytes(derivative_body)
            master_path = root / 'public/images/DRF36.jpg'; master_path.write_bytes(master_body)
            derivative_url = 'https://trimlite.com/wp-content/uploads/DRF36-300x300.jpg'; master_url = 'https://trimlite.com/wp-content/uploads/DRF36.jpg'
            derivative = Asset('trimlite', [], derivative_url, derivative_url, '/images/DRF36-300x300.jpg', 'image', 'product-hero', __import__('hashlib').sha256(derivative_body).hexdigest(), len(derivative_body), 'now', source_asset_urls=[derivative_url])
            master = Asset('trimlite', [], master_url, master_url, '/images/DRF36.jpg', 'image', 'product-hero', __import__('hashlib').sha256(master_body).hexdigest(), len(master_body), 'now', source_asset_urls=[master_url])
            derivative.selected_asset_url = derivative_url; master.selected_asset_url = master_url
            product = {'id': 'trimlite:drf36-2', 'media': [derivative.local_path, master.local_path], 'documents': []}
            with patch('scripts.ingest.crawl.ROOT', root):
                enforce_wordpress_master_precedence({'derivative': derivative, 'master': master}, [product])
            self.assertEqual(product['media'], [master.local_path])
            self.assertTrue(derivative_path.exists())
            self.assertIn('superseded-by-wordpress-original', derivative.relationship_evidence)

    def test_wordpress_master_selection_avoids_responsive_derivatives(self):
        attrs = {
            'src': 'https://trimlite.com/wp-content/uploads/2019/07/DRF36-300x300.jpg',
            'srcset': 'https://trimlite.com/wp-content/uploads/2019/07/DRF36-300x300.jpg 300w, https://trimlite.com/wp-content/uploads/2019/07/DRF36-768x768.jpg 768w, https://trimlite.com/wp-content/uploads/2019/07/DRF36.jpg 1600w',
            'data-orig-file': 'https://trimlite.com/wp-content/uploads/2019/07/DRF36.jpg',
        }
        self.assertEqual(wordpress_master_candidate(attrs), 'https://trimlite.com/wp-content/uploads/2019/07/DRF36.jpg')
        parser = PageParser([{'role': 'hero', 'patterns': ['wp-post-image']}])
        parser.feed(f'<img class="wp-post-image" src="{attrs["src"]}" srcset="{attrs["srcset"]}" data-orig-file="{attrs["data-orig-file"]}">')
        self.assertEqual(parser.media, [('https://trimlite.com/wp-content/uploads/2019/07/DRF36.jpg', 'image', 'product-hero')])

    def test_single_download_is_re_evaluated_on_all_observed_pages(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); body = b'\x89PNG\r\n\x1a\n' + b'0' * 24
            stage = root / 'source-media/staging/trimlite/run/public/images/drf2k.png'; stage.parent.mkdir(parents=True); stage.write_bytes(body)
            url = 'https://trimlite.com/wp-content/uploads/2023/05/DRF2K2023.png'
            asset = Asset('trimlite', [], url, url, '/images/drf2k.png', 'image', 'product-hero', __import__('hashlib').sha256(body).hexdigest(), len(body), 'now', str(stage.relative_to(root)), [url])
            correct = Page('https://trimlite.com/products/drf2k/', '', 'DRF2K', '', '', True, 'entry-doors', [], {'modelNumber': 'DRF2K'}, asset_candidates=[{'url': url, 'source_url': url, 'role': 'product-hero', 'order': 0}])
            related = Page('https://trimlite.com/products/sls3c/', '', 'SLS3C', '', '', True, 'entry-doors', [], {'modelNumber': 'SLS3C'}, asset_candidates=[{'url': 'https://trimlite.com/own.png', 'source_url': 'https://trimlite.com/own.png', 'role': 'product-hero', 'order': 0}, {'url': url, 'source_url': url, 'role': 'product-hero', 'order': 10}])
            with patch('scripts.ingest.crawl.ROOT', root): attach_available_asset_occurrences([correct, related], {url: asset})
            self.assertEqual(correct.assets, [asset.local_path]); self.assertEqual(related.assets, [asset.local_path])
            self.assertEqual(product_asset_paths(correct, {url: asset}, [], ['DRF2K'])[0], [asset.local_path])
            self.assertEqual(product_asset_paths(related, {url: asset}, [], ['SLS3C'])[0], [])

    def test_trimlite_primary_master_attaches_only_to_matching_canonical_product(self):
        drf2k_url = 'https://trimlite.com/wp-content/uploads/2023/05/DRF2K2023.jpg'
        own_url = 'https://trimlite.com/wp-content/uploads/2018/05/SLS3C-1.png'
        asset = Asset('trimlite', [], drf2k_url, drf2k_url, '/images/drf2k.jpg', 'image', 'product-hero', 'hash', 1, 'now', source_asset_urls=[drf2k_url])
        correct = Page('https://trimlite.com/products/exterior-doors/fir-grain-fiberglass/drf2k/', '', 'DRF2K', '', '', True, 'entry-doors', [asset.local_path], {'modelNumber': 'DRF2K'}, asset_candidates=[{'url': drf2k_url, 'role': 'product-hero', 'order': 3}])
        related = Page('https://trimlite.com/products/exterior-doors/smooth-skin-fiberglass/sls3c-2/', '', 'SLS3C', '', '', True, 'entry-doors', [asset.local_path], {'modelNumber': 'SLS3C'}, asset_candidates=[{'url': own_url, 'role': 'product-hero', 'order': 3}, {'url': drf2k_url, 'role': 'product-hero', 'order': 20}])
        self.assertEqual(product_asset_paths(correct, {'drf2k': asset}, [], ['drf2k', 'DRF2K'])[0], [asset.local_path])
        self.assertEqual(product_asset_paths(related, {'drf2k': asset}, [], ['sls3c-2', 'SLS3C'])[0], [])
        products = [
            {'id': 'trimlite:drf2k', 'sourceUrl': correct.url, 'media': [asset.local_path], 'documents': [], 'collection': 'Fir Grain'},
            {'id': 'trimlite:sls3c-2', 'sourceUrl': related.url, 'media': [], 'documents': [], 'collection': 'Smooth Skin'},
        ]
        associate_assets({'drf2k': asset}, products)
        self.assertEqual(asset.product_ids, ['trimlite:drf2k'])
        self.assertEqual(asset.relationship_state, 'product-specific')

    def test_model_prefix_does_not_cross_attach_variant(self):
        url = 'https://trimlite.com/wp-content/uploads/2018/05/DRS12B-1.jpg'
        asset = Asset('trimlite', [], url, url, '/images/drs12b.jpg', 'image', 'product-hero', 'hash', 1, 'now', source_asset_urls=[url])
        page = Page('https://trimlite.com/products/drs12-2/', '', 'DRS12', '', '', True, 'entry-doors', [asset.local_path], {'modelNumber': 'DRS12'}, asset_candidates=[{'url': 'https://trimlite.com/wp-content/uploads/2018/05/DRS12-1.jpg', 'role': 'product-hero', 'order': 0}, {'url': url, 'role': 'product-hero', 'order': 8}])
        self.assertEqual(product_asset_paths(page, {url: asset}, [], ['DRS12'])[0], [])

    def test_trimlite_drf36_related_card_does_not_attach(self):
        drf36_url = 'https://trimlite.com/wp-content/uploads/2019/07/DRF36.jpg'
        asset = Asset('trimlite', [], drf36_url, drf36_url, '/images/drf36.jpg', 'image', 'product-hero', 'hash', 1, 'now', source_asset_urls=[drf36_url])
        correct = Page('https://trimlite.com/products/exterior-doors/fir-grain-fiberglass/drf36-2/', '', 'DRF36', '', '', True, 'entry-doors', [asset.local_path], {'modelNumber': 'DRF36'}, asset_candidates=[{'url': drf36_url, 'role': 'product-hero', 'order': 3}])
        related = Page('https://trimlite.com/products/exterior-doors/fir-grain-fiberglass/slf3c-2/', '', 'SLF3C', '', '', True, 'entry-doors', [asset.local_path], {'modelNumber': 'SLF3C'}, asset_candidates=[{'url': 'https://trimlite.com/wp-content/uploads/2019/07/SLF3C.jpg', 'role': 'product-hero', 'order': 3}, {'url': drf36_url, 'role': 'product-hero', 'order': 8}])
        self.assertEqual(product_asset_paths(correct, {'drf36': asset}, [], ['drf36-2', 'DRF36'])[0], [asset.local_path])
        self.assertEqual(product_asset_paths(related, {'drf36': asset}, [], ['slf3c-2', 'SLF3C'])[0], [])

    def test_structured_product_image_conflict_rejects_nonmatching_gallery_asset(self):
        sandblast = 'https://trimlite.com/wp-content/uploads/2020/06/764_1LITE_STRAIGHT_WHITE_SANDBLAST.jpg'
        white_lami = 'https://trimlite.com/wp-content/uploads/2019/05/2215_WHITELAMI_OBSCURITY-2.jpg'
        asset = Asset('trimlite', [], sandblast, sandblast, '/images/sandblast.jpg', 'image', 'product-hero', 'hash', 1, 'now', source_asset_urls=[sandblast])
        page = Page('https://trimlite.com/products/doorlites/retro-series/diffused-white-laminate-white-lami-2/', '', 'Diffused White Laminate', '', '', True, 'door-glass', [asset.local_path], {'images': [white_lami]}, asset_candidates=[{'url': sandblast, 'source_url': sandblast, 'role': 'product-hero', 'order': 0}])
        self.assertEqual(product_asset_paths(page, {sandblast: asset}, [], ['diffused-white-laminate-white-lami-2'], True)[0], [])

    def test_exact_filename_owner_removes_weaker_structured_cross_attachment(self):
        url = 'https://trimlite.com/wp-content/uploads/modena.jpg'
        asset = Asset('trimlite', [], url, url, '/images/modena.jpg', 'image', 'product-hero', 'hash', 1, 'now', source_asset_urls=[url])
        products = [
            {'id': 'trimlite:modena', 'slug': 'modena', 'name': 'Modena', 'modelNumber': None, 'media': [asset.local_path], 'documents': []},
            {'id': 'trimlite:storm-series-impact-rain', 'slug': 'storm-series-impact-rain', 'name': 'Storm Series Impact Rain', 'modelNumber': None, 'media': [asset.local_path], 'documents': []},
        ]
        enforce_filename_owner_precedence({'modena': asset}, products)
        self.assertEqual(products[0]['media'], [asset.local_path])
        self.assertEqual(products[1]['media'], [])

    def test_strong_multi_product_hero_is_explicitly_supplier_shared(self):
        asset = Asset('trimlite', [], 'https://trimlite.com/perimeter.jpg', 'https://trimlite.com/perimeter.jpg', '/images/perimeter.jpg', 'image', 'product-hero', 'hash', 1, 'now')
        products = [
            {'id': 'trimlite:perimeter', 'media': [asset.local_path], 'documents': [], 'collection': None},
            {'id': 'trimlite:storm-series-impact-perimeter', 'media': [asset.local_path], 'documents': [], 'collection': None},
        ]
        associate_assets({'perimeter': asset}, products)
        self.assertEqual(asset.relationship_state, 'supplier-shared')

    def test_collection_shared_technical_image_can_relate_to_multiple_products(self):
        asset = Asset('supplier', [], 'https://example.com/collection-drawing.png', 'https://example.com/collection-drawing.png', '/images/collection-drawing.png', 'image', 'technical-drawing', 'hash', 1, 'now')
        products = [
            {'id': 'supplier:a', 'sourceUrl': 'https://example.com/a', 'media': [asset.local_path], 'documents': [], 'collection': 'Shared Collection'},
            {'id': 'supplier:b', 'sourceUrl': 'https://example.com/b', 'media': [asset.local_path], 'documents': [], 'collection': 'Shared Collection'},
        ]
        associate_assets({'drawing': asset}, products)
        self.assertEqual(asset.product_ids, ['supplier:a', 'supplier:b'])
        self.assertEqual(asset.relationship_state, 'collection-shared')

    def test_resume_upgrades_legacy_document_role_from_persisted_task(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            body = b'%PDF-valid'
            public = root / 'public/documents/catalog/supplier/warranty.pdf'
            public.parent.mkdir(parents=True); public.write_bytes(body)
            asset = Asset('supplier', ['https://example.com/product'], 'https://example.com/warranty.pdf', 'https://example.com/warranty.pdf', '/documents/catalog/supplier/warranty.pdf', 'document', 'document', __import__('hashlib').sha256(body).hexdigest(), len(body), 'now', '', ['https://example.com/warranty.pdf'])
            task = AssetTask('https://example.com/warranty.pdf', 'https://example.com/warranty.pdf', 'https://example.com/product', 'document', 'warranty', 0, 'https://example.com/product')
            with patch('scripts.ingest.crawl.ROOT', root):
                aliases, invalid = reconcile_asset_tasks([task], {asset.original_asset_url: asset})
            self.assertEqual(invalid, [])
            self.assertEqual(task.status, 'validated')
            self.assertEqual(aliases[task.url].role, 'warranty')

    def test_interrupted_asset_phase_resume_reuses_checksum_valid_staged_asset(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            body = b'validated-stage'
            stage = root / 'source-media/staging/supplier/run/public/images/catalog/supplier/asset.jpg'
            stage.parent.mkdir(parents=True); stage.write_bytes(body)
            asset = Asset('supplier', ['https://example.com/p'], 'https://example.com/asset.jpg', 'https://example.com/asset.jpg', '/images/catalog/supplier/asset.jpg', 'image', 'product-hero', __import__('hashlib').sha256(body).hexdigest(), len(body), 'now', str(stage.relative_to(root)), ['https://example.com/asset.jpg'])
            task = AssetTask('https://example.com/asset.jpg', 'https://example.com/asset.jpg', 'https://example.com/p', 'image', 'product-hero', 0, 'https://example.com/p', status='downloaded', attempts=1, asset_url='https://example.com/asset.jpg')
            with patch('scripts.ingest.crawl.ROOT', root):
                aliases, invalid = reconcile_asset_tasks([task], {asset.original_asset_url: asset})
            self.assertEqual(invalid, [])
            self.assertEqual(task.status, 'validated')
            self.assertIs(aliases[task.url], asset)

    def test_interrupted_asset_phase_resume_rejects_corrupt_staged_asset(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            stage = root / 'source-media/staging/supplier/run/public/images/catalog/supplier/asset.jpg'
            stage.parent.mkdir(parents=True); stage.write_bytes(b'corrupt')
            asset = Asset('supplier', ['https://example.com/p'], 'https://example.com/asset.jpg', 'https://example.com/asset.jpg', '/images/catalog/supplier/asset.jpg', 'image', 'product-hero', __import__('hashlib').sha256(b'expected').hexdigest(), len(b'expected'), 'now', str(stage.relative_to(root)), ['https://example.com/asset.jpg'])
            task = AssetTask('https://example.com/asset.jpg', 'https://example.com/asset.jpg', 'https://example.com/p', 'image', 'product-hero', 0, 'https://example.com/p', status='downloaded', attempts=1, asset_url='https://example.com/asset.jpg')
            with patch('scripts.ingest.crawl.ROOT', root):
                _, invalid = reconcile_asset_tasks([task], {asset.original_asset_url: asset})
            self.assertEqual(invalid, ['https://example.com/asset.jpg'])
            self.assertEqual(task.status, 'pending')
            self.assertIn('checksum', task.error)

    def test_resume_preserves_asset_plan_instead_of_rebudgeting_downloaded_items(self):
        groups = {
            'early': [{'url': 'https://example.com/a.jpg', 'source_url': 'https://example.com/a.jpg', 'page_url': 'https://example.com/a', 'kind': 'image', 'role': 'product-hero', 'order': 0, 'group': 'early'}],
            'late': [{'url': 'https://example.com/b.jpg', 'source_url': 'https://example.com/b.jpg', 'page_url': 'https://example.com/b', 'kind': 'image', 'role': 'product-hero', 'order': 0, 'group': 'late'}],
        }
        original, _ = build_asset_tasks(groups, 2)
        original[0].status = 'validated'
        resumed, plan = build_asset_tasks(groups, 1, [asdict(task) for task in original])
        self.assertEqual([task.url for task in resumed], ['https://example.com/a.jpg', 'https://example.com/b.jpg'])
        self.assertEqual(resumed[0].status, 'validated')
        self.assertEqual(plan['selected'], 2)

    def test_resume_plan_appends_newly_discovered_assets_without_losing_saved_state(self):
        groups = {
            'known': [{'url': 'https://example.com/a.jpg', 'source_url': 'https://example.com/a.jpg', 'page_url': 'https://example.com/a', 'kind': 'image', 'role': 'product-hero', 'order': 0, 'group': 'known'}],
            'new': [{'url': 'https://example.com/b.jpg', 'source_url': 'https://example.com/b.jpg', 'page_url': 'https://example.com/b', 'kind': 'image', 'role': 'product-hero', 'order': 0, 'group': 'new'}],
        }
        saved = AssetTask('https://example.com/a.jpg', 'https://example.com/a.jpg', 'https://example.com/a', 'image', 'product-hero', 0, 'known', status='validated')
        resumed, plan = build_asset_tasks(groups, 10, [asdict(saved)])
        self.assertEqual([task.url for task in resumed], ['https://example.com/a.jpg', 'https://example.com/b.jpg'])
        self.assertEqual(resumed[0].status, 'validated')
        self.assertEqual(resumed[1].status, 'pending')
        self.assertTrue(plan['complete'])

    def test_corrective_no_discovery_plan_executes_only_persisted_tasks(self):
        groups = {
            'target': [{'url': 'https://example.com/target.jpg', 'source_url': 'https://example.com/target.jpg', 'page_url': 'https://example.com/target', 'kind': 'image', 'role': 'product-hero', 'order': 0, 'group': 'target'}],
            'unrelated': [{'url': 'https://example.com/unrelated.jpg', 'source_url': 'https://example.com/unrelated.jpg', 'page_url': 'https://example.com/unrelated', 'kind': 'image', 'role': 'product-hero', 'order': 0, 'group': 'unrelated'}],
        }
        saved = AssetTask('https://example.com/target.jpg', 'https://example.com/target.jpg', 'https://example.com/target', 'image', 'product-hero', 0, 'target')
        resumed, plan = build_asset_tasks(groups, 10, [asdict(saved)], expand_saved=False)
        self.assertEqual([task.url for task in resumed], ['https://example.com/target.jpg'])
        self.assertEqual((plan['groups'], plan['selected'], plan['available'], plan['complete']), (1, 1, 1, True))

    def test_resume_only_enqueues_newly_configured_start_urls(self):
        config = {'base_url': 'https://example.com/', 'start_urls': ['https://example.com/known', '/new', '/canonical']}
        unseen = configured_unseen_start_urls(config, {'https://example.com/known'}, {'https://example.com/canonical'})
        self.assertEqual(unseen, ['https://example.com/new'])

    def test_successful_asset_retry_clears_only_matching_checkpoint_error(self):
        errors = [
            {'url': 'https://example.com/retry.pdf', 'phase': 'asset-download', 'error': 'temporary'},
            {'url': 'https://example.com/other.pdf', 'phase': 'asset-download', 'error': 'other'},
            {'url': 'https://example.com/retry.pdf', 'phase': 'page-discovery', 'error': 'page'},
        ]
        clear_resolved_asset_errors(errors, 'https://example.com/retry.pdf')
        self.assertEqual(errors, [
            {'url': 'https://example.com/other.pdf', 'phase': 'asset-download', 'error': 'other'},
            {'url': 'https://example.com/retry.pdf', 'phase': 'page-discovery', 'error': 'page'},
        ])

    def test_replan_preserves_retryable_task_state(self):
        task = AssetTask('https://example.com/a.jpg', 'https://example.com/a.jpg', 'https://example.com/p', 'image', 'product-hero', 0, 'group')
        restore_retryable_task_states([task], [{'url': task.url, 'status': 'retryable', 'attempts': 2, 'error': 'HTTP 429'}])
        self.assertEqual((task.status, task.attempts, task.error), ('retryable', 2, 'HTTP 429'))

    def test_asset_budget_must_reach_every_product_group(self):
        groups = {
            'first': [{'url': 'https://example.com/a.jpg', 'source_url': 'https://example.com/a.jpg', 'page_url': 'https://example.com/a', 'kind': 'image', 'role': 'product-hero', 'order': 0, 'group': 'first'}],
            'second': [{'url': 'https://example.com/b.jpg', 'source_url': 'https://example.com/b.jpg', 'page_url': 'https://example.com/b', 'kind': 'image', 'role': 'product-hero', 'order': 0, 'group': 'second'}],
        }
        with self.assertRaisesRegex(ValueError, 'cannot attempt one asset for each'):
            build_asset_tasks(groups, 1)

    def test_trimlite_does_not_attach_every_related_hero(self):
        suppliers = json.loads((Path(__file__).parents[1] / 'ingest' / 'suppliers.json').read_text(encoding='utf-8'))
        trimlite = next(item for item in suppliers if item['slug'] == 'trimlite')
        self.assertEqual(trimlite.get('attach_page_roles'), [])
        self.assertEqual(trimlite.get('crawl_delay'), 10)
        self.assertTrue(trimlite.get('allowed_path_patterns'))

if __name__ == '__main__':
    unittest.main()
