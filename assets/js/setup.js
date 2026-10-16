// Setup screen: language, translation, word sets, game mode, options.
import { settings, saveSettings, wordKey, getProgress, resetLanguage, MASTERED_BOX } from './store.js';
import { state, h, render, nameOf, loadLang, targetsFor, setUiLang, ensureAudio, speechTag } from './core.js';
import { speechSupported, hasVoice } from './speech.js';
import { MODES, MODE_ICONS, itemsFor, pickItems, startGame } from './game.js';
import { themeControl } from './theme.js';
import { versionLabel, isIOS, isStandalone } from './app-info.js';

const COUNTS = [10, 20, 30, 0]; // 0 = all

export async function renderSetup() {
  setUiLang();
  const t = state.t;

  let vocab;
  try {
    vocab = await loadLang(settings.lang);
  } catch (err) {
    console.error(err);
    render(h('div', { class: 'card error' }, t.loadError, ' ', h('button', { class: 'btn', onclick: renderSetup }, '↻')));
    return;
  }

  const targets = targetsFor(vocab);
  if (!targets.some((x) => x.code === settings.target)) {
    settings.target = targets[0]?.code || 'th';
    saveSettings();
    return renderSetup();
  }

  const chosen = new Set(settings.sets[settings.lang] || vocab.sets.slice(0, 2).map((s) => s.id));
  const persistSets = () => {
    settings.sets[settings.lang] = [...chosen];
    saveSettings();
  };

  // 1. languages
  const langCards = state.index.learn.map((l) =>
    h('button', {
      type: 'button',
      class: `lang-card${l.code === settings.lang ? ' active' : ''}`,
      'aria-pressed': String(l.code === settings.lang),
      onclick: () => {
        if (l.code === settings.lang) return;
        settings.lang = l.code;
        saveSettings();
        renderSetup();
      },
    },
    h('span', { class: 'flag' }, l.flag),
    h('span', { class: 'lang-name' }, nameOf(l.name)),
    h('span', { class: 'lang-native', lang: l.code }, l.nativeName)),
  );

  const targetSelect = h('select', {
    id: 'target',
    onchange: (e) => {
      settings.target = e.target.value;
      saveSettings();
      renderSetup();
    },
  }, targets.map((x) => h('option', { value: x.code, selected: x.code === settings.target }, x.nativeName)));

  // 2. sets
  const setGrid = h('div', { class: 'set-grid' });
  const startBtn = h('button', { class: 'btn primary big', type: 'button' }, `▶ ${t.start}`);
  const refreshStart = () => {
    startBtn.disabled = chosen.size === 0;
  };

  for (const set of vocab.sets) {
    const total = set.words.length;
    const mastered = set.words.filter((w) => getProgress(wordKey(vocab.code, set.id, w.term)).b >= MASTERED_BOX).length;
    const pct = total ? Math.round((mastered / total) * 100) : 0;
    setGrid.append(
      h('label', { class: 'set-card' },
        h('input', {
          type: 'checkbox',
          checked: chosen.has(set.id),
          onchange: (e) => {
            if (e.target.checked) chosen.add(set.id);
            else chosen.delete(set.id);
            persistSets();
            refreshStart();
          },
        }),
        h('span', { class: 'set-icon' }, set.icon),
        h('span', { class: 'set-body' },
          h('span', { class: 'set-name' }, nameOf(set.name)),
          h('span', { class: 'set-meta' }, `${total} ${t.words} · ${t.mastered} ${mastered}`),
          h('span', { class: 'meter' }, h('span', { class: 'meter-fill', style: `width:${pct}%` })),
        ),
      ),
    );
  }

  const setAll = (on) => {
    chosen.clear();
    if (on) vocab.sets.forEach((s) => chosen.add(s.id));
    setGrid.querySelectorAll('input[type=checkbox]').forEach((cb) => (cb.checked = on));
    persistSets();
    refreshStart();
  };

  // 3. modes
  const modeGrid = h('div', { class: 'mode-grid' });
  for (const m of MODES) {
    const [title, desc] = t.modes[m];
    const disabled = m === 'listen' && !speechSupported;
    modeGrid.append(
      h('label', { class: `mode-card${disabled ? ' disabled' : ''}` },
        h('input', {
          type: 'radio',
          name: 'mode',
          value: m,
          disabled,
          checked: settings.mode === m,
          onchange: () => {
            settings.mode = m;
            saveSettings();
          },
        }),
        h('span', { class: 'mode-icon' }, MODE_ICONS[m]),
        h('span', { class: 'mode-body' }, h('span', { class: 'mode-name' }, title), h('span', { class: 'mode-desc' }, desc)),
      ),
    );
  }

  // 4. options
  const countSeg = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': t.questions },
    COUNTS.map((c) =>
      h('label', {},
        h('input', {
          type: 'radio',
          name: 'count',
          value: c,
          checked: settings.count === c,
          onchange: () => {
            settings.count = c;
            saveSettings();
          },
        }),
        h('span', {}, c === 0 ? t.all : String(c)),
      ),
    ),
  );

  const toggle = (key, label) =>
    h('label', { class: 'toggle' },
      h('input', {
        type: 'checkbox',
        checked: settings[key],
        onchange: (e) => {
          settings[key] = e.target.checked;
          saveSettings();
        },
      }),
      h('span', { class: 'switch' }),
      h('span', {}, label),
    );

  const hasReading = vocab.sets.some((s) => s.words.some((w) => w.roman || w.reading));
  const voiceOk = speechSupported && hasVoice(speechTag());

  startBtn.addEventListener('click', () => {
    ensureAudio();
    const items = itemsFor(vocab, [...chosen]);
    if (!items.length) return alert(t.pickSet);
    if (settings.mode !== 'flash' && items.length < 4) return alert(t.notEnough);
    startGame(pickItems(items, settings.count), items);
  });
  refreshStart();

  render(
    h('section', { class: 'card' },
      h('h2', {}, t.stepLang),
      h('div', { class: 'lang-grid' }, langCards),
      h('div', { class: 'row' }, h('label', { for: 'target', class: 'row-label' }, t.stepTarget), targetSelect),
    ),
    h('section', { class: 'card' },
      h('div', { class: 'card-head' },
        h('h2', {}, t.stepSets),
        h('div', { class: 'chips' },
          h('button', { class: 'chip', type: 'button', onclick: () => setAll(true) }, t.selectAll),
          h('button', { class: 'chip', type: 'button', onclick: () => setAll(false) }, t.selectNone),
        ),
      ),
      setGrid,
    ),
    h('section', { class: 'card' }, h('h2', {}, t.stepMode), modeGrid),
    h('section', { class: 'card' },
      h('h2', {}, t.stepOptions),
      h('div', { class: 'row' }, h('span', { class: 'row-label' }, t.questions), countSeg),
      h('div', { class: 'row' }, h('span', { class: 'row-label' }, t.theme), themeControl()),
      hasReading ? toggle('showRoman', t.showRoman) : null,
      speechSupported ? toggle('autoSpeak', t.autoSpeak) : null,
      speechSupported && !voiceOk ? h('p', { class: 'hint warn' }, t.noVoice) : null,
      !speechSupported ? h('p', { class: 'hint warn' }, t.noSpeech) : null,
    ),
    h('div', { class: 'start-bar' }, startBtn),
    isIOS() && !isStandalone()
      ? h('a', { class: 'install-banner', href: '#/help/install' }, `📲 ${t.installHint}`, h('span', { class: 'chev' }, '›'))
      : null,
    h('footer', { class: 'foot' },
      h('p', {}, t.licenseNote),
      h('p', {}, h('a', { href: '#/changelog' }, versionLabel())),
      h('button', {
        class: 'link-btn',
        type: 'button',
        onclick: () => {
          if (confirm(t.resetConfirm)) {
            resetLanguage(settings.lang);
            renderSetup();
          }
        },
      }, t.resetProgress),
    ),
  );
}
