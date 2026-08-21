export type PublicExcerptOptions = { cardSummary?: string | null; minLength?: number; maxLength?: number; maxSentences?: number };
const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();
export const createPublicExcerpt = (source: string, options: PublicExcerptOptions = {}): string => {
  const text = normalize(options.cardSummary ?? '') || normalize(source);
  const minLength = options.minLength ?? 0, maxLength = options.maxLength ?? 220, maxSentences = options.maxSentences ?? 2;
  if (!text || text.length <= maxLength) return text;
  const sentences = text.match(/[^.!?]+[.!?]+(?:["')\]]+)?/g)?.map(normalize) ?? [], selected: string[] = [];
  for (const sentence of sentences) {
    if (selected.length >= maxSentences || [...selected, sentence].join(' ').length > maxLength) break;
    selected.push(sentence);
  }
  if (selected.length && selected.join(' ').length >= minLength) return selected.join(' ');
  const boundary = text.slice(0, maxLength - 1).search(/\s+\S*$/), cutoff = boundary > 0 ? boundary : maxLength - 1;
  return text.slice(0, cutoff).replace(/[\s,;:.!?-]+$/, '') + '\u2026';
};
