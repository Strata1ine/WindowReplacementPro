export const catalogCategories = ['windows', 'entry-doors', 'patio-doors', 'door-glass', 'unclassified'] as const;

export type CatalogCategory = (typeof catalogCategories)[number];
export type CatalogSpecificationValue = string | string[];

export type SourceReferenceStatus = 'active' | 'redirected' | 'unavailable' | 'stale' | 'blocked';

export type CatalogSourceReference = {
  supplier: string;
  sourceUrl: string;
  extractedAt: string;
  status: SourceReferenceStatus;
  sourceDocument?: string;
  localPath?: string;
};

export type CatalogFact = {
  value: CatalogSpecificationValue;
  sources: CatalogSourceReference[];
};

export type CatalogEditorial = {
  status: 'draft' | 'incomplete';
  summary: string | null;
  bestFor: string | null;
  keyFeatures: string[];
  considerations: string[];
  configurationNotes: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
  generatedAt: string;
};

export type CatalogEnrichment = {
  productId: string;
  sourceFacts: {
    manufacturer: CatalogFact;
    sourceUrl: CatalogFact;
    sourceDescription: string | null;
    modelNumber: CatalogFact | null;
    collection: CatalogFact | null;
    normalized: Record<string, CatalogFact>;
    sourceDocuments: CatalogSourceReference[];
    sourceMedia: CatalogSourceReference[];
  };
  editorial: CatalogEditorial;
};

