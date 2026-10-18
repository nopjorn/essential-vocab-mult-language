// Word list of one set (#/words/<lang>/<setId>), opened from the list icon on a Home set row.
import { settings, saveSettings, wordKey, getProgress, MASTERED_BOX } from './store.js';
import { state, h, render, nameOf, loadLang, setUiLang, ensureAudio, pageHead, groupTitle, readingText, answerOf, speakerBtn, toast } from './core.js';
import { speechSupported } from './speech.js';
import { itemsFor, pickItems, startGame } from './game.js';
import { icon } from './icons.js';

export async function renderWords(code, setId) {
  setUiLang();
  const t = state.t;
  const nav = state.navId;
  const back = { href: '#/', label: t.back };

  let vocab;
  try {
    vocab = await loadLang(code);
    if (nav !== state.navId) return;
  } catch (err) {
    console.error(err);
    render(pageHead(t.practiceTitle, { back }), h('div', { class: 'card error' }, t.loadError));
    return;
  }
  const set = vocab.sets.find((x) => x.id === setId);
  if (!set) {
    render(pageHead(t.practiceTitle, { back }), h('p', { class: 'empty' }, t.noSet));
    return;
  }

  const mastered = set.words.filter((w) => getProgress(wordKey(code, set.id, w.term)).b >= MASTERED_BOX).length;

  const practiceSet = () => {
    ensureAudio(); // iOS only allows speech after a tap
    settings.lang = code;
    if (settings.mode === 'listen' && !speechSupported) settings.mode = 'quiz';
    saveSettings();
    const items = itemsFor(vocab, [set.id]);
    startGame(pickItems(items, settings.count), items);
  };

  render(
    pageHead(`${set.icon} ${nameOf(set.name)}`, { back, sub: `${set.words.length} ${t.words} · ${t.mastered} ${mastered}` }),
    h('div', { class: 'words-actions' },
      h('button', { class: 'btn primary', type: 'button', onclick: practiceSet }, icon('play', { size: 16, fill: true }), t.practiceThisSet)),
    groupTitle(t.wordList),
    h('ul', { class: 'group list' }, set.words.map((word) => {
      const known = getProgress(wordKey(code, set.id, word.term)).b >= MASTERED_BOX;
      const note = word.note?.[settings.target] || word.note?.th;
      return h('li', { class: 'row word-row' },
        h('span', { class: 'rv-term' }, h('span', { lang: code }, word.term), readingText(word) ? h('small', {}, readingText(word)) : null),
        h('span', { class: 'rv-answer' }, answerOf(word), note ? h('small', { class: 'muted block' }, note) : null),
        known ? h('span', { class: 'word-known', title: t.mastered }, icon('check', { size: 16 })) : null,
        speakerBtn(word.term, { lang: code }));
    })),
  );
}
