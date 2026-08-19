import curatedRaw from './catalog/curated-products.json';
import enrichmentRaw from './catalog/enrichment-records.json';
import { manufacturers } from './manufacturers';
import {
  applyCatalogEnrichment,
  isPublishableProduct,
  mergeCatalogProducts,
  normalizeCatalogProducts,
  type CatalogEnrichment,
  type CatalogProduct
} from './catalog-schema';

export type { CatalogProduct } from './catalog-schema';

const discoveredModules = import.meta.glob<unknown>('./catalog/discovered/*.json', {
  eager: true,
  import: 'default'
});

const curated = normalizeCatalogProducts(curatedRaw, 'curated-products.json');
const discovered = Object.entries(discoveredModules)
  .sort(([left], [right]) => left.localeCompare(right))
  .flatMap(([path, raw]) => normalizeCatalogProducts(raw, path));

export const catalogProducts: CatalogProduct[] = applyCatalogEnrichment(
  mergeCatalogProducts(curated, discovered),
  enrichmentRaw as unknown as CatalogEnrichment[]
);
const manufacturerSlugs = new Set(manufacturers.map(manufacturer => manufacturer.slug));
export const publishableCatalogProducts = catalogProducts.filter(product => isPublishableProduct(product, manufacturerSlugs));

export const getManufacturerProducts = (slug: string, publishableOnly = false) =>
  (publishableOnly ? publishableCatalogProducts : catalogProducts).filter(product => product.manufacturer === slug);
export const getCategoryProducts = (category: string, publishableOnly = false) =>
  (publishableOnly ? publishableCatalogProducts : catalogProducts).filter(product => product.category === category);
