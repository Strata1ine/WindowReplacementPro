import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { publicProductShowroomByReference } from '../src/data/public-product-showroom.ts';
import { classifyShowroomProduct, getShowroomGapReasons, getShowroomMetrics, isShowroomReadyProduct } from './lib/product-showroom-readiness.mjs';

const root = process.cwd();
const output = process.env.AUDIT_OUTPUT_DIR ? path.resolve(process.env.AUDIT_OUTPUT_DIR) : path.join(root, 'audit', 'editorial');
const identities = JSON.parse(await readFile(path.join(root, 'src/data/public-identities.json'), 'utf8'));
const metrics = identities.map(identity => {
  const item = getShowroomMetrics(identity, publicProductShowroomByReference.get(identity.publicReference));
  return { ...item, showroomReady: isShowroomReadyProduct(item), status: classifyShowroomProduct(item), gapReasons: getShowroomGapReasons(item) };
});
const statuses = ['showroom-ready', 'adequate', 'media-limited', 'evidence-limited', 'requires-review'];
const counts = Object.fromEntries(statuses.map(status => [status, metrics.filter(item => item.status === status).length]));
const totals = {
  productCount: metrics.length,
  uniqueShowroomMedia: metrics.reduce((sum, item) => sum + item.uniqueShowroomMediaCount, 0),
  illustrativeDiagrams: metrics.reduce((sum, item) => sum + item.illustrativeDiagramCount, 0),
  customerFacingConfigurations: metrics.reduce((sum, item) => sum + item.visualOptionCount, 0),
  totalPublicVisualOptions: metrics.reduce((sum, item) => sum + item.visualOptionCount, 0),
  productsWithOnlyOneImage: metrics.filter(item => item.totalUsefulMediaCount <= 1).length,
  productsWithoutTechnicalOrLayoutMedia: metrics.filter(item => !item.hasTechnicalOrLayoutContext).length,
  productsWithFinishes: metrics.filter(item => item.finishColourOptions > 0).length,
  entryDoorProductsWithFinishes: metrics.filter(item => item.category === 'entry-doors' && item.finishColourOptions > 0).length,
  productsWithGlassOptions: metrics.filter(item => item.glassDesignOptions > 0).length,
  entryDoorProductsWithGlassOptions: metrics.filter(item => item.category === 'entry-doors' && item.glassDesignOptions > 0).length,
  productsWithLayoutOptions: metrics.filter(item => item.layoutOptions > 0).length,
  productsWithTechnicalMedia: metrics.filter(item => item.technicalMedia > 0).length,
  productsWithInstalledContextMedia: metrics.filter(item => item.installedContextMedia > 0).length,
  productsWithPrivacyIndicators: identities.filter(identity => publicProductShowroomByReference.get(identity.publicReference)?.privacyIndicator).length
};
const generatedAt = new Date().toISOString();
const result = { generatedAt, counts, totals, products: metrics };
const rows = metrics.map(item => '| ' + item.publicReference + ' | ' + item.name + ' | ' + item.heroMediaCount + ' | ' + item.galleryMediaCount + ' | ' + item.visualOptionCount + ' | ' + item.finishColourOptions + ' | ' + item.glassDesignOptions + ' | ' + item.layoutOptions + ' | ' + item.technicalMedia + ' | ' + item.installedContextMedia + ' | ' + item.specificationCount + ' | ' + item.showroomRichnessScore + ' | ' + item.status + ' |').join('\n');
const gaps = metrics.filter(item => item.status !== 'showroom-ready').map(item => '- **' + item.publicReference + ' — ' + item.name + ':** ' + (item.gapReasons.join('; ') || 'additional evidence review required') + '.').join('\n') || '- None.';
const markdown = '# Public product-showroom richness audit\n\nGenerated: ' + generatedAt + '\n\n'
  + '- Products audited: ' + totals.productCount + '\n'
  + '- Showroom-ready: ' + counts['showroom-ready'] + '\n'
  + '- Adequate: ' + counts.adequate + '\n'
  + '- Media-limited: ' + counts['media-limited'] + '\n'
  + '- Evidence-limited: ' + counts['evidence-limited'] + '\n'
  + '- Requires review: ' + counts['requires-review'] + '\n'
  + '- Unique verified showroom media: ' + totals.uniqueShowroomMedia + '\n'
  + '- Illustrative configuration diagrams: ' + totals.illustrativeDiagrams + '\n'
  + '- Total public visual options: ' + totals.totalPublicVisualOptions + '\n'
  + '- Products with finishes: ' + totals.productsWithFinishes + '\n'
  + '- Entry-door products with finishes: ' + totals.entryDoorProductsWithFinishes + '\n'
  + '- Products with glass options: ' + totals.productsWithGlassOptions + '\n'
  + '- Entry-door products with glass options: ' + totals.entryDoorProductsWithGlassOptions + '\n'
  + '- Products with layout options: ' + totals.productsWithLayoutOptions + '\n'
  + '- Products with technical media/context: ' + totals.productsWithTechnicalMedia + '\n'
  + '- Products with installed/context media: ' + totals.productsWithInstalledContextMedia + '\n'
  + '- Products with documented privacy indicators: ' + totals.productsWithPrivacyIndicators + '\n'
  + '- Products without technical/layout media: ' + totals.productsWithoutTechnicalOrLayoutMedia + '\n\n'
  + '## Per-product assessment\n\n'
  + '| Reference | Product | Hero | Gallery | Visual options | Finishes | Glass | Layout | Technical | Context | Specs | Score | Status |\n'
  + '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |\n'
  + rows + '\n\n'
  + '## Exact reasons below showroom-ready\n\n' + gaps + '\n\n'
  + '## Publication standard\n\n'
  + 'The internal richness score evaluates hero quality, gallery depth, visual choices, configuration depth, technical context, specifications, installed/context imagery and related-product usefulness. The readiness function applies category-specific evidence thresholds; a lower status is an evidence flag and does not automatically change indexation.\n';
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'product-showroom-report.json'), JSON.stringify(result, null, 2) + '\n');
await writeFile(path.join(output, 'product-showroom-report.md'), markdown);
const errors = [];
if (metrics.length !== 40) errors.push('expected 40 public products, found ' + metrics.length);
if (new Set(metrics.map(item => item.publicReference)).size !== 40) errors.push('public references are not unique');
if (counts['requires-review']) errors.push(counts['requires-review'] + ' product(s) require review');
if (errors.length) {
  console.error('Product showroom audit: FAILED');
  errors.forEach(error => console.error('ERROR: ' + error));
  process.exitCode = 1;
} else {
  console.log('Product showroom audit: OK (40 products; ready ' + counts['showroom-ready'] + '; adequate ' + counts.adequate + '; media-limited ' + counts['media-limited'] + '; evidence-limited ' + counts['evidence-limited'] + ').');
}