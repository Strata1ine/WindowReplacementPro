import { publishableCatalogProducts } from './catalog';
import {
  customerTaxonomyProducts,
  editorialMediaSelections
} from './editorial';
import identitiesRaw from './public-identities.json';
import mediaPlanRaw from './public-media-plan.json';
import mappingsRaw from './internal/public-product-mappings.json';
import { publicProductEditorial } from './public-product-editorial';
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
  galleryMedia?: EditorialMediaAsset[];
};

type PublicMediaPlan = {
  publicReference: string;
  key: string;
  productId: string;
  selection: 'heroMedia' | 'galleryMedia' | 'technicalMedia';
  selectionIndex?: number;
  role: 'hero' | 'gallery' | 'technical';
  alt: string;
  intrinsicWidth: number;
  intrinsicHeight: number;
  widths: number[];
  format?: 'webp' | 'jpg';
};

type PublicProductMapping = {
  publicProductId: string;
  primaryInternalProductId: string;
  internalProductIds: string[];
  evidence: {
    productId: string;
    classificationEvidence: string[];
    specificationEvidence: string[];
  }[];
  compatibilityConstraints: string[];
  selectionNotes: string;
  heroSelection: { productId: string; selection: 'heroMedia' };
  gallerySelections: { productId: string; selection: 'galleryMedia'; index: number; alt: string }[];
};

export type PublicMedia = {
  src: string;
  srcset: string;
  width: number;
  height: number;
  alt: string;
};

export type PublicProduct = {
  displayName: string;
  slug: string;
  reference: string;
  category: string;
  categoryLabel: string;
  metaDescription: string;
  summary: string;
  imageAlt: string;
  specifications: { label: string; value: string }[];
  keyFeatures: string[];
  bestFor: string[];
  configurationOptions: string[];
  considerations: string[];
  quoteNote: string;
  browseGroup: string;
  browseFacets: string[];
  comparisonTags: string[];
  selectionGuidance: string;
  projectGuidance: string;
  comparisonGuidance: string;
  href: string;
  media: PublicMedia;
  gallery: PublicMedia[];
};

const identities = identitiesRaw as PublicIdentityRecord[];
const plans = mediaPlanRaw as PublicMediaPlan[];
const mappings = mappingsRaw as PublicProductMapping[];
const taxonomyById = new Map(customerTaxonomyProducts.map(product => [product.productId, product]));
const catalogById = new Map(publishableCatalogProducts.map(product => [product.id, product]));
const mediaSelections = editorialMediaSelections as unknown as { products: ProductMediaSelection[] };
const mediaById = new Map(mediaSelections.products.map(product => [product.productId, product]));
const mappingByReference = new Map(mappings.map(mapping => [mapping.publicProductId, mapping]));
const plansByReference = new Map<string, PublicMediaPlan[]>();
for (const plan of plans) {
  const current = plansByReference.get(plan.publicReference) ?? [];
  current.push(plan);
  plansByReference.set(plan.publicReference, current);
}

if (mappingByReference.size !== mappings.length) throw new TypeError('public product mappings contain duplicate references');

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

const expectedRootCategory: Record<string, string> = {
  windows: 'replacement-windows',
  'entry-doors': 'entry-doors',
  'door-glass': 'door-glass',
  'patio-doors': 'patio-doors'
};

