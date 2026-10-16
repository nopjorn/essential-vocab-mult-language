// Practice tab (home): language switch, progress summary, game mode, word sets, start.
// App-wide options (translation, question count, theme…) live in the Settings tab.
import { settings, saveSettings, wordKey, getProgress, MASTERED_BOX } from './store.js';
import { state, h, render, nameOf, loadLang, setUiLang, ensureAudio, pageHead, groupTitle, toast } from './core.js';
import { speechSupported } from './speech.js';
import { MODES, itemsFor, pickItems, startGame } from './game.js';
import { langSummary, dayTotals, streak } from './progress.js';
import { icon, MODE_ICON } from './icons.js';
import { isIOS, isStandalone } from './app-info.js';

export async function renderPractice() {
  setUiLang();
  const t = state.t;
  const nav = state.navId;

  let vocab;
  try {
    vocab = await loadLang(settings.lang);
    if (nav !== state.navId) return;
  } catch (err) {
    console.error(err);
    render(pageHead(t.practiceTitle), h('div', { class: 'card error' }, t.loadError, ' ', h('button', { class: 'btn', onclick: renderPractice }, '↻')));
    return;
  }
  const code = vocab.code;
  if (settings.mode === 'listen' && !speechSupported) settings.mode = 'quiz';

  const chosen = new Set(settings.sets[code] || vocab.sets.slice(0, 2).map((s) => s.id));
  const persistSets = () => {
    settings.sets[code] = [...chosen];
    saveSettings();
  };

  // ---- language switch ----
  const langSwitch = h('div', { class: 'lang-switch', role: 'tablist', 'aria-label': t.practiceSub },
    state.index.learn.map((l) => {
      const active = l.code === code;
      return h('button', {
        type: 'button',
        role: 'tab',
        class: `lang-opt${active ? ' active' : ''}`,
        'aria-selected': String(active),
        onclick: () => {
          if (active) return;
          settings.lang = l.code;
          saveSettings();
          renderPractice();
        },
      }, h('span', { class: 'flag', 'aria-hidden': 'true' }, l.flag), h('span', { class: 'lang-opt-name' }, nameOf(l.name)));
    }),
  );

  // ---- progress summary for this language ----
  const s = langSummary(vocab);
  const answered = s.c + s.w;
  const summary = h('a', { class: 'summary', href: `#/progress/${code}` },
    h('div', { class: 'summary-main' },
      h('span', { class: 'summary-label' }, t.mastered),
      h('div', { class: 'summary-num' }, h('b', {}, s.mastered), h('span', {}, ` / ${s.total} ${t.words}`)),
      h('div', { class: 'meter' }, h('span', { class: 'meter-fill', style: `width:${s.total ? (s.mastered / s.total) * 100 : 0}%` })),
    ),
    h('div', { class: 'summary-side' },
      h('span', { class: 'chip-stat', title: t.streak }, icon('flame', { size: 16 }), `${streak(dayTotals(code))} ${t.days}`),
      h('span', { class: 'chip-stat', title: t.accuracy }, icon('target', { size: 16 }), answered ? `${Math.round((s.c / answered) * 100)}%` : '–'),
    ),
    h('span', { class: 'summary-chev' }, icon('chevronRight', { size: 20 })),
  );

  // ---- start button (fixed above the tab bar) ----
  const ctaSub = h('small', { class: 'cta-sub' });
  const startBtn = h('button', { class: 'btn primary big cta', type: 'button' },
    icon('play', { size: 18, fill: true }),
    h('span', { class: 'cta-text' }, h('span', {}, t.start), ctaSub));
  const refreshCta = () => {
    const words = vocab.sets.filter((x) => chosen.has(x.id)).reduce((n, x) => n + x.words.length, 0);
    const q = settings.mode === 'match' || settings.count === 0 ? words : Math.min(settings.count, words);
    startBtn.disabled = chosen.size === 0;
    ctaSub.textContent = chosen.size
      ? `${t.modes[settings.mode][0]} · ${chosen.size} ${t.setsUnit} · ${q} ${t.questionsUnit}`
      : t.pickSet;
  };
  startBtn.addEventListener('click', () => {
    ensureAudio();
    const items = itemsFor(vocab, [...chosen]);
    if (!items.length) return toast(t.pickSet);
    if (settings.mode !== 'flash' && items.length < 4) return toast(t.notEnough);
    startGame(pickItems(items, settings.count), items);
  });

  // ---- game modes ----
  const modeDesc = h('p', { class: 'mode-desc-line' }, t.modes[settings.mode][1]);
  const modeTiles = MODES.map((m) =>
    h('button', {
      type: 'button',
      role: 'radio',
      class: `mode-tile${settings.mode === m ? ' active' : ''}`,
      'aria-checked': String(settings.mode === m),
      disabled: m === 'listen' && !speechSupported,
      onclick: () => {
        settings.mode = m;
        saveSettings();
        modeTiles.forEach((b, i) => {
          b.classList.toggle('active', MODES[i] === m);
          b.setAttribute('aria-checked', String(MODES[i] === m));
        });
        modeDesc.textContent = t.modes[m][1];
        refreshCta();
      },
    },
    h('span', { class: 'mode-ic' }, icon(MODE_ICON[m], { size: 26 })),
    h('span', { class: 'mode-name' }, t.modes[m][0])),
  );

  // ---- word sets ----
  const setRows = vocab.sets.map((set) => {
    const total = set.words.length;
    const mastered = set.words.filter((w) => getProgress(wordKey(code, set.id, w.term)).b >= MASTERED_BOX).length;
    return h('label', { class: 'row set-row' },
      h('input', {
        type: 'checkbox',
        class: 'sr-only',
        checked: chosen.has(set.id),
        onchange: (e) => {
          if (e.target.checked) chosen.add(set.id);
          else chosen.delete(set.id);
          persistSets();
          refreshCta();
        },
      }),
      h('span', { class: 'set-ic', 'aria-hidden': 'true' }, set.icon),
      h('span', { class: 'row-text' },
        h('span', { class: 'row-label' }, nameOf(set.name)),
        h('span', { class: 'row-sub' }, `${total} ${t.words} · ${t.mastered} ${mastered}`),
        h('span', { class: 'meter thin' }, h('span', { class: 'meter-fill', style: `width:${total ? (mastered / total) * 100 : 0}%` })),
      ),
      h('span', { class: 'check-circle', 'aria-hidden': 'true' }, icon('check', { size: 16 })),
    );
  });
  const setAll = (on) => {
    chosen.clear();
    if (on) vocab.sets.forEach((x) => chosen.add(x.id));
    setRows.forEach((r) => (r.querySelector('input').checked = on));
    persistSets();
    refreshCta();
  };

  const setsTitle = groupTitle(t.chooseSets,
    h('button', { class: 'text-btn', type: 'button', onclick: () => setAll(true) }, t.selectAll),
    h('button', { class: 'text-btn', type: 'button', onclick: () => setAll(false) }, t.selectNone));
  setsTitle.classList.add('sets-title');

  refreshCta();

  render(
    pageHead(t.practiceTitle, { sub: t.practiceSub }),
    langSwitch,
    summary,
    isIOS() && !isStandalone()
      ? h('a', { class: 'install-card', href: '#/help/install' },
          h('span', { class: 'row-icon blue' }, icon('share', { size: 18 })),
          h('span', { class: 'row-text' }, h('span', { class: 'row-label' }, t.installTitle), h('span', { class: 'row-sub' }, t.installSub)),
          icon('chevronRight', { size: 18, cls: 'chev' }))
      : null,
    groupTitle(t.chooseMode),
    h('div', { class: 'mode-grid', role: 'radiogroup', 'aria-label': t.chooseMode }, modeTiles),
    modeDesc,
    setsTitle,
    h('div', { class: 'group list sets-list' }, setRows),
    h('div', { class: 'cta-bar' }, startBtn),
  );
}
