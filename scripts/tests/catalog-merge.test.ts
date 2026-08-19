import assert from 'node:assert/strict';
import { applyCatalogEnrichment, isPublishableProduct, mergeCatalogProducts, type CatalogEnrichment, type CatalogProduct } from '../../src/data/catalog-schema.ts';

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

const sourceOnly = { ...curated, summary: null, sourceDescription: 'Supplier promotional reference copy' };
assert.equal(isPublishableProduct(sourceOnly, new Set(['supplier'])), false);
const source = { supplier: 'supplier', sourceUrl: curated.sourceUrl, extractedAt: '2026-08-19T00:00:00Z', status: 'active' as const };
const overlay: CatalogEnrichment = {
  productId: curated.id,
  sourceFacts: {
    manufacturer: { value: 'supplier', sources: [source] }, sourceUrl: { value: curated.sourceUrl, sources: [source] },
    sourceDescription: null, modelNumber: null, collection: null,
    normalized: { material: { value: 'Vinyl', sources: [source] } }, sourceDocuments: [], sourceMedia: []
  },
  editorial: {
    status: 'draft', summary: 'This evidence-backed fixture describes a vinyl window using only the normalized supplier fact. It exists to verify that independent editorial content, factual provenance, and useful specifications are all required before a catalogue route becomes publishable. Any options not included in the record must still be confirmed before a homeowner places an order.',
    bestFor: 'A test fixture.', keyFeatures: ['Material: Vinyl', 'Model: A-100', 'Collection: Premium'], considerations: [],
    configurationNotes: 'Fixture only.', seoTitle: 'Model A Window | Supplier', metaDescription: 'Evidence-backed model A window fixture.', generatedAt: '2026-08-19T00:00:00Z'
  }
};
const [enriched] = applyCatalogEnrichment([sourceOnly], [overlay]);
assert.equal(isPublishableProduct(enriched, new Set(['supplier'])), true);
console.log('Catalog merge fixtures: OK');
