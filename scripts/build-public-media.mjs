import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const plan = JSON.parse(await readFile(path.join(root, 'src/data/public-media-plan.json'), 'utf8'));
const selections = JSON.parse(await readFile(path.join(root, 'src/data/editorial/media-selections.json'), 'utf8'));
const selectionByProductId = new Map(selections.products.map(product => [product.productId, product]));
const outputDirectory = path.join(root, 'public-site/media/products');
await mkdir(outputDirectory, { recursive: true });

for (const item of plan) {
  const product = selectionByProductId.get(item.productId);
  const asset = product?.[item.selection];
  if (!asset || Array.isArray(asset) || !asset.localPath) throw new TypeError('Public media plan cannot resolve ' + item.productId + '.' + item.selection);
  if (asset.relationshipState !== 'product-specific') throw new TypeError('Public media must be product-specific: ' + item.productId);
  const sourcePath = path.join(root, 'public', asset.localPath.replace(/^\//, ''));
  const metadata = await sharp(sourcePath).metadata();
  if (metadata.width !== item.intrinsicWidth || metadata.height !== item.intrinsicHeight) {
    throw new TypeError('Public media dimensions changed for ' + item.productId + ': ' + metadata.width + 'x' + metadata.height);
  }
  for (const width of item.widths) {
    const format = item.format ?? 'webp';
    const outputPath = path.join(outputDirectory, item.key + '-' + width + '.' + format);
    const encoder = sharp(sourcePath).rotate().resize({ width, withoutEnlargement: true });
    if (format === 'jpg') encoder.jpeg({ quality: 88, mozjpeg: true });
    else encoder.webp({ quality: 82, smartSubsample: true });
    await encoder.toFile(outputPath);
    const outputMetadata = await sharp(outputPath).metadata();
    for (const field of ['exif', 'icc', 'iptc', 'xmp']) {
      if (outputMetadata[field]) throw new TypeError('Public derivative retained ' + field + ': ' + outputPath);
    }
  }
}
console.log('Built ' + plan.reduce((count, item) => count + item.widths.length, 0) + ' neutral public image derivatives.');
