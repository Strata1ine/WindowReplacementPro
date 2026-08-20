import productsRaw from './editorial/products.json';
import relationshipsRaw from './editorial/relationships.json';
import mediaRaw from './editorial/media-selections.json';
import documentsRaw from './editorial/document-selections.json';

export type EditorialRecordClass = 'canonical-product' | 'variant-configuration' | 'source-only';
export type EditorialWorkflowState = 'source-only' | 'facts-ready' | 'editorial-draft' | 'editorial-reviewed' | 'publishable' | 'published';

export type CustomerTaxonomyProduct = {
  productId: string;
  manufacturer: string;
  name: string;
  slug: string;
  recordClass: EditorialRecordClass;
  liveCanonical: boolean;
  historicalCanonical: boolean;
  parentProductId: string | null;
  familyId: string;
  collection: string;
  rootCategory: string;
  primaryCategory: string;
  secondaryCategories: string[];
  attributes: string[];
  customerUseCases: string[];
  classificationEvidence: string[];
  canonicalSpecifications: Record<string, { value: string | string[]; sourceFactKey: string; evidenceRef: string }>;
  comparison: { schema: string; populatedFields: string[]; missingFields: string[]; ready: boolean };
  editorialState: EditorialWorkflowState;
  previouslyPublishable: boolean;
  publicationPreserved: boolean;
  relatedProductIds: string[];
};

export const customerTaxonomyProducts = productsRaw.records as unknown as CustomerTaxonomyProduct[];
export const editorialProductById = new Map(customerTaxonomyProducts.map(product => [product.productId, product]));

if (editorialProductById.size !== customerTaxonomyProducts.length) {
  throw new TypeError('editorial products contain duplicate productId values');
}

export const editorialRelationships = relationshipsRaw;
export const editorialMediaSelections = mediaRaw;
export const editorialDocumentSelections = documentsRaw;

export const editorialAllowsPublication = (productId: string): boolean => {
  const record = editorialProductById.get(productId);
  return record?.recordClass === 'canonical-product'
    && (record.editorialState === 'publishable' || record.editorialState === 'published');
};
