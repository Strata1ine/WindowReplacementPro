import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const identities = await readJson('src/data/public-identities.json');
const mappings = await readJson('src/data/internal/public-product-mappings.json');
const selections = await readJson('src/data/editorial/media-selections.json');
const oakMappings = await readJson('src/data/internal/public-product-showroom-mappings.json');
const enrichmentRecords = await readJson('src/data/catalog/enrichment-records.json');
const selectionById = new Map(selections.products.map(item => [item.productId, item]));
const enrichmentById = new Map(enrichmentRecords.map(item => [item.productId, item]));
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

async function describeAsset(identity, key, label, description, productId, selection, selectionIndex, asset, publicRole, optionId, allowedRelationships = ['product-specific']) {
  const exclusionKey = String(productId) + '|' + selection + '|' + (selectionIndex ?? 0);
  if (publicMediaExclusions.has(exclusionKey)) return null;
  if (!asset?.localPath || !allowedRelationships.includes(asset.relationshipState)) return null;
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
      publicOptionId: optionId ?? slugify(label),
      publicProductIds: [identity.publicReference],
      optionType: publicRole,
      compatibleInternalProductIds: [productId],
      compatibilityRestrictions: 'Available only on compatible configurations represented by the documented source product.',
      sourceEvidence: [sourcePointer(productId, selection, selectionIndex)],
      reviewState: 'approved',
      reviewStatus: 'approved', brandingReview: 'clear'
    },
    sha256: asset.sha256
  };
}

const diagramVariants = {
  'WRP-W001': 'casement', 'WRP-W002': 'casement', 'WRP-W003': 'awning', 'WRP-W004': 'double-hung',
  'WRP-W005': 'single-hung', 'WRP-W006': 'double-slider', 'WRP-W007': 'single-slider',
  'WRP-W008': 'fixed', 'WRP-W009': 'fixed', 'WRP-W010': 'fixed',
  'WRP-D001': 'two-panel', 'WRP-D002': 'one-panel', 'WRP-D004': 'one-panel', 'WRP-D005': 'one-panel',
  'WRP-D006': 'six-panel', 'WRP-D007': 'full-lite', 'WRP-D008': 'half-lite',
  'WRP-D009': 'three-quarter-lite', 'WRP-D010': 'narrow-lite', 'WRP-D011': 'four-panel', 'WRP-D012': 'one-panel',
  'WRP-G001': 'full-lite-linear', 'WRP-G002': 'full-lite-geometric', 'WRP-G003': 'full-lite-geometric',
  'WRP-G004': 'full-lite-geometric', 'WRP-G005': 'full-lite-linear', 'WRP-G006': 'full-lite-linear',
  'WRP-G007': 'full-lite-geometric', 'WRP-G008': 'full-lite-geometric', 'WRP-G009': 'full-lite-geometric',
  'WRP-G010': 'full-lite-geometric', 'WRP-G011': 'sidelite-geometric', 'WRP-G012': 'full-lite-geometric',
  'WRP-P001': 'multi-panel', 'WRP-P002': 'two-panel', 'WRP-P003': 'two-panel',
  'WRP-P004': 'two-panel', 'WRP-P005': 'two-panel', 'WRP-P006': 'multi-panel'
};

const technicalCopy = {
  windows: {
    label: 'Operation at a glance',
    description: 'A dimensionless diagram clarifies the documented operating direction or fixed-sash role.',
    availabilityNote: 'Illustrative only; frame proportions, handing and hardware vary by the selected opening.'
  },
  'entry-doors': {
    label: 'Slab layout at a glance',
    description: 'A dimensionless diagram highlights the documented panel or glass proportion.',
    availabilityNote: 'Illustrative only; panel proportions, glass preparation and slab dimensions vary by compatible configuration.'
  },
  'door-glass': {
    label: 'Door-context reference',
    description: 'A dimensionless door view shows the documented full-door or sidelite design context.',
    availabilityNote: 'Illustrative only; confirm the exact glass size, slab preparation and privacy character.'
  },
  'patio-doors': {
    label: 'Panel movement at a glance',
    description: 'A dimensionless diagram distinguishes the documented two-panel or multi-panel direction.',
    availabilityNote: 'Illustrative only; active panels, handing, sill and clear opening depend on the measured configuration.'
  }
};

function buildIllustrativeOption(identity) {
  const variant = diagramVariants[identity.publicReference];
  if (!variant) return null;
  const copy = technicalCopy[identity.publicCategory];
  const kind = identity.publicCategory === 'entry-doors' ? 'entry-door' : identity.publicCategory === 'door-glass' ? 'door-glass' : identity.publicCategory === 'patio-doors' ? 'patio-door' : 'window';
  return {
    id: 'illustrative-' + variant,
    label: copy.label,
    description: copy.description,
    availabilityNote: copy.availabilityNote,
    diagram: {
      kind,
      variant,
      ariaLabel: identity.publicDisplayName + ' dimensionless illustrative configuration'
    }
  };
}

