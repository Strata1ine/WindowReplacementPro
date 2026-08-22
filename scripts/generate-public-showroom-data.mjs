import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const identities = await readJson('src/data/public-identities.json');
const mappings = await readJson('src/data/internal/public-product-mappings.json');
const selections = await readJson('src/data/editorial/media-selections.json');
const oakMappings = await readJson('src/data/internal/public-product-showroom-mappings.json');
const selectionById = new Map(selections.products.map(item => [item.productId, item]));
const publicMediaExclusions = new Set(['verre-select:quattro|galleryMedia|0', 'verre-select:whistler|galleryMedia|0']);
const identityByReference = new Map(identities.map(item => [item.publicReference, item]));

const optionLabels = {
  'WRP-W001': ['Compact casement profile', 'Classic casement profile', 'Alternate casement profile'],
  'WRP-W002': ['Deep-frame casement', 'Reinforced casement profile', 'Replacement-depth casement'],
  'WRP-W003': ['Compact awning profile', 'Classic awning profile', 'Deep-frame awning', 'Alternate awning profile'],
  'WRP-W004': ['Double-sash configuration', 'Alternate double-hung profile'],
  'WRP-W005': ['Single-sash configuration'],
  'WRP-W006': ['Classic double slider', 'Compact double slider', 'Deep-frame double slider'],
  'WRP-W007': ['Single slider', 'Deep-frame single slider'],
  'WRP-W008': ['Picture-window profile'],
  'WRP-W009': ['Compact fixed casement', 'Classic fixed casement', 'Alternate fixed casement'],
  'WRP-W010': ['Slim fixed profile', 'Classic fixed profile', 'Compact fixed profile', 'Alternate fixed profile'],
  'WRP-D001': ['Two-panel', 'Square two-panel', 'Woodgrain two-panel', 'Smooth two-panel'],
  'WRP-D002': ['Smooth flush', 'Clean flush', 'Single-panel smooth'],
  'WRP-D004': ['Mahogany flush', 'Mahogany two-panel', 'Woodgrain one-panel'],
  'WRP-D005': ['Woodgrain Craftsman', 'Smooth Craftsman'],
  'WRP-D006': ['Moulded six-panel', 'Smooth six-panel', 'Oak-grain six-panel', 'Classic six-panel'],
  'WRP-D007': ['Full glass', 'Flush-glazed full glass'],
  'WRP-D008': ['Two-panel half glass', 'Smooth half glass', 'Oak-grain half glass'],
  'WRP-D009': ['Flush-glazed three-quarter glass', 'Smooth three-quarter glass', 'Oak-grain three-quarter glass'],
  'WRP-D010': ['Smooth narrow glass', 'Oak-grain narrow glass'],
  'WRP-D011': ['Smooth four-panel', 'Clean four-panel', 'Oak-grain four-panel'],
  'WRP-D012': ['Woodgrain one-panel'],
  'WRP-G001': ['Black linear pattern'],
  'WRP-G002': ['Geometric privacy pattern'],
  'WRP-G003': ['Frosted privacy pattern'],
  'WRP-G004': ['Clear-zone geometry', 'Soft clear-zone pattern', 'Curved clear-zone pattern'],
  'WRP-G005': ['Linear privacy pattern', 'Fine linear pattern'],
  'WRP-G006': ['Wide reed texture', 'Fine reed texture'],
  'WRP-G007': ['Flowing clear pattern', 'Crossed clear pattern', 'Soft geometric pattern'],
  'WRP-G008': ['Traditional beveled pattern', 'Curved beveled pattern', 'Geometric beveled pattern'],
  'WRP-G009': ['Hammered texture', 'Sculpted texture', 'Pixel texture'],
  'WRP-G010': ['Contemporary camed pattern', 'Angular camed pattern'],
  'WRP-G011': ['Narrow sidelite pattern', 'Narrow decorative pattern'],
  'WRP-G012': ['Organic decorative pattern', 'Flowing organic pattern'],
  'WRP-P001': ['Performance multi-panel', 'Standard multi-panel', 'Compact multi-panel'],
  'WRP-P002': ['Compact two-panel', 'Standard two-panel', 'Performance two-panel'],
  'WRP-P003': ['Standard PVC system', 'Deep-frame PVC system', 'Enhanced PVC system'],
  'WRP-P004': ['Narrow aluminum frame', 'Large-opening aluminum frame'],
  'WRP-P005': ['Aluminum-clad hybrid', 'Wood-composite hybrid'],
  'WRP-P006': ['Lift-and-slide slim frame', 'Contemporary slim frame']
};

