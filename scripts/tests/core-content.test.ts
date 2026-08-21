import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const contentDirectory = path.join(root, 'src', 'data', 'core-content');
const sourceFiles = readdirSync(contentDirectory).filter(name => name.endsWith('.ts')).map(name => path.join(contentDirectory, name));
const source = sourceFiles.map(file => readFileSync(file, 'utf8')).join('\n');
const media = JSON.parse(readFileSync(path.join(root, 'src', 'data', 'core-content-media.json'), 'utf8'));
const expectedRoutes = [
  '/window-replacement/', '/window-replacement/full-frame/', '/window-replacement/retrofit/',
  '/window-installation/', '/window-replacement-cost/', '/entry-door-replacement-cost/',
  '/patio-door-replacement-cost/', '/guides/full-frame-vs-retrofit-windows/',
  '/guides/double-vs-triple-pane-windows/', '/guides/window-styles/',
  '/energy-efficient-windows/', '/guides/casement-vs-slider-windows/',
  '/guides/window-problems/', '/guides/fiberglass-vs-steel-entry-doors/',
  '/guides/patio-door-types/'
];
const valuesFor = (key: string) => [...source.matchAll(new RegExp("^    " + key + ": '([^']+)'", 'gm'))].map(match => match[1]);
const routes = valuesFor('path');
assert.deepEqual([...routes].sort(), [...expectedRoutes].sort(), 'core authority route set changed unexpectedly');
assert.equal(routes.length, new Set(routes).size, 'core authority routes must be unique');
for (const key of ['title', 'metaTitle', 'metaDescription', 'heroReference']) {
  const values = valuesFor(key);
  assert.equal(values.length, expectedRoutes.length, key + ' must exist on every core page');
  if (key.startsWith('meta')) assert.equal(values.length, new Set(values).size, key + ' values must be unique');
}
assert.equal((source.match(/\bvisualReferences: \[/g) || []).length, expectedRoutes.length, 'every page needs planned supporting media');
assert.equal((source.match(/\bproductReferences: \[/g) || []).length, expectedRoutes.length, 'every page needs approved public product references');
assert.equal((source.match(/\btechnicalMediaKeys: \[/g) || []).length, expectedRoutes.length, 'every page needs an explicit technical-media decision');
const pricingSource = readFileSync(path.join(contentDirectory, 'pricing-pages.ts'), 'utf8');
assert.equal(/[$??]\s?\d|\b(?:CAD|USD)\s?\d/i.test(pricingSource), false, 'pricing content must not invent public currency figures');
assert.equal(/\bsupplier\b/i.test(pricingSource), false, 'public pricing copy must not expose supplier terminology');
assert.ok(Array.isArray(media) && media.length >= 7, 'verified authority media manifest is unexpectedly small');
const mediaKeys = new Set();
for (const item of media) {
  assert.ok(!mediaKeys.has(item.key), 'duplicate authority media key: ' + item.key);
  mediaKeys.add(item.key);
  assert.match(item.media.src, /^\/media\/content\/wrp-content-[a-z0-9-]+\.webp$/, item.key + ' must use a neutral public path');
  assert.ok(item.media.srcset.split(',').every((entry: string) => /^\/media\/content\/wrp-content-[a-z0-9-]+\.webp \d+w$/.test(entry.trim())), item.key + ' has an invalid responsive srcset');
  assert.ok(item.media.width > 0 && item.media.height > 0, item.key + ' needs intrinsic dimensions');
  assert.equal(/https?:\/\/|sourceUrl|relationshipState|internalModel|supplier/i.test(JSON.stringify(item)), false, item.key + ' leaks provenance or supplier data');
}
const requestedMediaKeys = [...source.matchAll(/\btechnicalMediaKeys: \[([^\]]*)\]/g)].flatMap(match => [...match[1].matchAll(/'([^']+)'/g)].map(value => value[1]));
for (const key of requestedMediaKeys) assert.ok(mediaKeys.has(key), 'missing safe authority media key: ' + key);
const publicFiles: string[] = [];
for (const base of [path.join(root, 'src', 'components'), path.join(root, 'src', 'pages')]) {
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(astro|ts|js)$/.test(entry.name)) publicFiles.push(full);
    }
  };
  walk(base);
}
for (const file of publicFiles) assert.equal(readFileSync(file, 'utf8').includes('core-content-media-mappings.json'), false, 'internal media plan imported into public code: ' + file);
console.log('Core content model tests: OK (' + expectedRoutes.length + ' authority routes, ' + media.length + ' safe media aliases).');
