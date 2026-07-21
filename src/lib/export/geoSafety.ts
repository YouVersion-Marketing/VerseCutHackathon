// Neutral-landmark filter for geo backgrounds. Reject religious (any faith),
// political, or conflict imagery by scanning the photo description.
const BLOCKED_TERMS = [
  // religion (all faiths — geo backgrounds should be neutral)
  'church', 'cathedral', 'mosque', 'synagogue', 'temple', 'shrine', 'chapel',
  'worship', 'prayer', 'pray', 'religion', 'religious', 'holy', 'sacred',
  'cross', 'crucifix', 'buddha', 'buddhist', 'hindu', 'islam', 'islamic',
  'muslim', 'christian', 'christ', 'jesus', 'bible', 'quran', 'koran', 'torah',
  'monk', 'nun', 'priest', 'imam', 'rabbi',
  // politics + conflict
  'protest', 'politic', 'election', 'riot', 'war', 'military', 'soldier',
  'weapon', 'gun', 'army', 'battle', 'demonstration',
];

export function isSafeGeoPhoto(photo: { description: string | null }): boolean {
  const text = (photo.description ?? '').toLowerCase();
  return !BLOCKED_TERMS.some((term) => text.includes(term));
}