const groupCopy = {
  windows: {
    id: 'style', eyebrow: 'System views', title: 'Compare the operating system and frame direction.',
    description: 'These verified views represent window systems that fit this operating style. Final profile, glazing and hardware are confirmed for the measured opening.'
  },
  'entry-doors': {
    id: 'style', eyebrow: 'Door styles', title: 'Compare supported slab and panel directions.',
    description: 'Each verified view belongs to this door style direction. Panel embossment, glass preparation, slab size and finish are confirmed together.'
  },
  'door-glass': {
    id: 'glass', eyebrow: 'Design choices', title: 'Compare the pattern in full-door context.',
    description: 'These verified designs share the visual direction described on this page. Glass size, privacy and compatible slab are confirmed for the complete entrance.'
  },
  'patio-doors': {
    id: 'style', eyebrow: 'System choices', title: 'Compare the frame and panel direction.',
    description: 'These verified systems represent this patio-door direction. Opening width, panel movement, sill, glazing and screen requirements determine the final configuration.'
  }
};

const roleCopy = {
  gallery: ['Additional product view', 'Alternate product view', 'Detail view', 'Installed-context view', 'Interior view', 'Exterior view'],
  technical: ['Profile detail', 'Construction detail', 'Operating detail'],
  finish: ['Finish option', 'Colour option', 'Hardware finish', 'Surface option', 'Alternate finish', 'Frame colour'],
  configuration: ['Configuration view', 'Panel-layout view', 'Opening-layout view', 'Alternate configuration']
};

const slugify = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const widthsFor = width => {
  if (width >= 1200) return [360, 720, 1200];
  if (width >= 720) return [320, 640];
  if (width >= 480) return [240, 480];
  if (width >= 320) return [240, 320];
  return [width];
};
const sourcePointer = (productId, selection, selectionIndex) => ({
  kind: 'editorial-selection', productId, selection,
  ...(selectionIndex === undefined ? {} : { selectionIndex })
});

