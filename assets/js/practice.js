// Home tab: language switch, progress summary, game mode and word sets, plus
// startPractice() for the Start button in the middle of the tab bar.
// App-wide options (translation, question count, theme…) live in the Settings tab.
import { settings, saveSettings, wordKey, getProgress, MASTERED_BOX } from './store.js';
import { state, h, fill, render, nameOf, levelOf, loadLang, setUiLang, ensureAudio, pageHead, groupTitle, toast } from './core.js';
import { speechSupported } from './speech.js';
import { MODES, itemsFor, pickItems, startGame } from './game.js';
import { langSummary, dayTotals, streak } from './progress.js';
import { icon, MODE_ICON } from './icons.js';
import { isIOS, isStandalone } from './app-info.js';

// Sets chosen for a language; new users start with its first two sets.
function chosenIds(vocab) {
  return settings.sets[vocab.code] || vocab.sets.slice(0, 2).map((x) => x.id);
}

// Start a round with the current language, mode and sets. The Start button lives in
// the tab bar, so this can run from any tab; when the selection can't make a round,
// it sends the user Home to fix it.
export async function startPractice() {
  const t = state.t;
  ensureAudio(); // iOS only allows speech after a tap, so unlock it before awaiting
  const nav = state.navId;
  let vocab;
  try {
    vocab = await loadLang(settings.lang);
  } catch (err) {
    console.error(err);
    return toast(t.loadError);
  }
  if (nav !== state.navId) return;
  if (settings.mode === 'listen' && !speechSupported) settings.mode = 'quiz';
  const items = itemsFor(vocab, chosenIds(vocab));
  const problem = !items.length ? t.pickSet : settings.mode !== 'flash' && items.length < 4 ? t.notEnough : null;
  if (problem) {
    if (location.hash && location.hash !== '#/') location.hash = '#/';
    return toast(problem);
  }
  startGame(pickItems(items, settings.count), items);
}

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

  const chosen = new Set(chosenIds(vocab));
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
      h('div', { class: 'summary-num' }, h('b', {}, s.mastered), h('span', {}, ` / ${s.total.toLocaleString()} ${t.words}`)),
      h('div', { class: 'meter' }, h('span', { class: 'meter-fill', style: `width:${s.total ? (s.mastered / s.total) * 100 : 0}%` })),
    ),
    h('div', { class: 'summary-side' },
      h('span', { class: 'chip-stat', title: t.streak }, icon('flame', { size: 16 }), `${streak(dayTotals(code))} ${t.days}`),
      h('span', { class: 'chip-stat', title: t.accuracy }, icon('target', { size: 16 }), answered ? `${Math.round((s.c / answered) * 100)}%` : '–'),
    ),
    h('span', { class: 'summary-chev' }, icon('chevronRight', { size: 20 })),
  );

  // ---- what Start will play (the button itself is in the tab bar) ----
  const setsFoot = h('p', { class: 'group-foot sets-foot' });
  const refreshFoot = () => {
    const words = vocab.sets.filter((x) => chosen.has(x.id)).reduce((n, x) => n + x.words.length, 0);
    const q = settings.mode === 'match' || settings.count === 0 ? words : Math.min(settings.count, words);
    setsFoot.textContent = chosen.size
      ? t.setsSummary.replace('{sets}', chosen.size).replace('{words}', words.toLocaleString()).replace('{q}', q)
      : t.pickSet;
  };

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
        refreshFoot();
      },
    },
    h('span', { class: 'mode-ic' }, icon(MODE_ICON[m], { size: 26 })),
    h('span', { class: 'mode-name' }, t.modes[m][0])),
  );

  // ---- word sets, one level at a time ----
  const levels = [...new Set(vocab.sets.map(levelOf))].sort();
  let level = settings.level[code];
  if (!levels.includes(level)) level = levelOf(vocab.sets.find((x) => chosen.has(x.id)) || vocab.sets[0]);

  const rowsByLevel = new Map(levels.map((lv) => [lv, []]));
  for (const set of vocab.sets) {
    const total = set.words.length;
    const mastered = set.words.filter((w) => getProgress(wordKey(code, set.id, w.term)).b >= MASTERED_BOX).length;
    rowsByLevel.get(levelOf(set)).push(h('label', { class: 'row set-row' },
      h('input', {
        type: 'checkbox',
        class: 'sr-only',
        checked: chosen.has(set.id),
        'data-set': set.id,
        onchange: (e) => {
          if (e.target.checked) chosen.add(set.id);
          else chosen.delete(set.id);
          persistSets();
          refreshFoot();
        },
      }),
      h('span', { class: 'set-ic', 'aria-hidden': 'true' }, set.icon),
      h('span', { class: 'row-text' },
        h('span', { class: 'row-label' }, nameOf(set.name)),
        h('span', { class: 'row-sub' }, `${total} ${t.words} · ${t.mastered} ${mastered}`),
        h('span', { class: 'meter thin' }, h('span', { class: 'meter-fill', style: `width:${total ? (mastered / total) * 100 : 0}%` })),
      ),
      h('span', { class: 'check-circle', 'aria-hidden': 'true' }, icon('check', { size: 16 })),
    ));
  }

  const setsList = h('div', { class: 'group list sets-list' });
  const levelInfo = h('p', { class: 'level-info' });
  const showLevel = () => {
    const sets = vocab.sets.filter((x) => levelOf(x) === level);
    const words = sets.reduce((n, x) => n + x.words.length, 0);
    levelInfo.textContent = t.levelInfo
      .replace('{name}', t.levelNames[level])
      .replace('{sets}', sets.length)
      .replace('{words}', words.toLocaleString());
    fill(setsList, rowsByLevel.get(level));
  };
  const levelSeg = levels.length > 1
    ? h('div', { class: 'segmented level-seg', role: 'radiogroup', 'aria-label': t.level },
        levels.map((lv) =>
          h('label', {},
            h('input', {
              type: 'radio',
              name: 'level',
              value: lv,
              checked: lv === level,
              onchange: () => {
                level = lv;
                settings.level[code] = lv;
                saveSettings();
                showLevel();
              },
            }),
            h('span', {}, t.levelN.replace('{n}', lv)))))
    : null;

  // Select all / clear act on the level being shown.
  const setAll = (on) => {
    for (const row of rowsByLevel.get(level)) {
      const input = row.querySelector('input');
      input.checked = on;
      if (on) chosen.add(input.dataset.set);
      else chosen.delete(input.dataset.set);
    }
    persistSets();
    refreshFoot();
  };

  const setsTitle = groupTitle(t.chooseSets,
    h('button', { class: 'text-btn', type: 'button', onclick: () => setAll(true) }, t.selectAll),
    h('button', { class: 'text-btn', type: 'button', onclick: () => setAll(false) }, t.selectNone));
  setsTitle.classList.add('sets-title');

  showLevel();
  refreshFoot();

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
    h('section', { class: 'sets-col' },
      setsTitle,
      levelSeg,
      levelInfo,
      setsList,
      setsFoot),
  );
}