const factLabels = {
  availableSizes: 'Documented size context',
  glassComposition: 'Documented glass composition',
  operatingStyle: 'Documented operation',
  configuration: 'Documented configuration',
  panelDesign: 'Documented panel form',
  glassConfiguration: 'Documented glass amount'
};
const confidentialTerms = /masonite|mennie|novatech|oceanview|richerson|trimlite|verre|vinyl.?pro|vista|window.?city/i;
const valueText = value => Array.isArray(value) ? value.join(', ') : String(value ?? '');

function buildVerifiedDetails(identity, mapping) {
  const existing = new Set((identity.publicSpecifications ?? []).map(item => String(item.value).toLowerCase()));
  const details = [];
  for (const productId of mapping.internalProductIds) {
    const normalized = enrichmentById.get(productId)?.sourceFacts?.normalized ?? {};
    for (const [key, label] of Object.entries(factLabels)) {
      const text = valueText(normalized[key]?.value).trim();
      if (!text || confidentialTerms.test(text) || existing.has(text.toLowerCase()) || details.some(item => item.value.toLowerCase() === text.toLowerCase())) continue;
      details.push({ label, value: text });
      if (details.length >= 3) return details;
    }
  }
  return details;
}

function buildPrivacyIndicator(mapping) {
  const documented = mapping.internalProductIds.map(productId => {
    const value = enrichmentById.get(productId)?.sourceFacts?.normalized?.privacyLevel?.value;
    const [level, maximum] = String(value ?? '').split('/');
    const numeric = Number(level);
    return maximum === '5' && Number.isInteger(numeric) && numeric >= 1 && numeric <= 5 ? { productId, value: numeric } : null;
  }).filter(Boolean);
  if (!documented.length || new Set(documented.map(item => item.value)).size !== 1) return null;
  const value = documented[0].value;
  return {
    public: {
      value,
      max: 5,
      label: value <= 2 ? 'Low' : value === 3 ? 'Medium' : 'High',
      note: 'Documented privacy reference. Appearance can change with interior and exterior lighting.'
    },
    private: {
      value,
      max: 5,
      compatibleInternalProductIds: documented.map(item => item.productId),
      sourceEvidence: documented.map(item => ({ kind: 'normalized-fact', productId: item.productId, field: 'privacyLevel' })),
      reviewState: 'approved'
    }
  };
}
function primaryGroupId(identity, label) {
  if (identity.publicCategory !== 'entry-doors') return groupCopy[identity.publicCategory].id;
  const lower = label.toLowerCase();
  if (/glass|lite/.test(lower)) return 'glass';
  if (/smooth|woodgrain|oak-grain/.test(lower) && /WRP-D001|WRP-D005|WRP-D006|WRP-D011/.test(identity.publicReference)) return 'finish';
  return 'style';
}

