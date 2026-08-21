import assert from 'node:assert/strict';
import { createPublicExcerpt } from '../../src/utils/public-excerpt.ts';
const cases = [
  ['The sash opens outward for.', 'The sash opens outward for ventilation and closes against a compression seal. The complete frame and glass package are selected for the measured opening.'],
  ['Awning windows are often.', 'Awning windows are often considered for compact openings and combinations with fixed glass. Exterior clearance and access still need review.'],
  ['The operation is useful where an outward-projecting sash.', 'The operation is useful where an outward-projecting sash will not interfere with the room. The measured opening determines the final configuration.'],
  ['Double sliders suit wider openings.', 'Double sliders suit wider openings where horizontal operation is practical. Both moving sashes can support flexible ventilation.'],
  ['The restrained face supports contemporary hardware, colour and.', 'The restrained face supports contemporary hardware, colour and glass planning. The final entrance is coordinated as one assembly.'],
  ['Reviewed slabs include flush and panelled faces, allowing.', 'Available slabs include flush and panelled faces, allowing the surface character to suit the home. Finish preparation varies by system.'],
  ['Full-lite.', 'Full-lite proportions bring broad daylight into the entrance. Privacy, safety glass and frame details are confirmed together.'],
  ['The arrangement balances daylight and outward visibility with more.', 'The arrangement balances daylight and outward visibility with more privacy below the glass. Exact proportions vary by slab and insert size.']
];
for (const [broken, source] of cases) {
  const excerpt = createPublicExcerpt(source, { maxLength: 118, maxSentences: 2 });
  assert.notEqual(excerpt, broken); assert.match(excerpt, /[.!?\u2026]$/);
  assert.doesNotMatch(excerpt, /\b(?:and|or|for|with|to|of|in|where|allowing|more)\.$/i);
}
assert.equal(createPublicExcerpt('A complete reviewed card summary.', { cardSummary: 'A dedicated homeowner-facing card summary.' }), 'A dedicated homeowner-facing card summary.');
assert.equal(createPublicExcerpt('This deliberately long sentence has no terminal punctuation and therefore needs a safe word boundary fallback instead of receiving a false period that changes the source text', { maxLength: 80 }), 'This deliberately long sentence has no terminal punctuation and therefore\u2026');
console.log('Public excerpt tests: OK (' + cases.length + ' broken examples covered).');
