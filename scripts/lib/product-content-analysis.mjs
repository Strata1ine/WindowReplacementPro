const words = value => value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const normalized = value => words(value).join(' ');
const trigrams = value => {
  const tokens = words(value), result = new Set();
  for (let index = 0; index + 2 < tokens.length; index += 1) result.add(tokens.slice(index, index + 3).join(' '));
  return result;
};
const sentences = value => value.split(/(?<=[.!?])\s+/).map(item => item.trim()).filter(item => words(item).length >= 6);
const pairKey = (left, right) => [left, right].sort().join('|');

export function analyzeProductPages(pages, reviewedExceptions = []) {
  const exceptionKeys = new Set(reviewedExceptions.map(item => pairKey(item.left, item.right)));
  const fragmentOwners = new Map(), sentenceOwners = new Map(), factOwners = new Map(), guidanceOwners = new Map();
  const addOwner = (map, value, reference) => {
    const key = normalized(value); if (!key) return;
    const entry = map.get(key) ?? { text: value.trim(), references: new Set() };
    entry.references.add(reference); map.set(key, entry);
  };
  for (const page of pages) {
    for (const fragment of page.fragments) {
      if (fragment.kind !== 'fact') addOwner(fragmentOwners, fragment.text, page.reference);
      if (fragment.kind === 'fact') addOwner(factOwners, fragment.text, page.reference);
      if (fragment.kind === 'guidance') addOwner(guidanceOwners, fragment.text, page.reference);
      if (fragment.kind !== 'fact') sentences(fragment.text).forEach(sentence => addOwner(sentenceOwners, sentence, page.reference));
    }
  }
  const sets = new Map(pages.map(page => [page.reference, trigrams(page.fragments.map(fragment => fragment.text).join(' '))]));
  const pairs = [];
  for (let left = 0; left < pages.length; left += 1) for (let right = left + 1; right < pages.length; right += 1) {
    const a = sets.get(pages[left].reference), b = sets.get(pages[right].reference);
    let overlap = 0; for (const item of a) if (b.has(item)) overlap += 1;
    const score = a.size || b.size ? overlap / (a.size + b.size - overlap) : 0;
    pairs.push({ left: pages[left].reference, right: pages[right].reference, leftName: pages[left].name, rightName: pages[right].name, score: Number(score.toFixed(4)), reviewedException: exceptionKeys.has(pairKey(pages[left].reference, pages[right].reference)) });
  }
  pairs.sort((a, b) => b.score - a.score);
  const occurrenceList = map => Array.from(map.values()).map(entry => ({ text: entry.text, references: Array.from(entry.references).sort(), count: entry.references.size })).filter(entry => entry.count > 1).sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
  const allTrigramOwners = new Map();
  for (const page of pages) for (const gram of sets.get(page.reference)) {
    const owners = allTrigramOwners.get(gram) ?? new Set(); owners.add(page.reference); allTrigramOwners.set(gram, owners);
  }
  const pageMetrics = pages.map(page => {
    const pageTrigrams = sets.get(page.reference), uniqueTrigrams = Array.from(pageTrigrams).filter(gram => allTrigramOwners.get(gram).size === 1).length;
    const facts = page.fragments.filter(fragment => fragment.kind === 'fact');
    const guidance = page.fragments.filter(fragment => fragment.kind === 'guidance');
    const editorial = page.fragments.filter(fragment => fragment.kind !== 'fact');
    const uniqueFacts = facts.filter(fragment => factOwners.get(normalized(fragment.text))?.references.size === 1).length;
    const uniqueEditorial = editorial.filter(fragment => fragmentOwners.get(normalized(fragment.text))?.references.size === 1).length;
    const uniqueGuidance = guidance.filter(fragment => guidanceOwners.get(normalized(fragment.text))?.references.size === 1).length;
    const editorialWordCount = words(page.fragments.map(fragment => fragment.text).join(' ')).length;
    const guidanceWordCount = words(guidance.map(fragment => fragment.text).join(' ')).length;
    const insufficientReasons = [];
    if (editorialWordCount < 170) insufficientReasons.push('fewer than 170 substantive words');
    if (guidanceWordCount < 70) insufficientReasons.push('fewer than 70 guidance words');
    if (uniqueTrigrams < 30) insufficientReasons.push('fewer than 30 page-unique trigrams');
    if (uniqueEditorial < 3) insufficientReasons.push('fewer than 3 unique editorial fragments');
    if (uniqueGuidance < 3) insufficientReasons.push('fewer than 3 unique guidance fragments');
    if (!page.heroSrc || !page.heroAlt) insufficientReasons.push('missing differentiated hero media or alt text');
    return { reference: page.reference, name: page.name, category: page.category, editorialWordCount, guidanceWordCount, factCount: facts.length, uniqueFacts, uniqueEditorial, uniqueGuidance, uniqueTrigrams, heroSrc: page.heroSrc, heroAlt: page.heroAlt, specificationSignature: page.specificationValues.map(normalized).join('|'), insufficientReasons };
  });
  const duplicateHeroes = Object.entries(pageMetrics.reduce((groups, page) => { if (page.heroSrc) (groups[page.heroSrc] ??= []).push(page.reference); return groups; }, {})).filter(([, refs]) => refs.length > 1).map(([src, references]) => ({ src, references }));
  const duplicateSpecifications = Object.entries(pageMetrics.reduce((groups, page) => { if (page.specificationSignature) (groups[page.specificationSignature] ??= []).push(page.reference); return groups; }, {})).filter(([, refs]) => refs.length > 1).map(([signature, references]) => ({ signature, references }));
  return {
    pageCount: pages.length,
    pairs,
    pairsAbove60: pairs.filter(pair => pair.score > .60),
    pairsAbove65: pairs.filter(pair => pair.score > .65),
    unreviewedAbove65: pairs.filter(pair => pair.score > .65 && !pair.reviewedException),
    unreviewedAbove70: pairs.filter(pair => pair.score > .70 && !pair.reviewedException),
    repeatedSentences: occurrenceList(sentenceOwners),
    repeatedParagraphs: occurrenceList(fragmentOwners),
    repeatedFacts: occurrenceList(factOwners),
    pageMetrics,
    insufficientPages: pageMetrics.filter(page => page.insufficientReasons.length),
    duplicateHeroes,
    duplicateSpecifications,
    uniqueHeroCount: new Set(pageMetrics.map(page => page.heroSrc).filter(Boolean)).size,
    uniqueSpecificationSignatureCount: new Set(pageMetrics.map(page => page.specificationSignature).filter(Boolean)).size
  };
}