const groupDefinitions = {
  style: groupCopy['entry-doors'],
  glass: {
    id: 'glass', eyebrow: 'Glass amount and context', title: 'Compare supported glass configurations.',
    description: 'These documented views show how glass proportion changes daylight and the amount of visible slab surface. Compatibility is confirmed with the complete entrance.'
  },
  finish: {
    id: 'finish', eyebrow: 'Surface and grain', title: 'Compare documented surface directions.',
    description: 'These views distinguish smooth and woodgrain surface directions represented within this product choice. Colour and sheen are confirmed separately.'
  }
};
const generated = [];
const oakSource = oakMappings.find(item => item.publicReference === 'WRP-D003');
const oakBaseProducts = mappings.find(item => item.publicProductId === 'WRP-D003')?.internalProductIds ?? [];
const normalizedOak = {
  ...oakSource,
  assets: oakSource.assets.map(asset => {
    const compatibleInternalProductIds = asset.source.productId ? [asset.source.productId] : [...oakBaseProducts];
    return {
      ...asset,
      publicOptionId: asset.associatedOption,
      publicProductIds: ['WRP-D003'],
      optionType: asset.publicRole,
      compatibleInternalProductIds,
      compatibilityRestrictions: 'Available only on compatible oak-grain door configurations.',
      sourceEvidence: [asset.source],
      reviewState: 'approved'
    };
  }),
  options: oakSource.assets.map(asset => ({
    publicOptionId: asset.associatedOption,
    publicProductIds: ['WRP-D003'],
    optionType: asset.publicRole,
    compatibleInternalProductIds: asset.source.productId ? [asset.source.productId] : [...oakBaseProducts],
    compatibilityRestrictions: 'Available only on compatible oak-grain door configurations.',
    sourceEvidence: [asset.source],
    reviewState: 'approved'
  }))
};
const internal = [normalizedOak];

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
    if (existing) {
      const productId = candidate.mapping.compatibleInternalProductIds[0];
      if (!existing.mapping.compatibleInternalProductIds.includes(productId)) existing.mapping.compatibleInternalProductIds.push(productId);
      existing.mapping.sourceEvidence.push(...candidate.mapping.sourceEvidence);
      return existing;
    }
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
    if (candidate && !primaryOptions.some(option => option.mediaKey === candidate.media.key)) {
      candidate.option.groupId = primaryGroupId(identity, label);
      primaryOptions.push(candidate.option);
    }
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
        const allowedRelationships = role === 'gallery' ? ['product-specific'] : ['product-specific', 'collection-shared'];
        const candidate = add(await describeAsset(identity, `${role}-${ordinal}`, label, `${label} documented for this product family.`, productId, selection, index, items[index], `${role}-option`, undefined, allowedRelationships));
        if (candidate && !target.some(option => option.mediaKey === candidate.media.key)) target.push(candidate.option);
      }
      if (target.length >= limit) break;
    }
  }

  const mediaFor = option => assetsByKey.get(option.mediaKey);
  const hydrate = option => {
    const { mediaKey, groupId, ...publicOption } = option;
    return { ...publicOption, media: mediaFor(option) };
  };
  const groups = [];
  const pushGroup = (definition, options) => {
    if (!options.length) return;
    const existing = groups.find(group => group.id === definition.id);
    if (existing) existing.options.push(...options.map(hydrate));
    else groups.push({ ...definition, options: options.map(hydrate) });
  };
  for (const groupId of [...new Set(primaryOptions.map(option => option.groupId))]) {
    const definition = identity.publicCategory === 'entry-doors' ? groupDefinitions[groupId] : groupCopy[identity.publicCategory];
    pushGroup(definition, primaryOptions.filter(option => option.groupId === groupId));
  }
  pushGroup({
    id: 'finish', eyebrow: 'Finish and colour', title: 'Review documented finish directions.',
    description: 'These documented finish or colour references apply to selected configurations. A current physical sample remains the best final colour check.'
  }, finishOptions);
  pushGroup({
    id: 'layout', eyebrow: 'Configurations', title: 'See documented layout choices.',
    description: 'These diagrams or renders show supported layout directions. Exact compatibility depends on opening size and the selected product.'
  }, layoutOptions);

  const galleryMedia = [];
  for (const option of [...primaryOptions.slice(1), ...gallery].slice(0, 12)) {
    const media = mediaFor(option);
    if (media && !galleryMedia.some(item => item.key === media.key)) galleryMedia.push(media);
  }
  const illustrative = buildIllustrativeOption(identity);
  const publicTechnicalMedia = [...technicalMedia.map(hydrate), ...(illustrative ? [illustrative] : [])];
  const verifiedDetails = buildVerifiedDetails(identity, mapping);
  const privacyIndicator = buildPrivacyIndicator(mapping);
  generated.push({
    publicReference: reference,
    gallery: galleryMedia,
    groups,
    technicalMedia: publicTechnicalMedia,
    verifiedDetails,
    ...(privacyIndicator ? { privacyIndicator: privacyIndicator.public } : {})
  });
  const privateOptions = illustrative ? [{
    publicOptionId: illustrative.id,
    publicProductIds: [reference],
    optionType: 'illustrative-technical',
    compatibleInternalProductIds: [...mapping.internalProductIds],
    compatibilityRestrictions: illustrative.availabilityNote,
    sourceEvidence: mapping.internalProductIds.map(productId => ({ kind: 'normalized-fact', productId })),
    reviewState: 'approved',
    publicAsset: false
  }] : [];
  internal.push({ publicReference: reference, assets: internalAssets, options: privateOptions, ...(privacyIndicator ? { privacyIndicator: privacyIndicator.private } : {}) });
}

const generatedModule = `// Generated by scripts/generate-public-showroom-data.mjs. Public-safe labels and neutral media descriptors only.\nexport const generatedPublicProductShowrooms = ${JSON.stringify(generated, null, 2)};\n`;
await writeFile(path.join(root, 'src/data/public-product-showroom-generated.ts'), generatedModule);
await writeFile(path.join(root, 'src/data/internal/public-product-showroom-mappings.json'), JSON.stringify(internal, null, 2) + '\n');
console.log(`Generated public-safe showroom configurations for ${generated.length} products and ${internal.reduce((count, item) => count + item.assets.length, 0)} verified asset mappings.`);
