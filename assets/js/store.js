// Settings, learning progress and activity stats, kept in localStorage.
// Storage can be unavailable (private mode, blocked site data), so every
// access is guarded and the app keeps working in memory.

const SETTINGS_KEY = 'evocab.settings.v1';
const PROGRESS_KEY = 'evocab.progress.v1';
const STATS_KEY = 'evocab.stats.v1';
const MAX_SESSIONS = 200;
export const MAX_BOX = 5;
export const MASTERED_BOX = 3;

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

const DEFAULT_SETTINGS = {
  lang: 'en',
  target: 'th',
  sets: {}, // { [lang]: [setId, ...] }
  level: {}, // { [lang]: 1 | 2 | 3 } level shown in the word-set list
  mode: 'quiz',
  count: 10,
  dailyGoal: 20, // answers per day; the Home ring fills toward it
  showRoman: true,
  autoSpeak: true,
  theme: 'system', // 'system' | 'light' | 'dark'
};

export const settings = { ...DEFAULT_SETTINGS, ...load(SETTINGS_KEY, {}) };

export function saveSettings() {
  save(SETTINGS_KEY, settings);
}

// ---------- per-word progress ----------
// { [wordKey]: { b: box 0..MAX_BOX, c: correct, w: wrong, t: lastSeen } }
const progress = load(PROGRESS_KEY, {});

export function wordKey(lang, setId, term) {
  return `${lang}|${setId}|${term}`;
}

export function getProgress(key) {
  return progress[key] || { b: 0, c: 0, w: 0, t: 0 };
}

// ---------- activity stats ----------
// days: { 'YYYY-MM-DD': { [lang]: [answers, correct] } }
// sessions: [{ lang, mode, n, c, s: seconds, t: timestamp }], newest last
const stats = { days: {}, sessions: [], ...load(STATS_KEY, {}) };

export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Leitner-style boxes: correct moves the word up one box, wrong sends it back to box 0.
export function record(key, isCorrect) {
  const p = { ...getProgress(key) };
  if (isCorrect) {
    p.b = Math.min(MAX_BOX, p.b + 1);
    p.c += 1;
  } else {
    p.b = 0;
    p.w += 1;
  }
  p.t = Date.now();
  progress[key] = p;
  save(PROGRESS_KEY, progress);

  const lang = key.split('|')[0];
  const day = (stats.days[dayKey()] ||= {});
  const d = (day[lang] ||= [0, 0]);
  d[0] += 1;
  if (isCorrect) d[1] += 1;
  save(STATS_KEY, stats);
}

// "I already know this word" from the word list: moves it straight to the mastered box, or
// back to box 0 when undone. It is not an answer, so daily stats and accuracy stay untouched.
export function setKnown(key, known) {
  const p = { ...getProgress(key) };
  if (known) p.b = Math.max(p.b, MASTERED_BOX);
  else p.b = 0;
  p.t = Date.now();
  progress[key] = p;
  save(PROGRESS_KEY, progress);
}

// Answers given today in one language.
export function todayAnswers(lang) {
  return stats.days[dayKey()]?.[lang]?.[0] || 0;
}

export function logSession(session) {
  stats.sessions.push(session);
  if (stats.sessions.length > MAX_SESSIONS) stats.sessions.splice(0, stats.sessions.length - MAX_SESSIONS);
  save(STATS_KEY, stats);
}

export function getStats() {
  return stats;
}

export function resetLanguage(lang) {
  for (const k of Object.keys(progress)) {
    if (k.startsWith(`${lang}|`)) delete progress[k];
  }
  for (const day of Object.values(stats.days)) delete day[lang];
  stats.sessions = stats.sessions.filter((s) => s.lang !== lang);
  save(PROGRESS_KEY, progress);
  save(STATS_KEY, stats);
}

export function getLastVersion() {
  return load('evocab.lastVersion', null);
}

export function setLastVersion(v) {
  save('evocab.lastVersion', v);
}
