import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  isPublicIdentityApproved,
  validatePublicIdentity,
  type PublicIdentityContext,
  type PublicIdentityRecord
} from '../../src/data/public-identity-policy.ts';

const root = process.cwd();
const identities = JSON.parse(readFileSync(path.join(root, 'src/data/public-identities.json'), 'utf8')) as PublicIdentityRecord[];
const mappings = JSON.parse(readFileSync(path.join(root, 'src/data/internal/public-product-mappings.json'), 'utf8'));
const plans = JSON.parse(readFileSync(path.join(root, 'src/data/public-media-plan.json'), 'utf8'));
const editorial = JSON.parse(readFileSync(path.join(root, 'src/data/editorial/products.json'), 'utf8')).records;
const media = JSON.parse(readFileSync(path.join(root, 'src/data/editorial/media-selections.json'), 'utf8')).products;
const editorialById = new Map(editorial.map((item: any) => [item.productId, item]));
const mediaById = new Map(media.map((item: any) => [item.productId, item]));

const contextFor = (record: PublicIdentityRecord): PublicIdentityContext => {
  const internal: any = editorialById.get(record.internalCanonicalId);
  const selection: any = mediaById.get(record.internalCanonicalId);
  return {
    recordClass: internal?.recordClass ?? '',
    editorialState: internal?.editorialState ?? '',
    internalManufacturer: internal?.manufacturer ?? '',
    internalName: internal?.name ?? '',
    internalModelNumber: null,
    mediaRelationshipState: selection?.heroMedia?.relationshipState ?? null
  };
};

assert.equal(identities.length, 40);
assert.deepEqual(
  Object.fromEntries(['windows', 'entry-doors', 'door-glass', 'patio-doors'].map(category => [category, identities.filter(item => item.publicCategory === category).length])),
  { windows: 10, 'entry-doors': 12, 'door-glass': 12, 'patio-doors': 6 }
);
assert.equal(mappings.length, identities.length);
assert.equal(plans.filter((item: any) => item.role === 'hero').length, identities.length);
assert.equal(new Set(identities.map(item => item.publicReference)).size, identities.length);
assert.equal(new Set(identities.map(item => item.publicCategory + '/' + item.publicSlug)).size, identities.length);

for (const identity of identities) {
  assert.deepEqual(validatePublicIdentity(identity, contextFor(identity)), [], identity.publicReference);
  assert.equal(isPublicIdentityApproved(identity, contextFor(identity)), true);
  const mapping = mappings.find((item: any) => item.publicProductId === identity.publicReference);
  assert.ok(mapping);
  assert.equal(mapping.primaryInternalProductId, identity.internalCanonicalId);
  assert.ok(mapping.internalProductIds.length >= 1);
  assert.ok(mapping.compatibilityConstraints.length >= 1);
  assert.ok(mapping.selectionNotes.length >= 1);
}

const fixture = identities[0];
const context = contextFor(fixture);
assert.ok(validatePublicIdentity({ ...fixture, publicDisplayName: 'Window City Casement' }, context).some(error => error.includes('supplier')));
assert.ok(validatePublicIdentity({ ...fixture, publicSlug: 'window-city-casement' }, context).some(error => error.includes('supplier')));
assert.ok(validatePublicIdentity({ ...fixture, publicDisplayName: context.internalName }, context).some(error => error.includes('supplier title')));
assert.ok(validatePublicIdentity(fixture, { ...context, internalModelNumber: 'HC-101' }).length === 0);
assert.ok(validatePublicIdentity({ ...fixture, publicSummary: fixture.publicSummary + ' HC-101' }, { ...context, internalModelNumber: 'HC-101' }).some(error => error.includes('model number')));
assert.ok(validatePublicIdentity(fixture, { ...context, mediaRelationshipState: 'collection-shared' }).some(error => error.includes('product-specific')));
assert.ok(validatePublicIdentity({ ...fixture, publicPublicationStatus: 'pending' }, context).some(error => error.includes('not approved')));
assert.ok(validatePublicIdentity({ ...fixture, publicSummary: 'Too short.' }, context).some(error => error.includes('80 to 150 words')));
assert.ok(validatePublicIdentity({ ...fixture, publicKeyFeatures: ['One'] }, context).some(error => error.includes('3 to 7 items')));
assert.ok(validatePublicIdentity({ ...fixture, publicSummary: fixture.publicSummary + ' Premium quality.' }, context).some(error => error.includes('prohibited marketing language')));

console.log('Public identity gate tests: 40 approved identities, balanced category counts, confidential mappings, media plans, and 10 rejection cases passed.');
