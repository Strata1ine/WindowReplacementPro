const words = value => value?.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;

export function getShowroomMetrics(identity, showroom, relatedProducts = 3) {
  const groups = showroom?.groups ?? [];
  const group = id => groups.find(item => item.id === id)?.options ?? [];
  const assets = new Map();
  for (const media of showroom?.gallery ?? []) assets.set(media.key, media);
  for (const item of groups.flatMap(item => item.options)) assets.set(item.media.key, item.media);
  for (const item of showroom?.technicalMedia ?? []) assets.set(item.media.key, item.media);
  const primaryOptions = group('style').length + group('glass').length;
  const layoutOptions = group('layout').length;
  const finishOptions = group('finish').length;
  const hardwareOptions = group('hardware').length;
  const technicalMedia = showroom?.technicalMedia?.length ?? 0;
  const specificationCount = (identity.publicSpecifications?.length ?? 0) + (showroom?.verifiedDetails?.length ?? 0);
  return {
    publicReference: identity.publicReference,
    name: identity.publicDisplayName,
    category: identity.publicCategory,
    heroMediaCount: 1,
    galleryMediaCount: showroom?.gallery?.length ?? 0,
    uniqueShowroomMediaCount: assets.size,
    totalUsefulMediaCount: 1 + assets.size,
    configurationCount: primaryOptions + layoutOptions,
    finishColourOptions: finishOptions,
    glassDesignOptions: group('glass').length,
    layoutOptions,
    hardwareOptions,
    technicalMedia,
    specificationCount,
    relatedProducts,
    interactiveChoiceModules: (showroom?.gallery?.length ? 1 : 0) + groups.filter(item => item.options.length).length,
    substantiveEditorial: words(identity.publicSummary) >= 70,
    hasTechnicalOrLayoutContext: technicalMedia > 0 || layoutOptions > 0,
    hasShowroom: Boolean(showroom)
  };
}

export function isShowroomReadyProduct(metrics) {
  if (!metrics.hasShowroom || !metrics.substantiveEditorial || metrics.specificationCount < 4) return false;
  if (metrics.totalUsefulMediaCount < 4) return false;
  if (metrics.category === 'door-glass') return metrics.glassDesignOptions >= 1 && metrics.totalUsefulMediaCount >= 4;
  if (metrics.category === 'entry-doors') return metrics.configurationCount >= 2 && (metrics.finishColourOptions + metrics.glassDesignOptions + metrics.layoutOptions + metrics.technicalMedia) >= 1;
  if (metrics.category === 'windows') return metrics.configurationCount >= 2 && metrics.technicalMedia >= 1;
  if (metrics.category === 'patio-doors') return metrics.configurationCount >= 2 && (metrics.layoutOptions + metrics.technicalMedia + metrics.finishColourOptions) >= 1;
  return false;
}

export function classifyShowroomProduct(metrics) {
  if (!metrics.hasShowroom) return 'requires-review';
  if (isShowroomReadyProduct(metrics)) return 'showroom-ready';
  if (metrics.totalUsefulMediaCount < 3) return 'media-limited';
  if (!metrics.substantiveEditorial || metrics.specificationCount < 3 || metrics.configurationCount < 1) return 'evidence-limited';
  if (metrics.totalUsefulMediaCount >= 3 && metrics.interactiveChoiceModules >= 1) return 'adequate';
  return 'evidence-limited';
}
