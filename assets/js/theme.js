// Light / dark / follow-system theme. The early inline script in index.html
// sets data-theme before first paint; this module keeps it in sync.
import { settings, saveSettings } from './store.js';
import { state, h } from './core.js';

const THEMES = ['system', 'light', 'dark'];
const ICONS = { system: '🖥️', light: '☀️', dark: '🌙' };
const BAR = { light: '#f6f4ff', dark: '#14121f' };

export function applyTheme() {
  const root = document.documentElement;
  if (settings.theme === 'light' || settings.theme === 'dark') root.dataset.theme = settings.theme;
  else delete root.dataset.theme;

  // Status bar / browser chrome color follows the effective theme.
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  metas.forEach((m) => {
    if (settings.theme === 'system') m.setAttribute('content', m.media.includes('dark') ? BAR.dark : BAR.light);
    else m.setAttribute('content', BAR[settings.theme]);
  });
}

export function themeControl() {
  const t = state.t;
  const labels = { system: t.themeSystem, light: t.themeLight, dark: t.themeDark };
  return h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': t.theme },
    THEMES.map((th) =>
      h('label', {},
        h('input', {
          type: 'radio',
          name: 'theme',
          value: th,
          checked: settings.theme === th,
          onchange: () => {
            settings.theme = th;
            saveSettings();
            applyTheme();
          },
        }),
        h('span', {}, `${ICONS[th]} ${labels[th]}`),
      ),
    ),
  );
}
