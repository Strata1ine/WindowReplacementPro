import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const editorial = JSON.parse(await readFile(path.join(root, 'src/data/editorial/products.json'), 'utf8')).records;
const identities = JSON.parse(await readFile(path.join(root, 'src/data/public-identities.json'), 'utf8'));
const media = JSON.parse(await readFile(path.join(root, 'src/data/editorial/media-selections.json'), 'utf8')).products;
const documents = JSON.parse(await readFile(path.join(root, 'src/data/editorial/document-selections.json'), 'utf8')).products;
const approvedById = new Map(identities.filter(item => item.publicPublicationStatus === 'approved').map(item => [item.internalCanonicalId, item]));
const mediaById = new Map(media.map(item => [item.productId, item]));
const documentsById = new Map(documents.map(item => [item.productId, item]));
const published = editorial.filter(item => item.recordClass === 'canonical-product' && item.editorialState === 'published');

const records = published.map(item => {
  const identity = approvedById.get(item.productId);
  const mediaSelection = mediaById.get(item.productId);
  const documentSelection = documentsById.get(item.productId);
  const hasMedia = Boolean(mediaSelection?.heroMedia || mediaSelection?.galleryMedia?.length || mediaSelection?.technicalMedia?.length);
  const hasDocuments = Boolean(documentSelection?.publicDocuments?.length || documentSelection?.referenceDocuments?.length);
  if (identity) {
    return {
      internalCanonicalId: item.productId,
      internalManufacturer: item.manufacturer,
      internalTitle: item.name,
      baselinePublicRoute: '/products/' + item.manufacturer + '/' + item.slug + '/',
      classification: 'supplier-neutral and safe',
      requirements: [],
      publicDisplayName: identity.publicDisplayName,
      publicReference: identity.publicReference,
      publicRoute: '/products/' + identity.publicCategory + '/' + identity.publicSlug + '/'
    };
  }
  const requirements = ['requires public rename', 'requires public slug change'];
  if (hasMedia) requirements.push('requires media sanitization');
  if (hasDocuments) requirements.push('requires document removal');
  requirements.push('category-only until reviewed');
  return {
    internalCanonicalId: item.productId,
    internalManufacturer: item.manufacturer,
    internalTitle: item.name,
    baselinePublicRoute: '/products/' + item.manufacturer + '/' + item.slug + '/',
    classification: 'category-only until reviewed',
    requirements,
    publicDisplayName: null,
    publicReference: null,
    publicRoute: null
  };
});

const countRequirement = requirement => records.filter(record => record.requirements.includes(requirement)).length;
const report = {
  generatedAt: new Date().toISOString(),
  policy: 'Supplier-backed records require an explicitly reviewed neutral identity. No automatic public naming is permitted.',
  summary: {
    internallyPublishedProductsReviewed: records.length,
    supplierNeutralAndSafe: records.filter(record => record.classification === 'supplier-neutral and safe').length,
    requiresPublicRename: countRequirement('requires public rename'),
    requiresPublicSlugChange: countRequirement('requires public slug change'),
    requiresMediaSanitization: countRequirement('requires media sanitization'),
    requiresDocumentRemoval: countRequirement('requires document removal'),
    categoryOnlyUntilReviewed: countRequirement('category-only until reviewed')
  },
  records
};
const outputDirectory = path.join(root, 'audit/public-confidentiality');
await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, 'product-identity-review.json'), JSON.stringify(report, null, 2) + '\n');
console.log('Reviewed ' + records.length + ' internally published products: ' + report.summary.supplierNeutralAndSafe + ' public, ' + report.summary.categoryOnlyUntilReviewed + ' held.');
