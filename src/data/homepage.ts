import { manufacturers } from './manufacturers';
import { publishableCatalogProducts, type CatalogProduct } from './catalog';
import {
  customerTaxonomyProducts,
  editorialMediaSelections,
  type CustomerTaxonomyProduct
} from './editorial';
import mediaPlanRaw from './homepage-media-plan.json';

type EditorialMediaAsset = {
  localPath: string;
  role: string;
  relationshipState: 'product-specific' | 'collection-shared' | 'supplier-shared' | 'uncertain/review';
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
  galleryMedia: EditorialMediaAsset[];
  technicalMedia: EditorialMediaAsset[];
  finishMedia: EditorialMediaAsset[];
  configurationMedia: EditorialMediaAsset[];
};

type HomepageMediaPlan = {
  key: string;
  productId: string;
  selection: 'heroMedia';
  intrinsicWidth: number;
  intrinsicHeight: number;
  widths: number[];
};

export type HomepageMedia = {
  src: string;
  srcset: string;
  width: number;
  height: number;
  provenance: {
    productId: string;
    supplier: string;
    role: string;
    relationshipState: string;
    sourceUrl: string;
    sourcePageUrls: string[];
    sha256: string;
    sourceLocalPath: string;
  };
};

const mediaSelections = editorialMediaSelections as unknown as { products: ProductMediaSelection[] };
const mediaSelectionByProductId = new Map(mediaSelections.products.map(item => [item.productId, item]));
const mediaPlan = mediaPlanRaw as HomepageMediaPlan[];
const mediaPlanByProductId = new Map(mediaPlan.map(item => [item.productId, item]));

const buildHomepageMedia = (productId: string): HomepageMedia => {
  const plan = mediaPlanByProductId.get(productId);
  const selection = mediaSelectionByProductId.get(productId);
  const asset = selection?.heroMedia;
  if (!plan || !asset) throw new TypeError(`Missing approved homepage media for ${productId}`);
  if (asset.relationshipState !== 'product-specific') {
    throw new TypeError(`Homepage media is not product-specific: ${productId}`);
  }

  const largestWidth = Math.max(...plan.widths);
  return {
    src: `/images/site/homepage/${plan.key}-${largestWidth}.webp`,
    srcset: plan.widths.map(width => `/images/site/homepage/${plan.key}-${width}.webp ${width}w`).join(', '),
    width: largestWidth,
    height: Math.round(largestWidth * plan.intrinsicHeight / plan.intrinsicWidth),
    provenance: {
      productId,
      supplier: asset.supplier,
      role: asset.role,
      relationshipState: asset.relationshipState,
      sourceUrl: asset.sourceUrl,
      sourcePageUrls: asset.sourcePageUrls,
      sha256: asset.sha256,
      sourceLocalPath: asset.localPath
    }
  };
};

const catalogById = new Map(publishableCatalogProducts.map(product => [product.id, product]));
export const homepagePublishedProducts = customerTaxonomyProducts.filter(product =>
  product.recordClass === 'canonical-product'
  && product.editorialState === 'published'
  && catalogById.has(product.productId)
);

if (homepagePublishedProducts.length !== publishableCatalogProducts.length) {
  throw new TypeError(
    `Homepage publication set drifted: ${homepagePublishedProducts.length} editorial records vs `
    + `${publishableCatalogProducts.length} publishable catalogue records`
  );
}

export const homepagePublishedProductCount = homepagePublishedProducts.length;

const countWhere = (predicate: (product: CustomerTaxonomyProduct) => boolean) =>
  homepagePublishedProducts.filter(predicate).length;

const countRoot = (rootCategory: string) =>
  countWhere(product => product.rootCategory === rootCategory);

export const homepageCategoryPaths = [
  {
    rootCategory: 'replacement-windows',
    title: 'Replacement windows',
    description: 'Compare operating styles, fixed glazing, frame materials and glass packages.',
    href: '/windows/',
    count: countRoot('replacement-windows'),
    countLabel: 'published window products',
    media: buildHomepageMedia('window-city:hc-101'),
    imageAlt: 'Window City HC-101 casement replacement window'
  },
  {
    rootCategory: 'entry-doors',
    title: 'Entry doors',
    description: 'Explore published fiberglass door designs, profiles and configuration options.',
    href: '/doors/',
    count: countRoot('entry-doors'),
    countLabel: 'published entry-door products',
    media: buildHomepageMedia('masonite:2-panel-hollister'),
    imageAlt: 'Masonite two-panel Hollister fiberglass entry door'
  },
  {
    rootCategory: 'door-glass',
    title: 'Door glass',
    description: 'Review decorative, privacy, clear and contemporary doorglass designs.',
    href: '/doors/decorative-door-glass/',
    count: countRoot('door-glass'),
    countLabel: 'published door-glass products',
    media: buildHomepageMedia('novatech:infinite-black'),
    imageAlt: 'Novatech Infinite Black contemporary door glass'
  },
  {
    rootCategory: 'patio-doors',
    title: 'Patio doors',
    description: 'Compare sliding systems, frame materials, glazing and panel configurations.',
    href: '/patio-doors/',
    count: countRoot('patio-doors'),
    countLabel: 'published patio-door products',
    media: buildHomepageMedia('oceanview:premium-plus'),
    imageAlt: 'Oceanview Premium Plus sliding patio door'
  }
].filter(category => category.count > 0);

