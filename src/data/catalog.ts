import curatedProducts from './catalog/curated-products.json';
import discoveredProducts from './catalog/discovered-products.json';

export type CatalogProduct = {
  id: string;
  manufacturer: string;
  slug: string;
  name: string;
  category: string;
  collection?: string | null;
  modelNumber?: string | null;
  type?: string | null;
  summary?: string | null;
  sourceUrl: string;
  sourceType: string;
  media: string[];
  documents: string[];
  specifications: Record<string, string | string[]>;
  lastVerified: string;
};

const byId = new Map<string, CatalogProduct>();
for (const item of [...(curatedProducts as CatalogProduct[]), ...(discoveredProducts as CatalogProduct[])]) {
  const existing = byId.get(item.id);
  byId.set(item.id, existing ? {
    ...existing,
    ...item,
    media: Array.from(new Set([...(existing.media || []), ...(item.media || [])])),
    documents: Array.from(new Set([...(existing.documents || []), ...(item.documents || [])])),
    specifications: { ...(existing.specifications || {}), ...(item.specifications || {}) }
  } : item);
}

export const catalogProducts = Array.from(byId.values()).sort((a,b) => a.manufacturer.localeCompare(b.manufacturer) || a.name.localeCompare(b.name));
export const getManufacturerProducts = (slug: string) => catalogProducts.filter(p => p.manufacturer === slug);
export const getCategoryProducts = (category: string) => catalogProducts.filter(p => p.category === category);
