// Version info (from version.js, loaded as a classic script before the app)
// and platform checks.
export const APP_VERSION = self.APP_VERSION || '0.0.0';
export const APP_BUILD = self.APP_BUILD || 'dev';

export function versionLabel() {
  return APP_BUILD === 'dev' ? `v${APP_VERSION} (dev)` : `v${APP_VERSION} · build ${APP_BUILD}`;
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isIPad() {
  return /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}