const countPrimary = (root: string, categories: string[]) =>
  countWhere(product => product.rootCategory === root && categories.includes(product.primaryCategory));

export const homepageWindowStyles = [
  {
    title: 'Casement',
    description: 'Side-hinged operation with crank hardware.',
    href: '/windows/casement-windows/',
    count: countPrimary('replacement-windows', ['casement-windows'])
  },
  {
    title: 'Awning',
    description: 'Top-hinged operation for controlled ventilation.',
    href: '/windows/awning-windows/',
    count: countPrimary('replacement-windows', ['awning-windows'])
  },
  {
    title: 'Hung',
    description: 'Single- and double-hung vertical sash options.',
    href: '/windows/',
    count: countPrimary('replacement-windows', ['single-hung-windows', 'double-hung-windows'])
  },
  {
    title: 'Slider',
    description: 'Single, double and end-vent horizontal layouts.',
    href: '/windows/',
    count: countPrimary('replacement-windows', ['single-slider-windows', 'double-slider-windows', 'end-vent-windows'])
  },
  {
    title: 'Picture & fixed',
    description: 'Non-operating glazing for daylight and views.',
    href: '/windows/picture-windows/',
    count: countPrimary('replacement-windows', ['picture-windows', 'fixed-windows'])
  }
].filter(style => style.count > 0);

type TaxonomyOption = {
  title: string;
  count: number;
  href: string;
};

const option = (
  rootCategory: string,
  title: string,
  href: string,
  predicate: (product: CustomerTaxonomyProduct) => boolean
): TaxonomyOption => ({
  title,
  href,
  count: countWhere(product => product.rootCategory === rootCategory && predicate(product))
});

const primaryOrSecondary = (category: string) => (product: CustomerTaxonomyProduct) =>
  product.primaryCategory === category || product.secondaryCategories.includes(category);

export const homepageTaxonomyGroups = [
  {
    title: 'Entry-door families',
    description: 'Published materials and design directions.',
    href: '/doors/',
    options: [
      option('entry-doors', 'Fiberglass', '/doors/fiberglass-entry-doors/', product =>
        product.primaryCategory === 'fiberglass-entry-doors' || product.attributes.includes('fiberglass')),
      option('entry-doors', 'Contemporary', '/doors/', product =>
        product.secondaryCategories.includes('contemporary-entry-doors')),
      option('entry-doors', 'Traditional', '/doors/', product =>
        product.secondaryCategories.includes('traditional-entry-doors')),
      option('entry-doors', 'Craftsman', '/doors/', product =>
        product.secondaryCategories.includes('craftsman-entry-doors')),
      option('entry-doors', 'Full glass', '/doors/', product =>
        product.secondaryCategories.includes('full-glass-entry-doors') || product.attributes.includes('full-glass'))
    ].filter(item => item.count > 0)
  },
  {
    title: 'Door-glass styles',
    description: 'Published appearance and privacy groupings.',
    href: '/doors/decorative-door-glass/',
    options: [
      option('door-glass', 'Decorative', '/doors/decorative-door-glass/', primaryOrSecondary('decorative-door-glass')),
      option('door-glass', 'Privacy', '/doors/decorative-door-glass/', primaryOrSecondary('privacy-door-glass')),
      option('door-glass', 'Clear', '/doors/decorative-door-glass/', primaryOrSecondary('clear-door-glass')),
      option('door-glass', 'Modern', '/doors/decorative-door-glass/', primaryOrSecondary('modern-door-glass'))
    ].filter(item => item.count > 0)
  },
  {
    title: 'Patio-door systems',
    description: 'Published operating and frame families.',
    href: '/patio-doors/',
    options: [
      option('patio-doors', 'Sliding', '/patio-doors/sliding-patio-doors/', product =>
        product.primaryCategory === 'sliding-patio-doors'),
      option('patio-doors', 'PVC', '/patio-doors/', product =>
        product.secondaryCategories.includes('pvc-patio-doors') || product.attributes.includes('pvc')),
      option('patio-doors', 'Aluminum', '/patio-doors/', product =>
        product.secondaryCategories.includes('aluminum-patio-doors') || product.attributes.includes('aluminum')),
      option('patio-doors', 'Hybrid', '/patio-doors/', product =>
        product.secondaryCategories.includes('hybrid-patio-doors') || product.attributes.includes('hybrid'))
    ].filter(item => item.count > 0)
  }
].filter(group => group.options.length > 0);

