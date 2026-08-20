import {
  customerTaxonomyProducts,
  type CustomerTaxonomyProduct
} from './editorial';
import {
  getPublicProductByInternalId,
  type PublicMedia,
  type PublicProduct
} from './public-catalog';

export type HomepageMedia = PublicMedia;

const publishedCanonicalProducts = customerTaxonomyProducts.filter(product =>
  product.recordClass === 'canonical-product'
  && product.editorialState === 'published'
);
const countWhere = (predicate: (product: CustomerTaxonomyProduct) => boolean) =>
  publishedCanonicalProducts.filter(predicate).length;
const countRoot = (rootCategory: string) =>
  countWhere(product => product.rootCategory === rootCategory);
const requiredProduct = (internalCanonicalId: string): PublicProduct => {
  const product = getPublicProductByInternalId(internalCanonicalId);
  if (!product) throw new TypeError('Missing approved public product for ' + internalCanonicalId);
  return product;
};
const windowProduct = requiredProduct('window-city:hc-101');
const entryDoorProduct = requiredProduct('masonite:2-panel-hollister');
const doorGlassProduct = requiredProduct('novatech:infinite-black');
const patioDoorProduct = requiredProduct('oceanview:premium-plus');

const homepageCategoryCandidates = [
  { rootCategory: 'replacement-windows', title: 'Replacement windows', description: 'Compare operating styles, fixed glazing, frame materials and glass packages.', href: '/windows/', detail: 'Operating and fixed styles', media: windowProduct.media, imageAlt: windowProduct.imageAlt, mediaFit: 'cover' as const },
  { rootCategory: 'entry-doors', title: 'Entry doors', description: 'Explore fiberglass and steel materials, panel designs and complete entry configurations.', href: '/doors/', detail: 'Material and panel choices', media: entryDoorProduct.media, imageAlt: entryDoorProduct.imageAlt, mediaFit: 'contain' as const },
  { rootCategory: 'door-glass', title: 'Door glass', description: 'Review decorative, privacy, clear and contemporary door-glass designs.', href: '/doors/decorative-door-glass/', detail: 'Decorative and privacy glass', media: doorGlassProduct.media, imageAlt: doorGlassProduct.imageAlt, mediaFit: 'contain' as const },
  { rootCategory: 'patio-doors', title: 'Patio doors', description: 'Compare sliding systems, frame materials, glazing and panel configurations.', href: '/patio-doors/', detail: 'Sliding and multi-panel systems', media: patioDoorProduct.media, imageAlt: patioDoorProduct.imageAlt, mediaFit: 'cover' as const }
];
export const homepageCategoryPaths = homepageCategoryCandidates
  .filter(category => countRoot(category.rootCategory) > 0);

const countPrimary = (root: string, categories: string[]) =>
  countWhere(product => product.rootCategory === root && categories.includes(product.primaryCategory));
const homepageWindowStyleCandidates = [
  { title: 'Casement', description: 'Side-hinged operation with crank hardware.', href: '/windows/casement-windows/', available: countPrimary('replacement-windows', ['casement-windows']) > 0 },
  { title: 'Awning', description: 'Top-hinged operation for controlled ventilation.', href: '/windows/awning-windows/', available: countPrimary('replacement-windows', ['awning-windows']) > 0 },
  { title: 'Hung', description: 'Single- and double-hung vertical sash options.', href: '/windows/', available: countPrimary('replacement-windows', ['single-hung-windows', 'double-hung-windows']) > 0 },
  { title: 'Slider', description: 'Single, double and end-vent horizontal layouts.', href: '/windows/', available: countPrimary('replacement-windows', ['single-slider-windows', 'double-slider-windows', 'end-vent-windows']) > 0 },
  { title: 'Picture & fixed', description: 'Non-operating glazing for daylight and views.', href: '/windows/picture-windows/', available: countPrimary('replacement-windows', ['picture-windows', 'fixed-windows']) > 0 }
];
export const homepageWindowStyles = homepageWindowStyleCandidates
  .filter(style => style.available)
  .map(({ available: _available, ...style }) => style);

