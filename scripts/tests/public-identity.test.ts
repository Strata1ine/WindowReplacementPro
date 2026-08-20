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

assert.equal(identities.length, 4);
for (const identity of identities) {
  assert.deepEqual(validatePublicIdentity(identity, contextFor(identity)), []);
  assert.equal(isPublicIdentityApproved(identity, contextFor(identity)), true);
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

console.log('Public identity gate tests: 4 approved identities and 7 rejection cases passed.');
