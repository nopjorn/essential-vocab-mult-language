// Shared state and DOM helpers used by every screen.
import { uiFor } from './i18n.js';
import { settings } from './store.js';
import { speak, unlock, speechSupported } from './speech.js';

export const state = {
  index: null, // data/languages.json
  t: uiFor(settings.target),
};
const vocabCache = new Map();
let audioUnlocked = false;

export const screen = document.getElementById('screen');

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// replaceChildren() would print null/false as text, so drop them first.
export function fill(el, ...nodes) {
  el.replaceChildren(...nodes.flat().filter((n) => n != null && n !== false));
}

export function render(...nodes) {
  fill(screen, ...nodes);
  window.scrollTo(0, 0);
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function nameOf(obj) {
  return (obj && (obj[settings.target] || obj.th || obj.en)) || '';
}

export async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

export async function loadIndex() {
  state.index = await fetchJSON('data/languages.json');
  return state.index;
}

export async function loadLang(code) {
  if (vocabCache.has(code)) return vocabCache.get(code);
  const meta = state.index.learn.find((l) => l.code === code);
  const data = await fetchJSON(`data/${meta.file}`);
  vocabCache.set(code, data);
  return data;
}

export function loadAllLangs() {
  return Promise.all(state.index.learn.map((l) => loadLang(l.code)));
}

export function langMeta(code) {
  return state.index.learn.find((l) => l.code === code);
}

// Translation languages that every word of this vocabulary has.
export function targetsFor(vocab) {
  return state.index.translate.filter(
    (x) => x.code !== vocab.code && vocab.sets.every((s) => s.words.every((w) => w.tr[x.code])),
  );
}

// Translation shown for a word: the chosen target if present, else Thai.
export function answerOf(word) {
  return word.tr[settings.target] || word.tr.th;
}

export function setUiLang() {
  state.t = uiFor(settings.target);
  document.documentElement.lang = settings.target;
}

export function ensureAudio() {
  if (!audioUnlocked) {
    unlock();
    audioUnlocked = true;
  }
}

export function speechTag(code = settings.lang) {
  return vocabCache.get(code)?.speech || code;
}

export function say(text, code = settings.lang) {
  speak(text, speechTag(code));
}

export function speakerBtn(text, { big = false, lang = settings.lang } = {}) {
  if (!speechSupported) return null;
  return h('button', {
    class: big ? 'speaker big' : 'speaker',
    type: 'button',
    'aria-label': state.t.tapToListen,
    onclick: (e) => {
      e.stopPropagation();
      ensureAudio();
      say(text, lang);
    },
  }, '🔊');
}

// Kana reading (Japanese) and romanization, shown under the word.
export function readingText(item) {
  return [item.reading, item.roman].filter(Boolean).join(' · ');
}

export function termBlock(item, { size = 'xl', reading = settings.showRoman, lang = settings.lang } = {}) {
  const r = reading ? readingText(item) : '';
  return h('div', { class: `term term-${size}` },
    h('span', { class: 'term-text', lang }, item.term),
    r ? h('span', { class: 'roman' }, r) : null,
  );
}

let toastTimer = null;
export function toast(message, { action, onAction, sticky = false } = {}) {
  const root = document.getElementById('toast');
  fill(root,
    h('div', { class: 'toast', role: 'status' },
      h('span', {}, message),
      action ? h('button', { class: 'toast-btn', type: 'button', onclick: () => { root.replaceChildren(); onAction?.(); } }, action) : null,
      h('button', { class: 'toast-close', type: 'button', 'aria-label': '✕', onclick: () => root.replaceChildren() }, '✕'),
    ),
  );
  clearTimeout(toastTimer);
  if (!sticky) toastTimer = setTimeout(() => root.replaceChildren(), 6000);
}