type TaxonomyOptionCandidate = { title: string; href: string; available: boolean };
const option = (
  rootCategory: string,
  title: string,
  href: string,
  predicate: (product: CustomerTaxonomyProduct) => boolean
): TaxonomyOptionCandidate => ({
  title,
  href,
  available: countWhere(product => product.rootCategory === rootCategory && predicate(product)) > 0
});
const availableOptions = (items: TaxonomyOptionCandidate[]) =>
  items.filter(item => item.available).map(({ available: _available, ...item }) => item);
const primaryOrSecondary = (category: string) => (product: CustomerTaxonomyProduct) =>
  product.primaryCategory === category || product.secondaryCategories.includes(category);

export const homepageTaxonomyGroups = [
  {
    title: 'Entry-door choices',
    description: 'Materials and design directions to compare.',
    href: '/doors/',
    options: availableOptions([
      option('entry-doors', 'Fiberglass', '/doors/fiberglass-entry-doors/', product => product.primaryCategory === 'fiberglass-entry-doors' || product.attributes.includes('fiberglass')),
      option('entry-doors', 'Contemporary', '/doors/', product => product.secondaryCategories.includes('contemporary-entry-doors')),
      option('entry-doors', 'Traditional', '/doors/', product => product.secondaryCategories.includes('traditional-entry-doors')),
      option('entry-doors', 'Craftsman', '/doors/', product => product.secondaryCategories.includes('craftsman-entry-doors')),
      option('entry-doors', 'Full glass', '/doors/', product => product.secondaryCategories.includes('full-glass-entry-doors') || product.attributes.includes('full-glass'))
    ])
  },
  {
    title: 'Door-glass styles',
    description: 'Appearance and privacy groupings.',
    href: '/doors/decorative-door-glass/',
    options: availableOptions([
      option('door-glass', 'Decorative', '/doors/decorative-door-glass/', primaryOrSecondary('decorative-door-glass')),
      option('door-glass', 'Privacy', '/doors/decorative-door-glass/', primaryOrSecondary('privacy-door-glass')),
      option('door-glass', 'Clear', '/doors/decorative-door-glass/', primaryOrSecondary('clear-door-glass')),
      option('door-glass', 'Modern', '/doors/decorative-door-glass/', primaryOrSecondary('modern-door-glass'))
    ])
  },
  {
    title: 'Patio-door systems',
    description: 'Operating and frame choices.',
    href: '/patio-doors/',
    options: availableOptions([
      option('patio-doors', 'Sliding', '/patio-doors/sliding-patio-doors/', product => product.primaryCategory === 'sliding-patio-doors'),
      option('patio-doors', 'PVC', '/patio-doors/', product => product.secondaryCategories.includes('pvc-patio-doors') || product.attributes.includes('pvc')),
      option('patio-doors', 'Aluminum', '/patio-doors/', product => product.secondaryCategories.includes('aluminum-patio-doors') || product.attributes.includes('aluminum')),
      option('patio-doors', 'Hybrid', '/patio-doors/', product => product.secondaryCategories.includes('hybrid-patio-doors') || product.attributes.includes('hybrid'))
    ])
  }
].filter(group => group.options.length > 0);

const featured = [windowProduct, entryDoorProduct, doorGlassProduct, patioDoorProduct];
export const homepageFeaturedProducts = featured.map(product => ({
  name: product.displayName,
  reference: product.reference,
  category: product.categoryLabel,
  href: product.href,
  summary: product.summary,
  highlights: product.specifications.slice(0, 3),
  media: product.media,
  imageAlt: product.imageAlt
}));

export const homepageSpecificationTopics = [
  'Frame material and construction',
  'Glass package and coatings',
  'Operating style and ventilation',
  'Hardware and security',
  'Colour and finish options',
  'Opening size and configuration',
  'Installation method and scope',
  'Quotation details and warranty'
];
export const homepageProcessSteps = [
  { title: 'Identify the opening', text: 'Start with the window, entry door or patio opening you need to replace.' },
  { title: 'Compare product types', text: 'Review the operating styles, materials and configurations that suit the project.' },
  { title: 'Choose key options', text: 'Narrow glazing, finish, hardware and configuration choices before final pricing.' },
  { title: 'Confirm site conditions', text: 'A site measure establishes the actual opening, access and installation requirements.' },
  { title: 'Review the scope', text: 'Compare the exact product, performance details, warranty, exclusions and installed price in the written quotation.' },
  { title: 'Install and verify', text: 'Complete the work, operation check and product-document handoff.' }
];