export const publicIdentityReview = identities.map(record => {
  const errors = validatePublicIdentity(record, contextFor(record));
  const recordPlans = plansByReference.get(record.publicReference) ?? [];
  const heroPlan = recordPlans.find(plan => plan.role === 'hero');
  if (!heroPlan) errors.push('public hero media plan is missing');
  if (heroPlan && heroPlan.key !== record.publicMediaKey) errors.push('public hero media plan key mismatch');
  if (recordPlans.some(plan => !plan.alt?.trim())) errors.push('public media alt text is missing');

  const mapping = mappingByReference.get(record.publicReference);
  if (!mapping) errors.push('confidential public product mapping is missing');
  if (mapping && mapping.primaryInternalProductId !== record.internalCanonicalId) errors.push('confidential mapping primary does not match public identity');
  if (mapping && (!mapping.internalProductIds.length || !mapping.compatibilityConstraints.length || !mapping.selectionNotes.trim())) {
    errors.push('confidential mapping evidence or constraints are incomplete');
  }
  if (mapping) {
    const evidenceIds = new Set(mapping.evidence.map(item => item.productId));
    for (const productId of mapping.internalProductIds) {
      const taxonomy = taxonomyById.get(productId);
      if (!taxonomy || taxonomy.recordClass !== 'canonical-product' || taxonomy.editorialState !== 'published') {
        errors.push('mapped internal product is not a published canonical product');
      }
      if (taxonomy && taxonomy.rootCategory !== expectedRootCategory[record.publicCategory]) {
        errors.push('mapped internal product category is incompatible');
      }
      if (!evidenceIds.has(productId)) errors.push('mapped internal product evidence is missing');
    }
  }
  return { internalCanonicalId: record.internalCanonicalId, publicReference: record.publicReference, approved: errors.length === 0, errors: Array.from(new Set(errors)) };
});

export const isPublicIdentityApproved = (record: PublicIdentityRecord): boolean => {
  const review = publicIdentityReview.find(item => item.publicReference === record.publicReference);
  return Boolean(review?.approved && policyApproves(record, contextFor(record)));
};

for (const review of publicIdentityReview) {
  if (!review.approved) {
    throw new TypeError('Invalid approved public identity ' + review.publicReference + ': ' + review.errors.join('; '));
  }
}

const buildPublicMedia = (plan: PublicMediaPlan): PublicMedia => {
  const largestWidth = Math.max(...plan.widths);
  const extension = plan.format ?? 'webp';
  return {
    src: '/media/products/' + plan.key + '-' + largestWidth + '.' + extension,
    srcset: plan.widths.map(width => '/media/products/' + plan.key + '-' + width + '.' + extension + ' ' + width + 'w').join(', '),
    width: largestWidth,
    height: Math.round(largestWidth * plan.intrinsicHeight / plan.intrinsicWidth),
    alt: plan.alt
  };
};

const repeatedSummarySentences = [
  'The opening, exterior exposure, glazing package and installation method are reviewed before a final system is named in the written quotation.',
  'Room use and the required balance of ventilation and fixed glass are documented at the same time.',
  'The final slab, frame, swing, glass, finish, hardware and installation details are coordinated after the entrance is measured and reviewed.',
  'The complete entrance is treated as one coordinated assembly rather than a slab-only purchase.',
  'Glass size, privacy, compatible door construction and the complete entrance configuration are confirmed before the exact design is named in the written quotation.',
  'Current samples are reviewed from both sides under representative lighting before careful final approval.',
  'Panel layout, frame construction, glazing, hardware, sill support and installation conditions are confirmed for the measured opening in the written quotation.',
  'Clear opening width and everyday panel operation are reviewed with the proposed layout.'
];

const customerSummary = (record: PublicIdentityRecord): string => {
  let summary = record.publicSummary;
  for (const sentence of repeatedSummarySentences) summary = summary.replace(sentence, '');
  summary = summary
    .replace(/\b(?:product |door-glass |decorative-glass |privacy-glass |patio-door |sliding patio-door |horizontal sliding patio-door )?family\b/gi, match => match.replace(/family/i, 'option'))
    .replace('across the mapped systems', 'among available slab constructions')
    .replace('The mapped systems are not interchangeable: reinforcement, sightlines, dimensions, tested performance and warranty must remain tied to the selected model.', 'Reinforcement, sightlines, dimensions and documented performance must be checked for the selected frame and panel size.')
    .replace('The mapped products represent more than one construction direction and are compared privately before quoting.', 'Thermal design, visible profile width and panel limits must be checked for the measured opening.')
    .replace('the material stack is not identical across mapped products', 'the material stack varies by construction');
  if (record.publicReference === 'WRP-D010') summary = summary.replace('Smooth and woodgrain surfaces are available.', 'Available surface choices include smooth and woodgrain finishes.');
  return summary.replace(/\s+/g, ' ').trim();
};

