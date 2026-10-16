// App shell: routing, bottom tab bar, theme, version and update prompts.
// Routes: #/ practice · #/progress[/<lang>] · #/help[/<section>] · #/settings · #/changelog
import { settings, saveSettings, getLastVersion, setLastVersion } from './store.js';
import { state, h, fill, render, loadIndex, setUiLang, toast } from './core.js';
import { uiFor } from './i18n.js';
import { renderPractice } from './practice.js';
import { renderProgress } from './progress.js';
import { renderSettings } from './settings.js';
import { renderHelp, renderChangelog } from './info.js';
import { setExitHandler, onKeys } from './game.js';
import { applyTheme } from './theme.js';
import { icon } from './icons.js';
import { APP_VERSION } from './app-info.js';

const TABS = [
  ['', 'practice', 'navPractice'],
  ['progress', 'progress', 'navProgress'],
  ['help', 'guide', 'navHelp'],
  ['settings', 'settings', 'navSettings'],
];

function renderTabBar(active) {
  const t = state.t;
  document.title = t.appName;
  fill(document.getElementById('tabbar'), TABS.map(([page, ic, key]) => {
    const on = page === active;
    return h('a', { href: `#/${page}`, class: `tab${on ? ' active' : ''}`, 'aria-current': on ? 'page' : null },
      icon(ic, { size: 26 }),
      h('span', { class: 'tab-label' }, t[key]));
  }));
}

function route() {
  state.navId++;
  onKeys(null);
  document.body.classList.remove('in-game');
  setUiLang();
  const path = location.hash.replace(/^#\/?/, '');
  const [page = '', arg] = path.split('/');
  const tab = page === 'changelog' ? 'settings' : TABS.some(([p]) => p === page) ? page : '';
  renderTabBar(tab);
  document.getElementById('screen').dataset.page = tab || 'practice';
  if (page === 'progress') return renderProgress(arg);
  if (page === 'help') return renderHelp(arg);
  if (page === 'settings') return renderSettings();
  if (page === 'changelog') return renderChangelog();
  return renderPractice();
}

function goHome() {
  if (location.hash && location.hash !== '#/') location.hash = '#/';
  else route();
}

function announceVersion() {
  const last = getLastVersion();
  if (last && last !== APP_VERSION) {
    const t = state.t;
    toast(t.updatedTo.replace('{v}', APP_VERSION), { action: t.whatsNew, onAction: () => (location.hash = '#/changelog') });
  }
  setLastVersion(APP_VERSION);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return;
  // A controller already exists means this is an update, not the first install.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    const t = state.t;
    toast(t.updateReady, { action: t.reload, onAction: () => location.reload(), sticky: true });
  });
  navigator.serviceWorker
    .register('sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      // Home-screen apps on iOS can stay open for days: check for updates when brought back.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    })
    .catch((e) => console.warn('SW', e));
}

async function boot() {
  applyTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  try {
    await loadIndex();
  } catch (err) {
    console.error(err);
    render(h('div', { class: 'card error' }, uiFor(settings.target).loadError));
    return;
  }
  if (!state.index.learn.some((l) => l.code === settings.lang)) {
    settings.lang = state.index.learn[0].code;
    saveSettings();
  }
  setExitHandler(goHome);
  window.addEventListener('hashchange', route);
  route();
  announceVersion();
  registerServiceWorker();
}

boot();
