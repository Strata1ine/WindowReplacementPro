import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const dist = path.join(root, 'dist');
const errors = [];
const textExtensions = new Set(['.html', '.xml', '.json', '.js', '.css', '.txt', '.svg', '.webmanifest']);
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const allowedProductCategories = new Set(['windows', 'entry-doors', 'door-glass', 'patio-doors']);
const supplierPatterns = [
  ['Vinyl-Pro', /vinyl[- ]?pro/i],
  ['Window City', /window[- ]?city/i],
  ['Masonite', /masonite/i],
  ['Trimlite', /trimlite/i],
  ['Novatech', /nova\s?tech/i],
  ['Verre Select', /verre[- ]?select/i],
  ['Mennie', /mennie(?:[- ]?canada)?/i],
  ['Richersons', /richersons/i],
  ['Oceanview', /oceanview/i],
  ['Vista Patio Doors', /vista[- ]?patio[- ]?doors/i]
];
const blockedText = [
  '/brands/',
  'source-media',
  '/images/catalog/',
  '/documents/catalog/',
  'supplier-discovery',
  'supplier manifest',
  'crawler checkpoint',
  'sourceUrl',
  'sourceDescription',
  'sourcePageUrls',
  'sourceLocalPath',
  'internalManufacturer',
  'internalModelNumber',
  'relationshipState'
];
const blockedTopLevel = new Set(['audit', 'brands', 'documents', 'scripts', 'source-media', 'staging', 'quarantine']);

const suppliers = JSON.parse(await readFile(path.join(root, 'scripts/ingest/suppliers.json'), 'utf8'));
const supplierDomains = Array.from(new Set(Object.values(suppliers).flatMap(config => [
  ...(config.allowed_domains ?? []),
  ...(config.asset_domains ?? [])
]))).sort();
const supplierSlugs = suppliers.map(config => config.slug);

const files = [];
const walk = async directory => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(full);
    if (entry.isFile()) files.push(full);
  }
};
await walk(dist);

for (const file of files) {
  const relative = path.relative(dist, file).replaceAll('\\', '/');
  const lowerPath = relative.toLowerCase();
  const topLevel = lowerPath.split('/')[0];
  if (blockedTopLevel.has(topLevel)) errors.push('blocked deployment directory: ' + relative);
  if (path.extname(lowerPath) === '.pdf') errors.push('raw document deployed: ' + relative);
  for (const slug of supplierSlugs) {
    const pathPattern = new RegExp('(^|[/_.-])' + slug.replaceAll('-', '[-_]') + '([/_.-]|$)', 'i');
    if (pathPattern.test(relative)) errors.push('supplier slug in public path: ' + relative);
  }
  for (const [name, pattern] of supplierPatterns) {
    if (pattern.test(relative)) errors.push(name + ' in public path: ' + relative);
  }

  const extension = path.extname(lowerPath);
  if (textExtensions.has(extension)) {
    const content = await readFile(file, 'utf8');
    for (const [name, pattern] of supplierPatterns) {
      if (pattern.test(content)) errors.push(name + ' in public text: ' + relative);
    }
    for (const domain of supplierDomains) {
      if (content.toLowerCase().includes(domain.toLowerCase())) errors.push('supplier domain in public text: ' + relative + ' (' + domain + ')');
    }
    for (const token of blockedText) {
      if (content.toLowerCase().includes(token.toLowerCase())) errors.push('blocked public token in ' + relative + ': ' + token);
    }
    if (/\bsupplier\b/i.test(content)) errors.push('supplier terminology in public text: ' + relative);
  }

  if (imageExtensions.has(extension)) {
    const metadata = await sharp(file).metadata();
    for (const field of ['exif', 'icc', 'iptc', 'xmp']) {
      if (metadata[field]) errors.push('public image retains ' + field + ' metadata: ' + relative);
    }
  }
}

const productIndexFiles = files.filter(file => {
  const relative = path.relative(dist, file).replaceAll('\\', '/');
  return /^products\/[^/]+\/[^/]+\/index\.html$/.test(relative);
});
for (const file of productIndexFiles) {
  const relative = path.relative(dist, file).replaceAll('\\', '/');
  const category = relative.split('/')[1];
  if (!allowedProductCategories.has(category)) errors.push('invalid public product category route: ' + relative);
}
if (productIndexFiles.length !== 4) errors.push('expected 4 identity-approved product routes, found ' + productIndexFiles.length);

const config = await readFile(path.join(root, 'astro.config.mjs'), 'utf8');
if (!/publicDir:\s*['"]\.\/public-site['"]/.test(config)) errors.push('Astro publicDir is not isolated to public-site');
for (const directory of ['source-media', 'audit', 'scripts', 'staging', 'quarantine']) {
  if (files.some(file => path.relative(dist, file).replaceAll('\\', '/').startsWith(directory + '/'))) {
    errors.push('internal directory copied into dist: ' + directory);
  }
}

const uniqueErrors = Array.from(new Set(errors)).sort();
if (uniqueErrors.length) {
  console.error('Public supplier leakage audit: FAILED (' + uniqueErrors.length + ' disclosure(s))');
  for (const error of uniqueErrors) console.error('ERROR: ' + error);
  process.exitCode = 1;
} else {
  console.log('Public supplier leakage audit: OK');
  console.log('Scanned ' + files.length + ' generated files, including ' + productIndexFiles.length + ' approved product routes.');
  console.log('Supplier names, domains, slugs, raw documents, provenance fields, and internal directories found: 0.');
}