const editorialReferences = Object.keys(publicProductEditorial);
if (editorialReferences.length !== identities.length || identities.some(record => !publicProductEditorial[record.publicReference])) {
  throw new TypeError('Public product editorial must cover all 40 approved references exactly');
}

const toPublicProduct = (record: PublicIdentityRecord): PublicProduct => {
  const recordPlans = plansByReference.get(record.publicReference) ?? [];
  const heroPlan = recordPlans.find(plan => plan.role === 'hero');
  if (!heroPlan) throw new TypeError('Public hero plan missing for ' + record.publicReference);
  const editorial = publicProductEditorial[record.publicReference];
  const replaceConsideration = (value: string) => editorial.considerationReplacements?.[value] ?? value;
  return {
    displayName: record.publicDisplayName,
    slug: record.publicSlug,
    reference: record.publicReference,
    category: record.publicCategory,
    categoryLabel: record.publicCategoryLabel,
    metaDescription: record.publicMetaDescription,
    summary: customerSummary(record),
    imageAlt: record.publicImageAlt,
    specifications: record.publicSpecifications,
    keyFeatures: record.publicKeyFeatures,
    bestFor: record.publicBestFor,
    configurationOptions: record.publicConfigurationOptions,
    considerations: record.publicConsiderations.map(replaceConsideration),
    quoteNote: record.publicQuoteNote,
    browseGroup: record.publicBrowseGroup,
    browseFacets: record.publicBrowseFacets,
    comparisonTags: record.publicComparisonTags,
    selectionGuidance: editorial.selectionGuidance,
    projectGuidance: editorial.projectGuidance,
    comparisonGuidance: editorial.comparisonGuidance,
    href: '/products/' + record.publicCategory + '/' + record.publicSlug + '/',
    media: buildPublicMedia(heroPlan),
    gallery: recordPlans.filter(plan => plan.role === 'gallery').map(buildPublicMedia)
  };
};

export const publicProducts = identities
  .filter(isPublicIdentityApproved)
  .map(toPublicProduct)
  .sort((left, right) => left.reference.localeCompare(right.reference));

const publicProductByReference = new Map(publicProducts.map(product => [product.reference, product]));
const publicProductByInternalId = new Map(
  identities
    .filter(isPublicIdentityApproved)
    .map(record => [record.internalCanonicalId, toPublicProduct(record)])
);
for (const mapping of mappings) {
  const product = publicProductByReference.get(mapping.publicProductId);
  if (!product) continue;
  for (const internalProductId of mapping.internalProductIds) {
    if (!publicProductByInternalId.has(internalProductId)) publicProductByInternalId.set(internalProductId, product);
  }
}

export const getPublicProductByInternalId = (internalCanonicalId: string): PublicProduct | undefined =>
  publicProductByInternalId.get(internalCanonicalId);

export const getPublicProductsByCategory = (category: string): PublicProduct[] =>
  publicProducts.filter(product => product.category === category);

export const getRelatedPublicProducts = (product: PublicProduct, limit = 3): PublicProduct[] => {
  const tags = new Set(product.comparisonTags);
  const facets = new Set(product.browseFacets);
  return publicProducts
    .filter(candidate => candidate.category === product.category && candidate.reference !== product.reference)
    .map(candidate => ({
      candidate,
      score:
        (candidate.browseGroup === product.browseGroup ? 8 : 0) +
        candidate.comparisonTags.filter(tag => tags.has(tag)).length * 2 +
        candidate.browseFacets.filter(facet => facets.has(facet)).length
    }))
    .sort((left, right) => right.score - left.score || left.candidate.reference.localeCompare(right.candidate.reference))
    .slice(0, limit)
    .map(item => item.candidate);
};