const compactValue = (value: string | string[]): string => {
  const text = Array.isArray(value) ? value.join(', ') : value;
  return text.length > 76 ? `${text.slice(0, 73).trimEnd()}...` : text;
};

const specificationLabels: Record<string, string> = {
  operationType: 'Operation',
  material: 'Material',
  glazingOptions: 'Glazing',
  panelConfiguration: 'Configuration',
  privacyLevel: 'Privacy',
  frameDepth: 'Frame'
};

const preferredSpecificationKeys = Object.keys(specificationLabels);

const conciseEditorialSummary = (product: CatalogProduct): string => {
  const summary = product.editorial?.summary ?? product.summary ?? '';
  const sourceEvidenceIndex = summary.indexOf('The saved supplier evidence');
  if (sourceEvidenceIndex > 0) return summary.slice(0, sourceEvidenceIndex).trim();
  const firstSentence = summary.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
  return firstSentence || summary.slice(0, 180).trim();
};

const buildFeaturedProduct = (productId: string) => {
  const taxonomy = homepagePublishedProducts.find(product => product.productId === productId);
  const catalog = catalogById.get(productId);
  if (!taxonomy || !catalog) throw new TypeError(`Featured product is not published: ${productId}`);

  const highlights = preferredSpecificationKeys
    .filter(key => taxonomy.canonicalSpecifications[key])
    .slice(0, 3)
    .map(key => ({
      label: specificationLabels[key],
      value: compactValue(taxonomy.canonicalSpecifications[key].value)
    }));

  return {
    productId,
    name: taxonomy.name,
    manufacturer: manufacturers.find(item => item.slug === taxonomy.manufacturer)?.name ?? taxonomy.manufacturer,
    category: {
      'replacement-windows': 'Replacement window',
      'entry-doors': 'Entry door',
      'door-glass': 'Door glass',
      'patio-doors': 'Patio door'
    }[taxonomy.rootCategory] ?? 'Product',
    href: `/products/${catalog.manufacturer}/${catalog.slug}/`,
    summary: conciseEditorialSummary(catalog),
    highlights,
    media: buildHomepageMedia(productId),
    imageAlt: `${taxonomy.name} by ${manufacturers.find(item => item.slug === taxonomy.manufacturer)?.name ?? taxonomy.manufacturer}`
  };
};

export const homepageFeaturedProducts = [
  'window-city:hc-101',
  'masonite:2-panel-hollister',
  'novatech:infinite-black',
  'oceanview:premium-plus'
].map(buildFeaturedProduct);

const rootCategoryLabels: Record<string, string> = {
  'replacement-windows': 'Windows',
  'entry-doors': 'Entry doors',
  'door-glass': 'Door glass',
  'patio-doors': 'Patio doors'
};

export const homepageManufacturers = manufacturers
  .map(manufacturer => {
    const products = homepagePublishedProducts.filter(product => product.manufacturer === manufacturer.slug);
    const categories = Array.from(new Set(products.map(product => rootCategoryLabels[product.rootCategory])))
      .filter((category): category is string => Boolean(category));
    return {
      name: manufacturer.name,
      href: `/brands/${manufacturer.slug}/`,
      productCount: products.length,
      categories
    };
  })
  .filter(manufacturer => manufacturer.productCount > 0);

export const homepageSpecificationTopics = [
  'Frame material and construction',
  'Glass package and coatings',
  'Operating style and ventilation',
  'Hardware and security',
  'Colour and finish options',
  'Opening size and configuration',
  'Installation method and scope',
  'Manufacturer documentation and warranty'
];

export const homepageProcessSteps = [
  { title: 'Identify the opening', text: 'Start with the window, entry door or patio opening you need to replace.' },
  { title: 'Compare product types', text: 'Review only the operating styles and material families supported by published records.' },
  { title: 'Choose key options', text: 'Narrow glazing, finish, hardware and configuration choices before final pricing.' },
  { title: 'Confirm site conditions', text: 'A site measure establishes the actual opening, access and installation requirements.' },
  { title: 'Review the scope', text: 'Compare the product, installation details, exclusions and documentation in the quote.' },
  { title: 'Install and verify', text: 'Complete the work, operation check and product-document handoff.' }
];
