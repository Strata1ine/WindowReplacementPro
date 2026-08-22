const words = value => value?.match(/[A-Za-z0-9]+/g)?.length ?? 0;

export function getShowroomMetrics(identity, showroom, relatedProducts = 3) {
  const groups = showroom?.groups ?? [];
  const group = id => groups.find(item => item.id === id)?.options ?? [];
  const allOptions = groups.flatMap(item => item.options);
  const assets = new Map();
  const diagrams = new Set();
  for (const media of showroom?.gallery ?? []) assets.set(media.key, media);
  for (const item of allOptions) {
    if (item.media) assets.set(item.media.key, item.media);
    if (item.diagram) diagrams.add(item.diagram.kind + ':' + item.diagram.variant);
  }
  for (const item of showroom?.technicalMedia ?? []) {
    if (item.media) assets.set(item.media.key, item.media);
    if (item.diagram) diagrams.add(item.diagram.kind + ':' + item.diagram.variant);
  }
  const primaryOptions = group('style').length + group('glass').length;
  const layoutOptions = group('layout').length;
  const finishOptions = group('finish').length;
  const hardwareOptions = group('hardware').length;
  const technicalMedia = showroom?.technicalMedia?.length ?? 0;
  const specificationCount = (identity.publicSpecifications?.length ?? 0) + (showroom?.verifiedDetails?.length ?? 0);
  const installedContextMedia = [...(showroom?.gallery ?? []), ...allOptions.map(item => item.media).filter(Boolean)]
    .filter(media => /installed|interior|exterior|context|entrance/i.test(media.alt)).length;
  const totalUsefulMediaCount = 1 + assets.size + diagrams.size;
  const configurationCount = primaryOptions + layoutOptions;
  const visualOptionCount = allOptions.length;
  const richness = {
    heroQuality: 15,
    galleryDepth: Math.min(15, (showroom?.gallery?.length ?? 0) * 5),
    visualOptions: Math.min(20, visualOptionCount * 5),
    configurationDepth: Math.min(15, configurationCount * 5),
    technicalMedia: technicalMedia > 0 || layoutOptions > 0 ? 15 : 0,
    specificationDepth: Math.min(10, specificationCount * 2),
    installedContext: installedContextMedia > 0 ? 5 : 0,
    relatedProducts: relatedProducts >= 3 ? 5 : Math.min(5, relatedProducts)
  };
  const showroomRichnessScore = Object.values(richness).reduce((sum, value) => sum + value, 0);
  return {
    publicReference: identity.publicReference,
    name: identity.publicDisplayName,
    category: identity.publicCategory,
    heroMediaCount: 1,
    galleryMediaCount: showroom?.gallery?.length ?? 0,
    uniqueShowroomMediaCount: assets.size,
    illustrativeDiagramCount: diagrams.size,
    totalUsefulMediaCount,
    configurationCount,
    visualOptionCount,
    finishColourOptions: finishOptions,
    glassDesignOptions: group('glass').length,
    layoutOptions,
    hardwareOptions,
    technicalMedia,
    specificationCount,
    installedContextMedia,
    relatedProducts,
    interactiveChoiceModules: (showroom?.gallery?.length ? 1 : 0) + groups.filter(item => item.options.length).length,
    substantiveEditorial: words(identity.publicSummary) >= 70,
    hasTechnicalOrLayoutContext: technicalMedia > 0 || layoutOptions > 0,
    hasShowroom: Boolean(showroom),
    richness,
    showroomRichnessScore
  };
}

export function isShowroomReadyProduct(metrics) {
  if (!metrics.hasShowroom || !metrics.substantiveEditorial || metrics.specificationCount < 4) return false;
  if (metrics.totalUsefulMediaCount < 4 || metrics.showroomRichnessScore < 65) return false;
  if (metrics.category === 'door-glass') return metrics.glassDesignOptions >= 1 && metrics.hasTechnicalOrLayoutContext;
  if (metrics.category === 'entry-doors') return metrics.visualOptionCount >= 2 && (metrics.hasTechnicalOrLayoutContext || metrics.visualOptionCount >= 8);
  if (metrics.category === 'windows') return metrics.configurationCount >= 2 && metrics.technicalMedia >= 1;
  if (metrics.category === 'patio-doors') return metrics.configurationCount >= 2 && metrics.hasTechnicalOrLayoutContext;
  return false;
}

export function getShowroomGapReasons(metrics) {
  const reasons = [];
  if (!metrics.hasShowroom) reasons.push('no public showroom configuration exists');
  if (!metrics.substantiveEditorial) reasons.push('substantive editorial evidence is incomplete');
  if (metrics.specificationCount < 4) reasons.push('fewer than four useful verified specifications are available');
  if (metrics.totalUsefulMediaCount < 4) reasons.push('fewer than four useful verified or illustrative visuals are available');
  if (!metrics.hasTechnicalOrLayoutContext && !(metrics.category === 'entry-doors' && metrics.visualOptionCount >= 8)) reasons.push('no verified technical, layout or illustrative configuration context is available');
  if (metrics.category === 'entry-doors' && metrics.visualOptionCount < 2) reasons.push('only one documented visual choice is available');
  if (metrics.category === 'windows' && metrics.configurationCount < 2) reasons.push('only one documented operating or configuration direction is available');
  if (metrics.category === 'patio-doors' && metrics.configurationCount < 2) reasons.push('only one documented panel or system direction is available');
  if (metrics.category === 'door-glass' && metrics.glassDesignOptions < 1) reasons.push('no additional documented glass design choice is available');
  if (metrics.showroomRichnessScore < 65) reasons.push('showroom richness score remains below 65');
  return [...new Set(reasons)];
}

export function classifyShowroomProduct(metrics) {
  if (!metrics.hasShowroom) return 'requires-review';
  if (isShowroomReadyProduct(metrics)) return 'showroom-ready';
  if (metrics.totalUsefulMediaCount < 3) return 'media-limited';
  if (!metrics.substantiveEditorial || metrics.specificationCount < 3 || metrics.visualOptionCount < 1) return 'evidence-limited';
  if (metrics.totalUsefulMediaCount >= 3 && metrics.interactiveChoiceModules >= 1) return 'adequate';
  return 'evidence-limited';
}