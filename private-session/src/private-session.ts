import {
  whenReady,
  createLogger,
  defineStore,
  platform,
  labels,
  observeProfileMenu,
  toggleSwitch,
} from '@spicetify-ext/core';

const log = createLogger('PrivateSession');

// Boolean flag; key preserved so existing users keep their setting.
const persistentStore = defineStore<boolean>('private-session-persistent-mode', false);
let persistentModeEnabled = false;
const PROFILE_ROW_ID = 'private-session-profile-row';

function setPrivateSession(enabled: boolean): void {
  platform()?.PrivateSessionAPI?.setPrivateSession(enabled);
}

function onFocus(): void {
  setPrivateSession(true);
}

function onVisibilityChange(): void {
  if (!document.hidden) setPrivateSession(true);
}

function attachListeners(): void {
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVisibilityChange);
}

function detachListeners(): void {
  window.removeEventListener('focus', onFocus);
  document.removeEventListener('visibilitychange', onVisibilityChange);
}

function setPersistentMode(enabled: boolean): void {
  persistentModeEnabled = enabled;
  persistentStore.save(enabled);
  if (enabled) {
    setPrivateSession(true);
    attachListeners();
  } else {
    detachListeners();
  }
}

function injectProfileRow(menu: Element): void {
  const existing = menu.querySelector<HTMLElement>(`#${PROFILE_ROW_ID}`);
  if (existing) {
    updateProfileRow(existing);
    return;
  }

  const row = document.createElement('div');
  row.id = PROFILE_ROW_ID;
  row.setAttribute('role', 'menuitemcheckbox');
  row.style.cssText =
    'display:flex;align-items:center;padding:8px 12px;cursor:pointer;justify-content:space-between;';
  const label = document.createElement('span');
  label.style.cssText = 'display:flex;align-items:center;gap:8px;';
  const lockIcon = document.createElement('span');
  lockIcon.setAttribute('aria-hidden', 'true');
  lockIcon.style.cssText = 'width:16px;height:16px;display:flex;align-items:center;';
  const lockedIcon = (Spicetify.SVGIcons?.locked ?? '').trim();
  lockIcon.innerHTML = lockedIcon.startsWith('<svg')
    ? lockedIcon
    : `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">${lockedIcon}</svg>`;
  const labelText = document.createElement('span');
  labelText.textContent = labels.privateSession();
  label.append(lockIcon, labelText);
  const toggle = document.createElement('span');
  toggle.className = 'private-session-toggle';
  toggle.style.cssText = 'width:40px;height:20px;display:flex;align-items:center;justify-content:center;';
  row.append(label, toggle);
  row.addEventListener('mouseenter', () => (row.style.backgroundColor = 'rgba(255,255,255,0.1)'));
  row.addEventListener('mouseleave', () => (row.style.backgroundColor = 'transparent'));
  row.addEventListener('click', () => {
    setPersistentMode(!persistentModeEnabled);
    updateProfileRow(row);
  });

  const settings = menu.querySelector('a[href*="preferences"]')?.closest('li');
  menu.insertBefore(row, settings ?? null);
  updateProfileRow(row);
}

function updateProfileRow(row: HTMLElement): void {
  row.setAttribute('aria-checked', String(persistentModeEnabled));
  const toggle = row.querySelector<HTMLElement>('.private-session-toggle');
  if (toggle) toggle.innerHTML = toggleSwitch(persistentModeEnabled);
}

async function main(): Promise<void> {
  await whenReady({ api: 'PrivateSessionAPI', react: true });
  persistentModeEnabled = persistentStore.load();

  observeProfileMenu(injectProfileRow);

  // Always start a private session on launch.
  setPrivateSession(true);
  if (persistentModeEnabled) attachListeners();

  if (__SPICETIFY_EXTENSIONS_DEBUG__) log.log('initialized', { persistentModeEnabled });
}

main().catch((err) => {
  if (__SPICETIFY_EXTENSIONS_DEBUG__) log.error('init failed', err);
});
