export type PublicIdentityRecord = {
  internalCanonicalId: string;
  publicDisplayName: string;
  publicSlug: string;
  publicReference: string;
  publicCategory: string;
  publicCategoryLabel: string;
  publicSummary: string;
  publicMetaDescription: string;
  publicImageAlt: string;
  publicMediaKey: string;
  publicSpecifications: { label: string; value: string }[];
  publicKeyFeatures: string[];
  publicBestFor: string[];
  publicConfigurationOptions: string[];
  publicConsiderations: string[];
  publicQuoteNote: string;
  publicBrowseGroup: string;
  publicBrowseFacets: string[];
  publicComparisonTags: string[];
  publicPublicationStatus: string;
};

export type PublicIdentityContext = {
  recordClass: string;
  editorialState: string;
  internalManufacturer: string;
  internalName: string;
  internalModelNumber: string | null;
  mediaRelationshipState: string | null;
};

export const publicCategories = ['windows', 'entry-doors', 'door-glass', 'patio-doors'] as const;

export const publicSupplierPatterns: RegExp[] = [
  /vinyl[- ]?pro/i,
  /window[- ]?city/i,
  /masonite/i,
  /trimlite/i,
  /nova\s?tech/i,
  /verre[- ]?select/i,
  /mennie(?:[- ]?canada)?/i,
  /richersons/i,
  /oceanview/i,
  /vista(?:[- ]?patio[- ]?doors)?/i,
  /vinyl-pro\.ca/i,
  /windowcity\.com/i,
  /masonite\.com/i,
  /trimlite\.com/i,
  /groupenovatech\.com/i,
  /verreselect\.com/i,
  /menniecanada\.com/i,
  /richersonsdoors\.com/i,
  /oceanviewdoors\.ca/i,
  /vistapatiodoors\.com/i
];

const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function validatePublicIdentity(
  record: PublicIdentityRecord,
  context: PublicIdentityContext
): string[] {
  const errors: string[] = [];
  const required = [
    record.publicDisplayName,
    record.publicSlug,
    record.publicReference,
    record.publicCategory,
    record.publicCategoryLabel,
    record.publicMetaDescription,
    record.publicSummary,
    record.publicImageAlt,
    record.publicMediaKey,
    record.publicQuoteNote,
    record.publicBrowseGroup
  ];

  if (record.publicPublicationStatus !== 'approved') errors.push('public identity is not approved');
  if (required.some(value => !value?.trim())) errors.push('public identity has missing required fields');
  const summaryWords = record.publicSummary.trim().split(/\s+/).filter(Boolean).length;
  if (summaryWords < 80 || summaryWords > 150) errors.push('public summary must contain 80 to 150 words');
  if (record.publicMetaDescription.length < 80 || record.publicMetaDescription.length > 180) errors.push('public meta description must contain 80 to 180 characters');
  if (record.publicKeyFeatures.length < 3 || record.publicKeyFeatures.length > 7) errors.push('public key features must contain 3 to 7 items');
  if (record.publicBestFor.length < 2) errors.push('public best-for guidance is insufficient');
  if (record.publicConfigurationOptions.length < 2) errors.push('public configuration guidance is insufficient');
  if (record.publicConsiderations.length < 2) errors.push('public considerations are insufficient');
  if (!record.publicBrowseFacets.length || !record.publicComparisonTags.length) errors.push('public browsing and comparison data is missing');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.publicSlug)) errors.push('public slug is invalid');
  if (!/^WRP-[WDGP]\d{3}$/.test(record.publicReference)) errors.push('public reference is invalid');
  if (!/^wrp-[wdgp]\d{3}$/.test(record.publicMediaKey)) errors.push('public media key is invalid');
  if (!publicCategories.includes(record.publicCategory as typeof publicCategories[number])) {
    errors.push('public category is invalid');
  }
  if (!record.publicSpecifications.length) errors.push('approved public specifications are missing');
  if (context.recordClass !== 'canonical-product' || context.editorialState !== 'published') {
    errors.push('internal record is not a published canonical product');
  }
  if (context.mediaRelationshipState !== 'product-specific') {
    errors.push('public hero media is not product-specific');
  }

  const publicText = [
    record.publicDisplayName,
    record.publicSlug,
    record.publicReference,
    record.publicCategoryLabel,
    record.publicMetaDescription,
    record.publicSummary,
    record.publicImageAlt,
    record.publicMediaKey,
    record.publicQuoteNote,
    record.publicBrowseGroup,
    ...record.publicSpecifications.flatMap(item => [item.label, item.value]),
    ...record.publicKeyFeatures,
    ...record.publicBestFor,
    ...record.publicConfigurationOptions,
    ...record.publicConsiderations,
    ...record.publicBrowseFacets,
    ...record.publicComparisonTags
  ].join(' ');

  if (publicSupplierPatterns.some(pattern => pattern.test(publicText))) {
    errors.push('public identity contains a supplier name, slug, or domain');
  }
  if (/\b(?:premium quality|exceptional craftsmanship|transform your home|elevate curb appeal|perfect blend|cutting-edge|industry-leading)\b/i.test(publicText)) {
    errors.push('public editorial contains prohibited marketing language');
  }
  if (normalized(record.publicDisplayName) === normalized(context.internalName)) {
    errors.push('public display name reuses the internal supplier title');
  }
  const model = normalized(context.internalModelNumber ?? '');
  if (model.length >= 3 && normalized(publicText).includes(model)) {
    errors.push('public identity contains the internal model number');
  }
  const manufacturer = normalized(context.internalManufacturer);
  if (manufacturer && normalized(publicText).includes(manufacturer)) {
    errors.push('public identity contains the internal manufacturer');
  }

  return Array.from(new Set(errors));
}

export function isPublicIdentityApproved(
  record: PublicIdentityRecord,
  context: PublicIdentityContext
): boolean {
  return validatePublicIdentity(record, context).length === 0;
}