export type CatalogProduct = {
  id: string;
  manufacturer: string;
  slug: string;
  name: string;
  category: CatalogCategory;
  collection: string | null;
  modelNumber: string | null;
  type: string | null;
  summary: string | null;
  sourceDescription?: string | null;
  sourceUrl: string;
  sourceType: string;
  media: string[];
  documents: string[];
  specifications: Record<string, CatalogSpecificationValue>;
  lastVerified: string;
  sourceFacts?: CatalogEnrichment['sourceFacts'];
  editorial?: CatalogEditorial;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requiredString = (record: Record<string, unknown>, key: string, label: string): string => {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${label}.${key} must be a non-empty string`);
  return value;
};

const nullableString = (record: Record<string, unknown>, key: string, label: string): string | null => {
  const value = record[key];
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new TypeError(`${label}.${key} must be a string or null`);
  return value;
};

const stringArray = (record: Record<string, unknown>, key: string, label: string): string[] => {
  const value = record[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) throw new TypeError(`${label}.${key} must be an array of strings`);
  return [...value];
};

const normalizeSpecifications = (record: Record<string, unknown>, label: string): Record<string, CatalogSpecificationValue> => {
  const value = record.specifications;
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) throw new TypeError(`${label}.specifications must be an object`);
  const normalized: Record<string, CatalogSpecificationValue> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string') normalized[key] = item;
    else if (Array.isArray(item) && item.every(entry => typeof entry === 'string')) normalized[key] = [...item];
    else throw new TypeError(`${label}.specifications.${key} must be a string or array of strings`);
  }
  return normalized;
};

export function normalizeCatalogProducts(input: unknown, sourceLabel: string): CatalogProduct[] {
  if (!Array.isArray(input)) throw new TypeError(`${sourceLabel} must contain a JSON array`);
  return input.map((value, index) => {
    const label = `${sourceLabel}[${index}]`;
    if (!isRecord(value)) throw new TypeError(`${label} must be an object`);
    const category = requiredString(value, 'category', label);
    const normalizedCategory = catalogCategories.find(candidate => candidate === category);
    if (!normalizedCategory) throw new TypeError(`${label}.category is not supported: ${category}`);
    return {
      id: requiredString(value, 'id', label),
      manufacturer: requiredString(value, 'manufacturer', label),
      slug: requiredString(value, 'slug', label),
      name: requiredString(value, 'name', label),
      category: normalizedCategory,
      collection: nullableString(value, 'collection', label),
      modelNumber: nullableString(value, 'modelNumber', label),
      type: nullableString(value, 'type', label),
      summary: nullableString(value, 'summary', label),
      sourceDescription: nullableString(value, 'sourceDescription', label),
      sourceUrl: requiredString(value, 'sourceUrl', label),
      sourceType: requiredString(value, 'sourceType', label),
      media: stringArray(value, 'media', label),
      documents: stringArray(value, 'documents', label),
      specifications: normalizeSpecifications(value, label),
      lastVerified: requiredString(value, 'lastVerified', label)
    };
  });
}

export function assertUniqueCatalogRecords(records: CatalogProduct[], sourceLabel: string): void {
  const ids = new Set<string>();
  const routes = new Map<string, string>();
  for (const product of records) {
    if (ids.has(product.id)) throw new TypeError(`${sourceLabel} contains duplicate id: ${product.id}`);
    ids.add(product.id);
    const route = `${product.manufacturer}/${product.slug}`;
    const existingId = routes.get(route);
    if (existingId) throw new TypeError(`${sourceLabel} contains duplicate route ${route}: ${existingId} and ${product.id}`);
    routes.set(route, product.id);
  }
}

const meaningfulString = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim() !== '';

const mergeStrings = (existing: string[], incoming: string[]): string[] =>
  Array.from(new Set([...existing, ...incoming].filter(meaningfulString))).sort();

const mergeSpecifications = (
  existing: Record<string, CatalogSpecificationValue>,
  incoming: Record<string, CatalogSpecificationValue>
): Record<string, CatalogSpecificationValue> => Object.fromEntries(
  Object.entries({ ...existing, ...incoming })
    .filter(([, value]) => typeof value === 'string' ? value.trim() !== '' : value.length > 0)
    .sort(([left], [right]) => left.localeCompare(right))
);

const incomingOrExisting = (incoming: string | null, existing: string | null): string | null =>
  meaningfulString(incoming) ? incoming : existing;

/**
 * Merge order is deterministic: curated records establish route identity and
 * discovered records may enrich meaningful scalar, media, document, and
 * specification values. Empty discovered values never erase curated data.
 */
export function mergeCatalogProducts(curated: CatalogProduct[], discovered: CatalogProduct[]): CatalogProduct[] {
  assertUniqueCatalogRecords(curated, 'curated catalogue');
  assertUniqueCatalogRecords(discovered, 'discovered catalogue');
  const byId = new Map(curated.map(product => [product.id, product]));
  for (const incoming of discovered) {
    const existing = byId.get(incoming.id);
    if (!existing) {
      byId.set(incoming.id, incoming);
      continue;
    }
    if (incoming.manufacturer !== existing.manufacturer || incoming.slug !== existing.slug) {
      throw new TypeError(`Conflicting route identity for ${incoming.id}`);
    }
    byId.set(incoming.id, {
      ...existing,
      name: incomingOrExisting(incoming.name, existing.name) ?? existing.name,
      category: incoming.category === 'unclassified' ? existing.category : incoming.category,
      collection: incomingOrExisting(incoming.collection, existing.collection),
      modelNumber: incomingOrExisting(incoming.modelNumber, existing.modelNumber),
      type: incomingOrExisting(incoming.type, existing.type),
      summary: incomingOrExisting(incoming.summary, existing.summary),
      sourceDescription: incomingOrExisting(incoming.sourceDescription ?? null, existing.sourceDescription ?? null),
      sourceUrl: incomingOrExisting(incoming.sourceUrl, existing.sourceUrl) ?? existing.sourceUrl,
      sourceType: incomingOrExisting(incoming.sourceType, existing.sourceType) ?? existing.sourceType,
      media: mergeStrings(existing.media, incoming.media),
      documents: mergeStrings(existing.documents, incoming.documents),
      specifications: mergeSpecifications(existing.specifications, incoming.specifications),
      lastVerified: incoming.lastVerified >= existing.lastVerified ? incoming.lastVerified : existing.lastVerified
    });
  }
  const merged = Array.from(byId.values());
  assertUniqueCatalogRecords(merged, 'merged catalogue');
  return merged.sort((left, right) =>
    left.manufacturer.localeCompare(right.manufacturer) || left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
  );
}

export function applyCatalogEnrichment(products: CatalogProduct[], enrichment: CatalogEnrichment[]): CatalogProduct[] {
  const byId = new Map(enrichment.map(item => [item.productId, item]));
  if (byId.size !== enrichment.length) throw new TypeError('catalog enrichment contains duplicate productId values');
  return products.map(product => {
    const item = byId.get(product.id);
    if (!item) return product;
    const normalizedSpecifications = Object.fromEntries(
      Object.entries(item.sourceFacts.normalized).map(([key, fact]) => [key, fact.value])
    );
    return {
      ...product,
      summary: item.editorial.status === 'draft' ? item.editorial.summary : product.summary,
      specifications: mergeSpecifications(product.specifications, normalizedSpecifications),
      sourceFacts: item.sourceFacts,
      editorial: item.editorial
    };
  });
}
const placeholderTitle = /^(home|item|product|products|catalog|collection|exterior|doorglass)$/i;

export function isPublishableProduct(product: CatalogProduct, validManufacturers: ReadonlySet<string>): boolean {
  const meaningfulSpecifications = Object.values(product.specifications).some(value =>
    typeof value === 'string' ? value.trim() !== '' : value.some(item => item.trim() !== '')
  );
  const sourceBackedFacts = product.sourceFacts
    ? Object.keys(product.sourceFacts.normalized).length
    : Object.keys(product.specifications).length;
  const editorialSummary = product.editorial?.status === 'draft'
    ? product.editorial.summary
    : product.summary;
  const substantiveFeatures = (product.editorial?.keyFeatures.length ?? 0) >= 3;
  return validManufacturers.has(product.manufacturer)
    && product.category !== 'unclassified'
    && meaningfulString(product.name)
    && !placeholderTitle.test(product.name.trim())
    && meaningfulString(product.sourceUrl)
    && sourceBackedFacts > 0
    && meaningfulString(editorialSummary)
    && (meaningfulSpecifications || substantiveFeatures);
}
