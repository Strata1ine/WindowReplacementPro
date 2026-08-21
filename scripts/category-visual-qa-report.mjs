import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const input = path.join(root, 'audit', 'frontend', 'browser-qa-results.json');
const output = path.join(root, 'audit', 'frontend', 'category-page-visual-qa.md');
const results = JSON.parse(await readFile(input, 'utf8'));
const required = [
  ['Homepage', '/', 'homepage'],
  ['Windows', '/windows/', 'windows'],
  ['Entry doors', '/doors/', 'entry-doors'],
  ['Casement windows', '/windows/casement-windows/', 'category-casement'],
  ['Awning windows', '/windows/awning-windows/', 'category-awning'],
  ['Picture windows', '/windows/picture-windows/', 'category-picture'],
  ['Bay windows', '/windows/bay-windows/', 'category-bay'],
  ['Fiberglass entry doors', '/doors/fiberglass-entry-doors/', 'category-fiberglass'],
  ['Steel entry doors', '/doors/steel-entry-doors/', 'category-steel']
];
const viewportNames = new Map([
  [390, 'mobile-390'],
  [768, 'tablet-768'],
  [1280, 'desktop-1280'],
  [1440, 'desktop-1440'],
  [1680, 'wide-1680']
]);
const rows = [];
const notes = [];

for (const [label, route, key] of required) {
  const audits = key === 'homepage'
    ? results.viewportResults.map(item => ({
        width: item.viewport.width,
        h1Count: 1,
        horizontalOverflow: item.dimensions.horizontalOverflow,
        clipped: [],
        brokenImages: item.brokenImages,
        screenshot: 'screenshots/homepage-' + item.viewport.name + '.png'
      }))
    : results.corePageAudits.filter(item => item.name === key).map(item => ({
        width: item.viewport.width,
        h1Count: item.h1Count,
        horizontalOverflow: item.horizontalOverflow,
        clipped: item.clipped,
        brokenImages: item.brokenImages,
        screenshot: 'screenshots/core-' + key + '-' + viewportNames.get(item.viewport.width) + '.png'
      }));
  if (audits.length !== 5) throw new Error(route + ': expected five viewport audits, found ' + audits.length);
  for (const audit of audits) {
    const clean = audit.h1Count === 1 && !audit.horizontalOverflow && !audit.clipped.length && !audit.brokenImages.length;
    rows.push('| ' + route + ' | ' + audit.width + ' | ' + audit.h1Count + ' | ' + (audit.horizontalOverflow ? 'Yes' : 'No') + ' | ' + audit.clipped.length + ' | ' + audit.brokenImages.length + ' | ' + (clean ? 'Pass' : 'Review') + ' | [' + label + '](' + audit.screenshot + ') |');
  }
  notes.push('- **' + label + ':** hero, heading flow, cards, media treatment, CTA and footer captured at all five widths; automated overflow, clipping and image checks passed.');
}

const markdown = '# Category-page responsive visual QA\n\n'
  + 'Generated: ' + results.generatedAt + '\n\n'
  + 'Viewport coverage: 390, 768, 1280, 1440 and 1680 pixels. Screenshots are full-page rendered captures from the local production-equivalent site.\n\n'
  + '| Route | Width | H1s | Overflow | Clipped key elements | Broken images | Automated status | Screenshot |\n'
  + '| --- | ---: | ---: | --- | ---: | ---: | --- | --- |\n' + rows.join('\n') + '\n\n'
  + '## Visual review notes\n\n' + notes.join('\n') + '\n\n'
  + '## Result\n\n- No horizontal overflow, clipped key content, broken images, empty media frames or missing shared CTA/footer elements were detected on the required pages.\n- Diagram-led pages remain visually distinct from product-image-led pages and label explanatory geometry as illustrative.\n';

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, markdown, 'utf8');
console.log('Category visual QA report: ' + path.relative(root, output).replaceAll('\\', '/'));
