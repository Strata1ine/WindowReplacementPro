import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { publicProductShowroomData } from '../../src/data/public-product-showroom.ts';
import { buildPublicProductSchema } from '../../src/data/product-schema.ts';
import { classifyShowroomProduct, getShowroomMetrics, isShowroomReadyProduct } from '../lib/product-showroom-readiness.mjs';

const identities:any[] = JSON.parse(await readFile(new URL('../../src/data/public-identities.json', import.meta.url), 'utf8'));
const mappings:any[] = JSON.parse(await readFile(new URL('../../src/data/internal/public-product-showroom-mappings.json', import.meta.url), 'utf8'));
assert.equal(publicProductShowroomData.length, 40);
assert.equal(new Set(publicProductShowroomData.map(item => item.publicReference)).size, 40);
assert.equal(mappings.length, 40);
const identityByReference = new Map(identities.map(item => [item.publicReference, item]));
const mappingByReference = new Map(mappings.map(item => [item.publicReference, item]));
const confidential = /vinyl[- ]?pro|window[- ]?city|masonite|trimlite|novatech|verre[- ]?select|mennie|richersons|oceanview|vista|sourceUrl|productId|localPath|sha256/i;
const metrics:any[] = [];

for (const showroom of publicProductShowroomData) {
  assert.ok(identityByReference.has(showroom.publicReference), showroom.publicReference);
  const serialized = JSON.stringify(showroom);
  assert.doesNotMatch(serialized, confidential, showroom.publicReference);
  const publicKeys = new Set([
    ...showroom.gallery.map(item => item.key),
    ...showroom.groups.flatMap(group => group.options.map(item => item.media?.key).filter(Boolean)),
    ...showroom.technicalMedia.map(item => item.media?.key).filter(Boolean)
  ]);
  const privateMapping:any = mappingByReference.get(showroom.publicReference);
  const privateKeys = new Set((privateMapping?.assets ?? []).map((item:any) => item.key));
  assert.deepEqual([...publicKeys].sort(), [...privateKeys].sort(), showroom.publicReference + ' public/private key parity');
  for (const asset of privateMapping.assets ?? []) {
    assert.deepEqual(asset.publicProductIds, [showroom.publicReference]);
    assert.ok(asset.publicOptionId);
    assert.ok(asset.optionType);
    assert.ok(asset.compatibleInternalProductIds.length > 0);
    assert.ok(asset.compatibilityRestrictions);
    assert.ok(asset.sourceEvidence.length > 0);
    assert.equal(asset.reviewState, 'approved');
  }
  const privateOptions = [...(privateMapping.assets ?? []), ...(privateMapping.options ?? [])];
  for (const group of showroom.groups) {
    assert.ok(group.options.length > 0, showroom.publicReference + ':' + group.id);
    for (const option of group.options) {
      assert.ok(option.media || option.diagram, showroom.publicReference + ':' + option.id + ' needs a visual');
      assert.ok(privateOptions.some(item => item.publicOptionId === option.id), showroom.publicReference + ':' + option.id + ' needs private compatibility evidence');
    }
  }
  for (const item of showroom.technicalMedia) {
    assert.ok(item.media || item.diagram, showroom.publicReference + ':' + item.id + ' technical item needs a visual');
    assert.ok(privateOptions.some(option => option.publicOptionId === item.id), showroom.publicReference + ':' + item.id + ' needs private compatibility evidence');
  }
  metrics.push(getShowroomMetrics(identityByReference.get(showroom.publicReference), showroom));
}

const privacyShowrooms:any[] = publicProductShowroomData.filter(item => item.privacyIndicator);
assert.equal(privacyShowrooms.length, 3);
assert.deepEqual(privacyShowrooms.map(item => [item.publicReference, item.privacyIndicator.value]).sort(), [
  ['WRP-G001', 2],
  ['WRP-G002', 4],
  ['WRP-G003', 4]
]);
for (const showroom of privacyShowrooms) {
  const privatePrivacy = mappingByReference.get(showroom.publicReference)?.privacyIndicator;
  assert.equal(privatePrivacy.reviewState, 'approved');
  assert.ok(privatePrivacy.compatibleInternalProductIds.length > 0);
  assert.ok(privatePrivacy.sourceEvidence.length > 0);
}
const oak:any = publicProductShowroomData.find(item => item.publicReference === 'WRP-D003');
assert.equal(oak.groups.find((item:any) => item.id === 'style').options.length, 5);
assert.equal(oak.groups.find((item:any) => item.id === 'glass').options.length, 4);
assert.equal(oak.groups.find((item:any) => item.id === 'finish').options.length, 2);
assert.equal(oak.groups.some((item:any) => item.id === 'layout'), false, 'unsupported Oak entrance layouts must not be fabricated');
const oakMetrics = getShowroomMetrics(identityByReference.get('WRP-D003'), oak);
assert.equal(isShowroomReadyProduct(oakMetrics), true);
assert.equal(classifyShowroomProduct(oakMetrics), 'showroom-ready');
assert.equal(classifyShowroomProduct({ ...oakMetrics, totalUsefulMediaCount: 1 }), 'media-limited');
assert.ok(metrics.filter(isShowroomReadyProduct).length >= 30, 'at least 30 products should meet the meaningful showroom-ready threshold');
assert.ok(metrics.filter(item => item.hasTechnicalOrLayoutContext).length >= 25, 'technical or layout context should cover most products');

const optionComponent = await readFile(new URL('../../src/components/VisualOptionGroup.astro', import.meta.url), 'utf8');
assert.match(optionComponent, /<button/);
assert.match(optionComponent, /aria-pressed/);
assert.match(optionComponent, /aria-live/);
assert.match(optionComponent, /data-option-status/);
const diagramComponent = await readFile(new URL('../../src/components/IllustrativeConfiguration.astro', import.meta.url), 'utf8');
assert.match(diagramComponent, /Illustrative configuration — not to scale/);
assert.match(diagramComponent, /role="img"/);

const schema:any = buildPublicProductSchema(({ displayName: 'Oak-Grain Fiberglass Entry Door', summary: 'A verified public-safe door description.', media: { src: '/media/products/wrp-d003-1200.webp', srcset: '/media/products/wrp-d003-1200.webp 1200w', width: 1200, height: 1200, alt: 'Oak-grain fiberglass entry door' }, gallery: [], showroom: oak, reference: 'WRP-D003', category: 'entry-doors', categoryLabel: 'Entry door', href: '/products/entry-doors/oak-grain-fiberglass-entry-door/', specifications: [{ label: 'Material', value: 'Fiberglass' }] }) as any, new URL('https://windowreplacement.pro/'));
assert.equal(schema['@type'], 'ProductGroup');
assert.equal(Object.hasOwn(schema, 'hasVariant'), false, 'visual choices must not fabricate confidential schema variants');
assert.doesNotMatch(JSON.stringify(schema), confidential);
console.log('Public product-showroom configuration, compatibility, accessibility and readiness tests: OK');