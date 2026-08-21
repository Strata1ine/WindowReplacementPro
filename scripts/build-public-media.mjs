import { mkdir, readFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const plan = JSON.parse(await readFile(path.join(root, 'src/data/public-media-plan.json'), 'utf8'));
const contentPlan = JSON.parse(await readFile(path.join(root, 'src/data/internal/core-content-media-mappings.json'), 'utf8'));
const selections = JSON.parse(await readFile(path.join(root, 'src/data/editorial/media-selections.json'), 'utf8'));
const selectionByProductId = new Map(selections.products.map(product => [product.productId, product]));
const outputDirectory = path.join(root, 'public-site/media/products');
const contentOutputDirectory = path.join(root, 'public-site/media/content');
await mkdir(outputDirectory, { recursive: true });
await mkdir(contentOutputDirectory, { recursive: true });

const expectedOutputs = new Set(plan.flatMap(item => {
  const format = item.format ?? 'webp';
  return item.widths.map(width => item.key + '-' + width + '.' + format);
}));
let obsoleteRemoved = 0;
for (const file of await readdir(outputDirectory)) {
  if (/^wrp-[wdgp]\d{3}(?:-gallery-\d+)?-\d+\.(?:webp|jpg)$/i.test(file) && !expectedOutputs.has(file)) {
    await unlink(path.join(outputDirectory, file));
    obsoleteRemoved += 1;
  }
}

const contentByReference = new Map();
for (const item of plan) {
  const product = selectionByProductId.get(item.productId);
  const selected = product?.[item.selection];
  const asset = Array.isArray(selected) ? selected[item.selectionIndex ?? 0] : selected;
  if (!asset?.localPath) throw new TypeError('Public media plan cannot resolve ' + item.productId + '.' + item.selection);
  if (asset.relationshipState !== 'product-specific') throw new TypeError('Public media must be product-specific: ' + item.productId);
  if (!item.alt?.trim()) throw new TypeError('Public media alt text is missing: ' + item.key);

  const knownContent = contentByReference.get(item.publicReference) ?? new Set();
  if (knownContent.has(asset.sha256)) throw new TypeError('Duplicate public media content within ' + item.publicReference + ': ' + item.key);
  knownContent.add(asset.sha256);
  contentByReference.set(item.publicReference, knownContent);

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
    if (outputMetadata.width !== width) throw new TypeError('Public media width descriptor mismatch: ' + outputPath);
    for (const field of ['exif', 'icc', 'iptc', 'xmp']) {
      if (outputMetadata[field]) throw new TypeError('Public derivative retained ' + field + ': ' + outputPath);
    }
  }
}

const expectedContentOutputs = new Set(contentPlan.flatMap(item => item.widths.map(width => item.outputKey + '-' + width + '.webp')));
let obsoleteContentRemoved = 0;
for (const file of await readdir(contentOutputDirectory)) {
  if (/^wrp-content-[a-z0-9-]+-\d+\.webp$/i.test(file) && !expectedContentOutputs.has(file)) {
    await unlink(path.join(contentOutputDirectory, file));
    obsoleteContentRemoved += 1;
  }
}

const contentOutputHashes = new Map();
let contentDerivativeCount = 0;
for (const item of contentPlan) {
  const product = selectionByProductId.get(item.productId);
  const selected = product?.[item.selection];
  const asset = Array.isArray(selected) ? selected[item.selectionIndex ?? 0] : selected;
  if (!asset?.localPath) throw new TypeError('Content media plan cannot resolve ' + item.productId + '.' + item.selection);
  if (asset.relationshipState !== item.relationshipState) {
    throw new TypeError('Content media relationship changed for ' + item.key + ': ' + asset.relationshipState);
  }
  if (!['product-specific', 'collection-shared'].includes(asset.relationshipState)) {
    throw new TypeError('Content media relationship is not public-safe: ' + item.key);
  }

  const previousHash = contentOutputHashes.get(item.outputKey);
  if (previousHash) {
    if (previousHash !== asset.sha256) throw new TypeError('Content media alias resolves to different binary: ' + item.key);
    continue;
  }
  contentOutputHashes.set(item.outputKey, asset.sha256);

  const sourcePath = path.join(root, 'public', asset.localPath.replace(/^\//, ''));
  const metadata = await sharp(sourcePath).metadata();
  if (metadata.width !== item.intrinsicWidth || metadata.height !== item.intrinsicHeight) {
    throw new TypeError('Content media dimensions changed for ' + item.key + ': ' + metadata.width + 'x' + metadata.height);
  }
  for (const width of item.widths) {
    const outputPath = path.join(contentOutputDirectory, item.outputKey + '-' + width + '.webp');
    await sharp(sourcePath).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 82, smartSubsample: true }).toFile(outputPath);
    const outputMetadata = await sharp(outputPath).metadata();
    if (outputMetadata.width !== width) throw new TypeError('Content media width descriptor mismatch: ' + outputPath);
    for (const field of ['exif', 'icc', 'iptc', 'xmp']) {
      if (outputMetadata[field]) throw new TypeError('Content derivative retained ' + field + ': ' + outputPath);
    }
    contentDerivativeCount += 1;
  }
}

const heroCount = plan.filter(item => item.role === 'hero').length;
const galleryCount = plan.filter(item => item.role === 'gallery').length;
console.log('Built ' + plan.reduce((count, item) => count + item.widths.length, 0) + ' neutral public image derivatives for ' + heroCount + ' heroes and ' + galleryCount + ' gallery assets; removed ' + obsoleteRemoved + ' obsolete neutral derivatives.');
console.log('Built ' + contentDerivativeCount + ' neutral authority-content derivatives from ' + contentOutputHashes.size + ' verified binaries; removed ' + obsoleteContentRemoved + ' obsolete content derivatives.');
