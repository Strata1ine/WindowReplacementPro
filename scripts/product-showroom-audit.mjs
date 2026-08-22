import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { publicProductShowroomByReference } from '../src/data/public-product-showroom.ts';
import { classifyShowroomProduct, getShowroomMetrics, isShowroomReadyProduct } from './lib/product-showroom-readiness.mjs';

const root = process.cwd();
const output = process.env.AUDIT_OUTPUT_DIR ? path.resolve(process.env.AUDIT_OUTPUT_DIR) : path.join(root, 'audit', 'editorial');
const identities = JSON.parse(await readFile(path.join(root, 'src/data/public-identities.json'), 'utf8'));
const metrics = identities.map(identity => {
  const item = getShowroomMetrics(identity, publicProductShowroomByReference.get(identity.publicReference));
  return { ...item, showroomReady: isShowroomReadyProduct(item), status: classifyShowroomProduct(item) };
});
const counts = Object.fromEntries(['showroom-ready', 'adequate', 'media-limited', 'evidence-limited', 'requires-review'].map(status => [status, metrics.filter(item => item.status === status).length]));
const totals = {
  productCount: metrics.length,
  uniqueShowroomMedia: metrics.reduce((sum, item) => sum + item.uniqueShowroomMediaCount, 0),
  customerFacingConfigurations: metrics.reduce((sum, item) => sum + item.configurationCount + item.finishColourOptions + item.hardwareOptions, 0),
  productsWithOnlyOneImage: metrics.filter(item => item.totalUsefulMediaCount <= 1).length,
  productsWithoutTechnicalOrLayoutMedia: metrics.filter(item => !item.hasTechnicalOrLayoutContext).length
};
const generatedAt = new Date().toISOString();
const result = { generatedAt, counts, totals, products: metrics };
const rows = metrics.map(item => `| ${item.publicReference} | ${item.name} | ${item.heroMediaCount} | ${item.galleryMediaCount} | ${item.configurationCount} | ${item.finishColourOptions} | ${item.glassDesignOptions} | ${item.technicalMedia} | ${item.specificationCount} | ${item.relatedProducts} | ${item.interactiveChoiceModules} | ${item.status} |`).join('\n');
const markdown = `# Public product-showroom richness audit\n\nGenerated: ${generatedAt}\n\n- Products audited: ${totals.productCount}\n- Showroom-ready: ${counts['showroom-ready']}\n- Adequate: ${counts.adequate}\n- Media-limited: ${counts['media-limited']}\n- Evidence-limited: ${counts['evidence-limited']}\n- Requires review: ${counts['requires-review']}\n- Unique verified showroom media: ${totals.uniqueShowroomMedia}\n- Customer-facing configurations/options: ${totals.customerFacingConfigurations}\n- Products with only one useful product image: ${totals.productsWithOnlyOneImage}\n- Products without technical/layout media: ${totals.productsWithoutTechnicalOrLayoutMedia}\n\n## Per-product assessment\n\n| Reference | Product | Hero | Gallery | Configurations | Finishes | Glass/design | Technical | Specs | Related | Interactive modules | Status |\n| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |\n${rows}\n\n## Publication standard\n\n\`isShowroomReadyProduct()\` requires a strong hero, multiple useful verified visuals, meaningful category-appropriate choices, at least four verified specifications, substantive editorial, and technical or layout context where that category needs it. A lower status is an evidence flag; it does not automatically change indexation.\n`;
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'product-showroom-report.json'), JSON.stringify(result, null, 2) + '\n');
await writeFile(path.join(output, 'product-showroom-report.md'), markdown);
const errors = [];
if (metrics.length !== 40) errors.push(`expected 40 public products, found ${metrics.length}`);
if (new Set(metrics.map(item => item.publicReference)).size !== 40) errors.push('public references are not unique');
if (counts['requires-review']) errors.push(`${counts['requires-review']} product(s) require review`);
if (errors.length) { console.error('Product showroom audit: FAILED'); errors.forEach(error => console.error(`ERROR: ${error}`)); process.exitCode = 1; }
else console.log(`Product showroom audit: OK (40 products; ready ${counts['showroom-ready']}; adequate ${counts.adequate}; media-limited ${counts['media-limited']}; evidence-limited ${counts['evidence-limited']}).`);
