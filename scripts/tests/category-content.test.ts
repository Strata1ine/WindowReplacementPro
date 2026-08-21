import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { categoryDetailPages } from '../../src/data/category-detail-pages.ts';

const root = process.cwd();
const identities = JSON.parse(readFileSync(path.join(root, 'src', 'data', 'public-identities.json'), 'utf8'));
const publicReferences = new Set(identities.map((product: { publicReference: string }) => product.publicReference));
const expectedPaths = [
  '/windows/casement-windows/',
  '/windows/awning-windows/',
  '/windows/picture-windows/',
  '/windows/single-hung-windows/',
  '/windows/double-hung-windows/',
  '/windows/single-slider-windows/',
  '/windows/double-slider-windows/',
  '/windows/end-vent-slider-windows/',
  '/windows/bay-windows/',
  '/windows/bow-windows/',
  '/doors/fiberglass-entry-doors/',
  '/doors/steel-entry-doors/',
  '/patio-doors/sliding-patio-doors/',
  '/patio-doors/stacking-patio-doors/'
];

assert.deepEqual(categoryDetailPages.map(page => page.path).sort(), expectedPaths.sort(), 'category-detail route set changed unexpectedly');
for (const key of ['path', 'metaTitle', 'metaDescription', 'title'] as const) {
  const values = categoryDetailPages.map(page => page[key]);
  assert.equal(values.length, new Set(values).size, key + ' values must be unique');
}

const prohibited = /approved public|public-neutral|reviewed product|reviewed public|internal evidence|public hero gate|selected deterministically|content coming soon/i;
for (const page of categoryDetailPages) {
  assert.equal([page.heroReference, page.heroMediaKey, page.heroDiagram].filter(Boolean).length, 1, page.path + ' needs exactly one deliberate hero source');
  assert.ok(page.visualReferences.length >= 3, page.path + ' needs supporting visual examples');
  assert.ok(page.sections.length >= 4, page.path + ' needs a substantive editorial structure');
  assert.ok(page.relatedLinks.length >= 4, page.path + ' needs useful related links');
  assert.ok(page.productReferences.length >= 3, page.path + ' needs relevant product examples');
  for (const reference of page.productReferences) assert.ok(publicReferences.has(reference), page.path + ' references an unpublished product: ' + reference);
  if (page.heroReference) assert.ok(publicReferences.has(page.heroReference), page.path + ' hero product is not published');
  const publicCopy = JSON.stringify({
    title: page.title,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
    lead: page.lead,
    intro: page.intro,
    highlights: page.highlights,
    sections: page.sections,
    relatedLinks: page.relatedLinks,
    heroCaption: page.heroCaption
  });
  assert.equal(prohibited.test(publicCopy), false, page.path + ' exposes internal workflow language');
}

const byPath = Object.fromEntries(categoryDetailPages.map(page => [page.path, page]));
assert.equal(byPath['/windows/end-vent-slider-windows/'].heroDiagram, 'end-vent');
assert.equal(byPath['/windows/bay-windows/'].heroDiagram, 'bay');
assert.equal(byPath['/windows/bow-windows/'].heroDiagram, 'bow');
assert.equal(byPath['/patio-doors/stacking-patio-doors/'].heroDiagram, 'stacking');
assert.equal(byPath['/doors/steel-entry-doors/'].heroMediaKey, 'steel-entry-door-example');

console.log('Category content model tests: OK (' + categoryDetailPages.length + ' substantive category routes).');
