// Badges per language, worked out from progress and stats (nothing extra is stored),
// so they also appear for progress made before badges existed or imported from a backup.
import { wordKey, getProgress, getRecords, MASTERED_BOX } from './store.js';
import { state, cachedLang } from './core.js';
import { dayTotals, streak } from './progress.js';

// [id, icon, color, kind, need]
const BADGES = [
  ['streak3', 'flame', 'orange', 'streak', 3],
  ['streak7', 'flame', 'orange', 'streak', 7],
  ['streak30', 'flame', 'orange', 'streak', 30],
  ['words50', 'sparkles', 'green', 'words', 50],
  ['words200', 'sparkles', 'green', 'words', 200],
  ['words500', 'sparkles', 'green', 'words', 500],
  ['words1000', 'sparkles', 'green', 'words', 1000],
  ['set1', 'crown', 'indigo', 'sets', 1],
  ['set10', 'crown', 'indigo', 'sets', 10],
  ['combo10', 'bolt', 'teal', 'combo', 10],
  ['combo25', 'bolt', 'teal', 'combo', 25],
];

// Mastered words and fully mastered sets of a language; needs its vocabulary loaded.
export function masteryCounts(vocab) {
  let words = 0;
  let sets = 0;
  for (const set of vocab.sets) {
    const n = set.words.filter((w) => getProgress(wordKey(vocab.code, set.id, w.term)).b >= MASTERED_BOX).length;
    words += n;
    if (n === set.words.length) sets++;
  }
  return { words, sets };
}

export function badgeList(lang) {
  const t = state.t;
  const vocab = cachedLang(lang);
  const counts = vocab ? masteryCounts(vocab) : { words: 0, sets: 0 };
  const have = {
    streak: streak(dayTotals(lang)),
    words: counts.words,
    sets: counts.sets,
    combo: getRecords(lang).combo || 0,
  };
  return BADGES.map(([id, icon, color, kind, need]) => ({
    id,
    icon,
    color,
    need,
    have: Math.min(have[kind], need),
    earned: have[kind] >= need,
    name: t.badgeNames[kind].replace('{n}', need),
  }));
}

export function earnedIds(lang) {
  return new Set(badgeList(lang).filter((b) => b.earned).map((b) => b.id));
}
