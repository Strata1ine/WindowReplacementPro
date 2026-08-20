import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const plan = JSON.parse(await readFile(path.join(root, 'src/data/homepage-media-plan.json'), 'utf8'));
const selections = JSON.parse(await readFile(path.join(root, 'src/data/editorial/media-selections.json'), 'utf8'));
const selectionByProductId = new Map(selections.products.map(product => [product.productId, product]));
const outputDirectory = path.join(root, 'public/images/site/homepage');

await mkdir(outputDirectory, { recursive: true });

for (const item of plan) {
  const product = selectionByProductId.get(item.productId);
  const asset = product?.[item.selection];
  if (!asset || Array.isArray(asset) || !asset.localPath) {
    throw new TypeError(`Homepage media plan cannot resolve ${item.productId}.${item.selection}`);
  }
  if (asset.relationshipState !== 'product-specific') {
    throw new TypeError(`Homepage media must be product-specific: ${item.productId}`);
  }

  const sourcePath = path.join(root, 'public', asset.localPath.replace(/^\//, ''));
  const metadata = await sharp(sourcePath).metadata();
  if (metadata.width !== item.intrinsicWidth || metadata.height !== item.intrinsicHeight) {
    throw new TypeError(
      `Homepage media dimensions changed for ${item.productId}: `
      + `${metadata.width}x${metadata.height} (expected ${item.intrinsicWidth}x${item.intrinsicHeight})`
    );
  }

  for (const width of item.widths) {
    const outputPath = path.join(outputDirectory, `${item.key}-${width}.webp`);
    await sharp(sourcePath)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82, smartSubsample: true })
      .toFile(outputPath);
  }
}

console.log(`Built ${plan.reduce((count, item) => count + item.widths.length, 0)} homepage image derivatives.`);
