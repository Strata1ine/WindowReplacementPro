export type PublicIdentityRecord = {
  internalCanonicalId: string;
  publicDisplayName: string;
  publicSlug: string;
  publicReference: string;
  publicCategory: string;
  publicCategoryLabel: string;
  publicSummary: string;
  publicImageAlt: string;
  publicMediaKey: string;
  publicSpecifications: { label: string; value: string }[];
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
    record.publicSummary,
    record.publicImageAlt,
    record.publicMediaKey
  ];

  if (record.publicPublicationStatus !== 'approved') errors.push('public identity is not approved');
  if (required.some(value => !value?.trim())) errors.push('public identity has missing required fields');
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
    record.publicSummary,
    record.publicImageAlt,
    record.publicMediaKey,
    ...record.publicSpecifications.flatMap(item => [item.label, item.value])
  ].join(' ');

  if (publicSupplierPatterns.some(pattern => pattern.test(publicText))) {
    errors.push('public identity contains a supplier name, slug, or domain');
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
