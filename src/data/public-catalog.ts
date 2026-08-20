import { publishableCatalogProducts } from './catalog';
import {
  customerTaxonomyProducts,
  editorialMediaSelections
} from './editorial';
import identitiesRaw from './public-identities.json';
import mediaPlanRaw from './public-media-plan.json';
import {
  isPublicIdentityApproved as policyApproves,
  validatePublicIdentity,
  type PublicIdentityContext,
  type PublicIdentityRecord
} from './public-identity-policy';

type EditorialMediaAsset = {
  localPath: string;
  role: string;
  relationshipState: string;
  supplier: string;
  sourceUrl: string;
  sourcePageUrls: string[];
  sha256: string;
  width: number | null;
  height: number | null;
};

type ProductMediaSelection = {
  productId: string;
  heroMedia: EditorialMediaAsset | null;
};

type PublicMediaPlan = {
  key: string;
  productId: string;
  selection: 'heroMedia';
  intrinsicWidth: number;
  intrinsicHeight: number;
  widths: number[];
  format?: 'webp' | 'jpg';
};

export type PublicMedia = {
  src: string;
  srcset: string;
  width: number;
  height: number;
};

export type PublicProduct = {
  displayName: string;
  slug: string;
  reference: string;
  category: string;
  categoryLabel: string;
  summary: string;
  imageAlt: string;
  specifications: { label: string; value: string }[];
  href: string;
  media: PublicMedia;
};

const identities = identitiesRaw as PublicIdentityRecord[];
const plans = mediaPlanRaw as PublicMediaPlan[];
const taxonomyById = new Map(customerTaxonomyProducts.map(product => [product.productId, product]));
const catalogById = new Map(publishableCatalogProducts.map(product => [product.id, product]));
const mediaSelections = editorialMediaSelections as unknown as { products: ProductMediaSelection[] };
const mediaById = new Map(mediaSelections.products.map(product => [product.productId, product]));
const planById = new Map(plans.map(plan => [plan.productId, plan]));

const contextFor = (record: PublicIdentityRecord): PublicIdentityContext => {
  const taxonomy = taxonomyById.get(record.internalCanonicalId);
  const catalog = catalogById.get(record.internalCanonicalId);
  const media = mediaById.get(record.internalCanonicalId)?.heroMedia;
  return {
    recordClass: taxonomy?.recordClass ?? '',
    editorialState: taxonomy?.editorialState ?? '',
    internalManufacturer: taxonomy?.manufacturer ?? catalog?.manufacturer ?? '',
    internalName: taxonomy?.name ?? catalog?.name ?? '',
    internalModelNumber: catalog?.modelNumber ?? null,
    mediaRelationshipState: media?.relationshipState ?? null
  };
};

export const publicIdentityReview = identities.map(record => {
  const errors = validatePublicIdentity(record, contextFor(record));
  if (!planById.has(record.internalCanonicalId)) errors.push('public media plan is missing');
  return { internalCanonicalId: record.internalCanonicalId, approved: errors.length === 0, errors };
});

export const isPublicIdentityApproved = (record: PublicIdentityRecord): boolean => {
  const review = publicIdentityReview.find(item => item.internalCanonicalId === record.internalCanonicalId);
  return Boolean(review?.approved && policyApproves(record, contextFor(record)));
};

for (const review of publicIdentityReview) {
  if (!review.approved) {
    throw new TypeError('Invalid approved public identity ' + review.internalCanonicalId + ': ' + review.errors.join('; '));
  }
}

const buildPublicMedia = (record: PublicIdentityRecord): PublicMedia => {
  const plan = planById.get(record.internalCanonicalId);
  if (!plan || plan.key !== record.publicMediaKey) {
    throw new TypeError('Public media plan mismatch for ' + record.internalCanonicalId);
  }
  const largestWidth = Math.max(...plan.widths);
  const extension = plan.format ?? 'webp';
  return {
    src: '/media/products/' + plan.key + '-' + largestWidth + '.' + extension,
    srcset: plan.widths.map(width => '/media/products/' + plan.key + '-' + width + '.' + extension + ' ' + width + 'w').join(', '),
    width: largestWidth,
    height: Math.round(largestWidth * plan.intrinsicHeight / plan.intrinsicWidth)
  };
};

const toPublicProduct = (record: PublicIdentityRecord): PublicProduct => ({
  displayName: record.publicDisplayName,
  slug: record.publicSlug,
  reference: record.publicReference,
  category: record.publicCategory,
  categoryLabel: record.publicCategoryLabel,
  summary: record.publicSummary,
  imageAlt: record.publicImageAlt,
  specifications: record.publicSpecifications,
  href: '/products/' + record.publicCategory + '/' + record.publicSlug + '/',
  media: buildPublicMedia(record)
});

export const publicProducts = identities
  .filter(isPublicIdentityApproved)
  .map(toPublicProduct)
  .sort((left, right) => left.reference.localeCompare(right.reference));

const publicProductByInternalId = new Map(
  identities
    .filter(isPublicIdentityApproved)
    .map(record => [record.internalCanonicalId, toPublicProduct(record)])
);

export const getPublicProductByInternalId = (internalCanonicalId: string): PublicProduct | undefined =>
  publicProductByInternalId.get(internalCanonicalId);
