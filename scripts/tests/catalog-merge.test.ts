import assert from 'node:assert/strict';
import { mergeCatalogProducts, type CatalogProduct } from '../../src/data/catalog-schema.ts';

const curated: CatalogProduct = {
  id: 'supplier:model-a', manufacturer: 'supplier', slug: 'model-a', name: 'Model A', category: 'windows',
  collection: 'Premium', modelNumber: 'A-100', type: 'Casement', summary: 'Curated summary',
  sourceDescription: null,
  sourceUrl: 'https://supplier.example/model-a', sourceType: 'curated', media: [], documents: [],
  specifications: { material: 'Vinyl' }, lastVerified: '2026-08-01'
};

const discovered: CatalogProduct = {
  ...curated, collection: null, modelNumber: null, summary: null, sourceDescription: 'Supplier reference description', sourceType: 'live-crawl',
  media: ['/images/catalog/supplier/model-a.jpg'], specifications: { glazing: 'Triple pane' },
  lastVerified: '2026-08-19'
};

const [merged] = mergeCatalogProducts([curated], [discovered]);
assert.equal(merged.summary, 'Curated summary');
assert.equal(merged.modelNumber, 'A-100');
assert.equal(merged.sourceDescription, 'Supplier reference description');
assert.deepEqual(merged.media, ['/images/catalog/supplier/model-a.jpg']);
assert.deepEqual(merged.specifications, { glazing: 'Triple pane', material: 'Vinyl' });
assert.throws(() => mergeCatalogProducts([curated, curated], []), /duplicate id/);
console.log('Catalog merge fixtures: OK');
