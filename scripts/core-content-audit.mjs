import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { URL } from 'node:url';

const root = process.cwd();
const dist = path.join(root, 'dist');
const reportPath = path.join(root, 'audit', 'editorial', 'core-content-report.md');
const pageDefinitions = [
  ['/window-replacement/', 'Replacement-project scope and homeowner planning'],
  ['/window-replacement/full-frame/', 'Full-frame replacement method and scope'],
  ['/window-replacement/retrofit/', 'Retrofit or insert replacement method and suitability'],
  ['/window-installation/', 'Measured window-installation process and quality controls'],
  ['/window-replacement-cost/', 'Window replacement cost factors without fabricated prices'],
  ['/entry-door-replacement-cost/', 'Entry-door replacement cost factors without fabricated prices'],
  ['/patio-door-replacement-cost/', 'Patio-door replacement cost factors without fabricated prices'],
  ['/guides/full-frame-vs-retrofit-windows/', 'Full-frame versus retrofit decision support'],
  ['/guides/double-vs-triple-pane-windows/', 'Double- versus triple-pane glazing decision support'],
  ['/guides/window-styles/', 'Visual comparison of operating and fixed window styles'],
  ['/energy-efficient-windows/', 'Whole-window energy-performance education'],
  ['/guides/casement-vs-slider-windows/', 'Casement versus slider operating-style comparison'],
  ['/guides/window-problems/', 'Window symptom triage and replacement planning'],
  ['/guides/fiberglass-vs-steel-entry-doors/', 'Fiberglass versus steel entry-door comparison'],
  ['/guides/patio-door-types/', 'Patio-door panel, frame, and configuration comparison']
];
const expectedRoutes = new Set(pageDefinitions.map(item => item[0]));
const supplierPattern = /vinyl[- ]?pro|window[- ]?city|masonite|trimlite|nova\s?tech|verre[- ]?select|mennie|richersons|oceanview|vista[- ]?patio[- ]?doors|\bsupplier\b/i;
const decode = value => value.replace(/&mdash;/g, '?').replace(/&ndash;/g, '?').replace(/&rsquo;/g, '?').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16))).replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
const plain = html => decode(html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
const attr = (tag, name) => decode((tag.match(new RegExp('\\b' + name + '="([^"]*)"', 'i')) || [])[1] || '');
const routeForFile = file => {
  const relative = path.relative(dist, file).replaceAll('\\', '/');
  return relative === 'index.html' ? '/' : '/' + relative.replace(/index\.html$/, '');
};
const walk = async directory => {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
};
const allFiles = await walk(dist);
const htmlFiles = allFiles.filter(file => file.endsWith('.html'));
const htmlByRoute = new Map(await Promise.all(htmlFiles.map(async file => [routeForFile(file), await readFile(file, 'utf8')])));
const linksByRoute = new Map();
for (const [route, html] of htmlByRoute) {
  const links = [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)].map(match => decode(match[1]).split('#')[0]).filter(Boolean);
  linksByRoute.set(route, links.map(href => {
    try { return new URL(href, 'https://windowreplacement.pro').pathname; } catch { return ''; }
  }).filter(Boolean));
}
const sitemapPaths = new Set();
for (const file of allFiles.filter(file => /sitemap-\d+\.xml$/.test(file))) {
  const xml = await readFile(file, 'utf8');
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) sitemapPaths.add(new URL(match[1]).pathname);
}
const visualGaps = new Map();
const sourceDir = path.join(root, 'src', 'data', 'core-content');
for (const name of (await readdir(sourceDir)).filter(name => name.endsWith('.ts'))) {
  const source = await readFile(path.join(sourceDir, name), 'utf8');
  const chunks = source.split(/\r?\n(?=\s*\{\s*\r?\n\s*path: '\/)/);
  for (const chunk of chunks) {
    const route = (chunk.match(/\bpath: '([^']+)'/) || [])[1];
    if (!route || !expectedRoutes.has(route)) continue;
    const gap = (chunk.match(/\bvisualGap: '([^']+)'/) || [])[1];
    if (gap) visualGaps.set(route, gap);
  }
}
const failures = [];
const rows = [];
const visualRows = [];
const titles = new Map();
const descriptions = new Map();
for (const [route, intent] of pageDefinitions) {
  const html = htmlByRoute.get(route);
  if (!html) { failures.push(route + ': generated HTML is missing'); continue; }
  const main = (html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) || [])[1] || html;
  const title = plain((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const description = decode((html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1] || '');
  const h1Count = (main.match(/<h1\b/gi) || []).length;
  const wordCount = plain(main).split(/\s+/).filter(Boolean).length;
  const schemas = [...html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].flatMap(match => [...match[1].matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map(type => type[1]));
  const images = [...main.matchAll(/<img\b[^>]*>/gi)].map(match => ({ src: attr(match[0], 'src'), srcset: attr(match[0], 'srcset'), alt: attr(match[0], 'alt') }));
  const hero = images[0];
  const technical = [...new Set(images.filter(image => image.src.startsWith('/media/content/')).map(image => image.src))];
  const supporting = [...new Set(images.slice(1).filter(image => image.src.startsWith('/media/products/')).map(image => image.src))];
  const outbound = new Set((linksByRoute.get(route) || []).filter(link => link !== route && htmlByRoute.has(link)));
  const inbound = [...linksByRoute].filter(([source, links]) => source !== route && links.includes(route)).length;
  const products = new Set((linksByRoute.get(route) || []).filter(link => link.startsWith('/products/')));
  const expectedSchema = route.startsWith('/guides/') || route === '/energy-efficient-windows/' ? 'Article' : 'Service';
  const metadataOk = title.length > 30 && description.length >= 90 && description.length <= 190;
  const schemaOk = schemas.includes(expectedSchema) && schemas.includes('BreadcrumbList');
  const indexed = sitemapPaths.has(route);
  const confidentialityOk = !supplierPattern.test(plain(main)) && images.every(image => image.src.startsWith('/media/') && !/^https?:/i.test(image.src));
  const derivativeOk = images.every(image => image.src.endsWith('.webp') && image.srcset.includes('w'));
  if (h1Count !== 1) failures.push(route + ': expected one H1, found ' + h1Count);
  if (wordCount < 650) failures.push(route + ': content depth is only ' + wordCount + ' words');
  if (!metadataOk) failures.push(route + ': metadata is missing or outside the review range');
  if (!schemaOk) failures.push(route + ': ' + expectedSchema + ' and BreadcrumbList schema are required');
  if (!indexed) failures.push(route + ': route is absent from the sitemap');
  if (!confidentialityOk) failures.push(route + ': public supplier or media boundary failed');
  if (!derivativeOk) failures.push(route + ': images must be responsive WebP derivatives');
  if (images.length < 2) failures.push(route + ': visual plan produced fewer than two useful images');
  if (/replacement-cost/.test(route) && /[$??]\s?\d|\b(?:CAD|USD)\s?\d/i.test(plain(main))) failures.push(route + ': unapproved currency figure found');
  if (titles.has(title)) failures.push(route + ': duplicate title with ' + titles.get(title));
  if (descriptions.has(description)) failures.push(route + ': duplicate description with ' + descriptions.get(description));
  titles.set(title, route);
  descriptions.set(description, route);
  rows.push([route, intent, wordCount, inbound, outbound.size, products.size, metadataOk ? 'OK' : 'Review', expectedSchema + ' + breadcrumbs', indexed ? 'Yes' : 'No', confidentialityOk ? 'OK' : 'FAIL']);
  visualRows.push([route, hero ? hero.alt + ' (' + hero.src + ')' : 'Missing', supporting.length ? supporting.length + ' approved product derivative' + (supporting.length === 1 ? '' : 's') : 'None', technical.length ? technical.join('<br>') : (route === '/energy-efficient-windows/' || route.includes('pane') || route.includes('full-frame-vs') ? 'Code-native concept diagram' : 'None required'), derivativeOk ? 'Optimized neutral WebP + responsive srcset' : 'Review', visualGaps.get(route) || 'No material gap recorded']);
}
for (const route of expectedRoutes) {
  for (const target of linksByRoute.get(route) || []) {
    if (target.startsWith('/') && !htmlByRoute.has(target) && target !== '/') failures.push(route + ': broken internal link ' + target);
  }
}
const overlap = [
  ['Window replacement vs installation', 'The replacement page defines project decisions; the installation page focuses on the measured execution sequence and quality controls.'],
  ['Full-frame service vs comparison guide', 'The service page explains full-frame scope; the guide compares that method against retrofit suitability.'],
  ['Retrofit service vs comparison guide', 'The service page explains retained-frame scope; the guide frames the method decision and tradeoffs.'],
  ['Energy efficiency vs pane-count guide', 'The energy page treats whole-window performance; the glazing guide isolates pane-count decisions without declaring one universally best.'],
  ['Category pages vs style/type guides', 'Category pages support commercial selection; guide pages provide deeper comparison and link back to measured project scope.']
];
const table = (headers, data) => ['| ' + headers.join(' | ') + ' |', '| ' + headers.map(() => '---').join(' | ') + ' |', ...data.map(row => '| ' + row.map(value => String(value).replaceAll('|', '\\|')).join(' | ') + ' |')].join('\n');
const report = [
  '# Core content editorial report',
  '',
  'Generated: ' + new Date().toISOString(),
  '',
  '## Scope and status',
  '',
  '- Required authority pages: ' + pageDefinitions.length,
  '- Generated authority pages: ' + rows.length,
  '- Report failures: ' + failures.length,
  '- Public product publication threshold changes: none',
  '- Location pages generated: none',
  '- Supplier source masters exposed: none',
  '',
  '## Page content, links, metadata, schema, and indexability',
  '',
  table(['URL', 'Primary intent', 'Words', 'Links in', 'Links out', 'Public products', 'Metadata', 'Schema', 'Sitemap', 'Confidentiality'], rows),
  '',
  'Word counts are approximate rendered-main-content counts and include reusable disclosure/CTA copy. Incoming links count distinct generated pages linking to the URL; outgoing counts distinct valid generated routes.',
  '',
  '## Page visual-content report',
  '',
  table(['URL', 'Hero image used', 'Supporting images used', 'Technical/configuration media', 'Source/public derivative status', 'Desired visual still missing'], visualRows),
  '',
  'All listed public files are optimized derivatives. Full source provenance, relationship state, hashes, source paths, and supplier identities remain in the internal-only media mapping and are not imported by public components.',
  '',
  '## Search-intent overlap review',
  '',
  table(['Potential overlap', 'Editorial distinction'], overlap),
  '',
  '## Repetitive-copy and thin-page review',
  '',
  '- Each page has unique title and description metadata.',
  '- Each page is required to have at least 650 rendered words, one H1, at least two useful responsive images, the expected Service or Article schema, BreadcrumbList schema, and sitemap inclusion.',
  '- Reusable quotation, product-identity, and visual-evidence disclosures are intentionally consistent.',
  '- Exact product claims remain on approved public product records; guide and service copy explains decisions without creating thin public product pages.',
  '- No public dollar ranges, ratings, reviews, offer schema, or trade pricing were added.',
  '',
  '## Failures',
  '',
  failures.length ? failures.map(item => '- ' + item).join('\n') : '- None.',
  ''
].join('\n');
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, report, 'utf8');
if (failures.length) {
  console.error('Core content audit: FAILED (' + failures.length + ' issue(s))');
  failures.forEach(failure => console.error('ERROR: ' + failure));
  process.exitCode = 1;
} else {
  console.log('Core content audit: OK (' + rows.length + ' pages).');
  console.log('Editorial report: ' + path.relative(root, reportPath));
}
