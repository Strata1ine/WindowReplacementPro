import type { PublicProduct } from './public-catalog';

const variesByByCategory: Record<string, string[]> = {
  windows: ['Opening size', 'Glazing package', 'Frame and finish configuration', 'Installation method'],
  'entry-doors': ['Opening size', 'Swing', 'Frame and sill', 'Glass, finish and hardware configuration'],
  'door-glass': ['Glass size', 'Privacy and texture', 'Compatible door slab', 'Entrance configuration'],
  'patio-doors': ['Opening size', 'Panel layout', 'Glazing package', 'Sill, screen and hardware configuration']
};

export function buildPublicProductSchema(product: PublicProduct, site: URL) {
  const variesBy = variesByByCategory[product.category];
  if (!variesBy) throw new TypeError('Missing ProductGroup variation semantics for ' + product.category);
  return {
    '@context': 'https://schema.org',
    '@type': 'ProductGroup',
    name: product.displayName,
    description: product.summary,
    image: [product.media, ...product.gallery].map(media => new URL(media.src, site).href),
    productGroupID: product.reference,
    category: product.categoryLabel,
    url: new URL(product.href, site).href,
    variesBy,
    additionalProperty: product.specifications.map(item => ({ '@type': 'PropertyValue', name: item.label, value: item.value }))
  } as const;
}