async function describeAsset(identity, key, label, description, productId, selection, selectionIndex, asset, publicRole, optionId) {
  const exclusionKey = String(productId) + '|' + selection + '|' + (selectionIndex ?? 0);
  if (publicMediaExclusions.has(exclusionKey)) return null;
  if (!asset?.localPath || asset.relationshipState !== 'product-specific') return null;
  const metadata = await sharp(path.join(root, 'public', asset.localPath.replace(/^\//, ''))).metadata();
  if (!metadata.width || !metadata.height || metadata.width < 160 || metadata.height < 100) return null;
  return {
    media: {
      key,
      alt: `${identity.publicDisplayName}: ${label.toLowerCase()}`,
      intrinsicWidth: metadata.width,
      intrinsicHeight: metadata.height,
      widths: widthsFor(metadata.width)
    },
    option: {
      id: optionId ?? slugify(label), label, description,
      availabilityNote: 'Availability and compatibility are confirmed for the measured opening.',
      mediaKey: key
    },
    mapping: {
      key, source: sourcePointer(productId, selection, selectionIndex),
      relationshipState: asset.relationshipState,
      publicRole, associatedOption: optionId ?? slugify(label),
      reviewStatus: 'approved', brandingReview: 'clear'
    },
    sha256: asset.sha256
  };
}

const generated = [];
const internal = [oakMappings.find(item => item.publicReference === 'WRP-D003')];

for (const mapping of mappings) {
  const reference = mapping.publicProductId;
  if (reference === 'WRP-D003') continue;
  const identity = identityByReference.get(reference);
  if (!identity) throw new TypeError(`Missing public identity for ${reference}`);
  const usedByHash = new Map();
  const assetsByKey = new Map();
  const internalAssets = [];
  const primaryOptions = [];
  const gallery = [];
  const finishOptions = [];
  const layoutOptions = [];
  const technicalMedia = [];
  const labels = optionLabels[reference] ?? [];

  const add = candidate => {
    if (!candidate) return null;
    const existing = usedByHash.get(candidate.sha256);
    if (existing) return existing;
    usedByHash.set(candidate.sha256, candidate);
    assetsByKey.set(candidate.media.key, candidate.media);
    internalAssets.push(candidate.mapping);
    return candidate;
  };

  for (let index = 0; index < mapping.internalProductIds.length; index += 1) {
    const productId = mapping.internalProductIds[index];
    const selected = selectionById.get(productId);
    if (!selected?.heroMedia) continue;
    const label = labels[index] ?? `Verified ${groupCopy[identity.publicCategory].id} view ${index + 1}`;
    const description = identity.publicCategory === 'door-glass'
      ? `${label} changes the balance of texture, clear areas, privacy and daylight.`
      : identity.publicCategory === 'windows'
        ? `${label} provides a distinct frame and operating presentation to compare.`
        : identity.publicCategory === 'entry-doors'
          ? `${label} changes the slab's panel, surface or glass proportions.`
          : `${label} shows a distinct panel and frame arrangement for comparison.`;
    const candidate = add(await describeAsset(identity, `primary-${index + 1}`, label, description, productId, 'heroMedia', undefined, selected.heroMedia, 'primary-option'));
    if (candidate && !primaryOptions.some(option => option.mediaKey === candidate.media.key)) primaryOptions.push(candidate.option);
  }

  const extraKinds = [
    ['galleryMedia', 'gallery', gallery, identity.publicCategory === 'door-glass' ? 6 : 4],
    ['technicalMedia', 'technical', technicalMedia, 3],
    ['finishMedia', 'finish', finishOptions, 5],
    ['configurationMedia', 'configuration', layoutOptions, 4]
  ];
  for (const [selection, role, target, limit] of extraKinds) {
    if (identity.publicCategory === 'entry-doors' && selection === 'technicalMedia') continue;
    let ordinal = 0;
    for (const productId of mapping.internalProductIds) {
      const items = selectionById.get(productId)?.[selection] ?? [];
      for (let index = 0; index < items.length && target.length < limit; index += 1) {
        ordinal += 1;
        const label = roleCopy[role][Math.min(target.length, roleCopy[role].length - 1)];
        const candidate = add(await describeAsset(identity, `${role}-${ordinal}`, label, `${label} documented for this product family.`, productId, selection, index, items[index], `${role}-option`));
        if (candidate && !target.some(option => option.mediaKey === candidate.media.key)) target.push(candidate.option);
      }
      if (target.length >= limit) break;
    }
  }

  const mediaFor = option => assetsByKey.get(option.mediaKey);
  const hydrate = option => ({ ...option, media: mediaFor(option), mediaKey: undefined });
  const groups = [{ ...groupCopy[identity.publicCategory], options: primaryOptions.map(hydrate) }];
  if (finishOptions.length) groups.push({
    id: 'finish', eyebrow: 'Finish and colour', title: 'Review documented finish directions.',
    description: 'These verified finish or colour references apply to selected configurations. A current physical sample remains the best final colour check.',
    options: finishOptions.map(hydrate)
  });
  if (layoutOptions.length) groups.push({
    id: 'layout', eyebrow: 'Configurations', title: 'See documented layout choices.',
    description: 'These diagrams or renders show supported layout directions. Exact compatibility depends on opening size and the selected system.',
    options: layoutOptions.map(hydrate)
  });

  const galleryMedia = [];
  for (const option of [...primaryOptions.slice(1), ...gallery].slice(0, 12)) {
    const media = mediaFor(option);
    if (media && !galleryMedia.some(item => item.key === media.key)) galleryMedia.push(media);
  }
  generated.push({
    publicReference: reference,
    gallery: galleryMedia,
    groups,
    technicalMedia: technicalMedia.map(hydrate),
    verifiedDetails: []
  });
  internal.push({ publicReference: reference, assets: internalAssets });
}

const generatedModule = `// Generated by scripts/generate-public-showroom-data.mjs. Public-safe labels and neutral media descriptors only.\nexport const generatedPublicProductShowrooms = ${JSON.stringify(generated, null, 2)};\n`;
await writeFile(path.join(root, 'src/data/public-product-showroom-generated.ts'), generatedModule);
await writeFile(path.join(root, 'src/data/internal/public-product-showroom-mappings.json'), JSON.stringify(internal, null, 2) + '\n');
console.log(`Generated public-safe showroom configurations for ${generated.length} products and ${internal.reduce((count, item) => count + item.assets.length, 0)} verified asset mappings.`);
