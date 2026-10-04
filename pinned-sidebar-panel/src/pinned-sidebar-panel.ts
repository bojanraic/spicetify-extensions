import {
  whenReady,
  createLogger,
  defineStore,
  labels,
  layoutSelectors,
  waitForElement,
  observe,
  observeProfileMenu,
  toggleSwitch,
} from '@spicetify-ext/core';

const log = createLogger('PinnedPanel');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const RETRY = { DELAY: 333, MAX_ATTEMPTS: 30 };

// --- Preferences (storage key + shape preserved for backward compatibility) ---
interface Prefs {
  autoRestoreEnabled: boolean;
  autoRestorePanel: string | null;
  autoRestoreTimeout: number;
}
const DEFAULT_PREFS: Prefs = {
  autoRestoreEnabled: false,
  autoRestorePanel: null,
  autoRestoreTimeout: 30,
};
const prefsStore = defineStore<Prefs>('persistent-sidebar-panel-prefs', DEFAULT_PREFS);

// --- Panel model ---
// `label` is the STORED value (autoRestorePanel) and must never change.
// `displayLabel` is the translated text shown in the dropdown.
interface Panel {
  label: string;
  displayLabel: () => string;
  activator: () => string;
  content: () => string;
}

// Friend Activity, Queue and NPV all render into one shared container whose
// aria-label names the active panel; match on that to tell them apart.
const panelAside = (label: string) => `aside#Desktop_PanelContainer_Id[aria-label="${label}"]`;

const PANELS: Record<string, Panel> = {
  FRIEND_ACTIVITY: {
    label: 'Friend Activity',
    displayLabel: () => labels.listeningActivity(),
    // :not(aside) so the open panel (which shares this aria-label) is not
    // mistaken for the toggle button.
    activator: () => `[aria-label="${labels.listeningActivity()}"]:not(aside)`,
    content: () => panelAside(labels.listeningActivity()),
  },
  QUEUE: {
    label: 'Queue',
    displayLabel: () => labels.queue(),
    activator: () => 'button[data-testid="control-button-queue"]',
    content: () => panelAside(labels.queue()),
  },
  CONNECT: {
    label: 'Connect to a device',
    displayLabel: () => labels.connect(),
    activator: () =>
      `button[data-testid="super-connect-button"], button[aria-label="${labels.connect()}"]`,
    content: () => {
      const l = labels.connect();
      return `aside[aria-label="${l}"], div[aria-label="${l}"][role="dialog"], div[aria-label="Devices Available"][role="dialog"]`;
    },
  },
  NPV: {
    label: 'Now Playing view',
    displayLabel: () => labels.nowPlayingView(),
    activator: () =>
      `button[data-testid="control-button-npv"], button[aria-label="${labels.nowPlayingView()}"]`,
    content: () => panelAside(labels.nowPlayingView()),
  },
};

function panelByLabel(label: string | null): Panel | undefined {
  if (!label) return undefined;
  return Object.values(PANELS).find((p) => p.label === label);
}

function isContentVisible(selector: string): boolean {
  const el = document.querySelector<HTMLElement>(selector);
  return !!el && el.offsetParent !== null && el.style.display !== 'none' && (el.clientHeight > 0 || el.clientWidth > 0);
}

// --- State ---
let autoRestoreTimer: ReturnType<typeof setTimeout> | null = null;
let isStartupPhase = true;
let activePanelObserver: MutationObserver | null = null;

function clearTimer(): void {
  if (autoRestoreTimer) {
    clearTimeout(autoRestoreTimer);
    autoRestoreTimer = null;
  }
}

function getActivePanelLabel(): string | null {
  // Each panel's content selector is now aria-label-specific, so a plain
  // visibility check unambiguously identifies the active panel.
  for (const panel of Object.values(PANELS)) {
    if (isContentVisible(panel.content())) return panel.label;
  }
  return null;
}

async function switchToPreferredPanel(targetLabel: string | null): Promise<void> {
  if (!targetLabel) {
    if (__SPICETIFY_EXTENSIONS_DEBUG__) log.warn('[PSP Switch] No target panel. Bailing.');
    return;
  }
  const target = panelByLabel(targetLabel);
  if (!target) {
    if (__SPICETIFY_EXTENSIONS_DEBUG__)
      if (__SPICETIFY_EXTENSIONS_DEBUG__)
        log.error(`[PSP Switch] Unknown target panel: '${targetLabel}'. Bailing.`);
    return;
  }

  let active = getActivePanelLabel();
  if (__SPICETIFY_EXTENSIONS_DEBUG__)
    if (__SPICETIFY_EXTENSIONS_DEBUG__)
      log.log(`[PSP Switch] Active: '${active}', Target: '${targetLabel}'`);
  if (active === targetLabel) return;

  // Close the current (non-target) panel.
  if (active && active !== targetLabel) {
    const current = panelByLabel(active);
    if (current) {
      const btn = (await waitForElement(current.activator(), 1000)) as HTMLElement | null;
      if (btn) {
        if (__SPICETIFY_EXTENSIONS_DEBUG__) log.log(`[PSP Switch] Closing '${active}'.`);
        btn.click();
        await sleep(250);
      }
    }
  }

  active = getActivePanelLabel();
  if (active === targetLabel) return;
  if (isContentVisible(target.content())) {
    if (__SPICETIFY_EXTENSIONS_DEBUG__)
      if (__SPICETIFY_EXTENSIONS_DEBUG__)
        log.log(`[PSP Switch] '${targetLabel}' content already visible. Skipping open.`);
    return;
  }

  const opener = (await waitForElement(target.activator(), 2000)) as HTMLElement | null;
  if (!opener) {
    if (__SPICETIFY_EXTENSIONS_DEBUG__)
      if (__SPICETIFY_EXTENSIONS_DEBUG__)
        log.error(`[PSP Switch] Could not find activator for '${targetLabel}'.`);
    return;
  }
  if (__SPICETIFY_EXTENSIONS_DEBUG__) log.log(`[PSP Switch] Opening '${targetLabel}'.`);
  opener.click();
  await sleep(100);

  // Note: no NPV cleanup needed — the panels share one container, so opening
  // the target replaces whatever was there. (The NPV activator is now the
  // album-art toggle; clicking it here would re-open NPV and evict the target.)
  if (__SPICETIFY_EXTENSIONS_DEBUG__)
    if (__SPICETIFY_EXTENSIONS_DEBUG__)
      log.log(`[PSP Switch] Done. Final panel: '${getActivePanelLabel()}'`);
}

// --- Auto-restore scheduling ---
function handleSidebarPanelChange(): void {
  clearTimer();
  const prefs = prefsStore.load();
  if (!prefs.autoRestoreEnabled || !prefs.autoRestorePanel) return;
  if (isStartupPhase) {
    if (__SPICETIFY_EXTENSIONS_DEBUG__) log.log('Skipping auto-restore during startup phase.');
    return;
  }

  const active = getActivePanelLabel();
  const fire = () => {
    if (getActivePanelLabel() !== prefs.autoRestorePanel) {
      if (__SPICETIFY_EXTENSIONS_DEBUG__)
        if (__SPICETIFY_EXTENSIONS_DEBUG__)
          log.log(`Timer fired. Switching to preferred panel '${prefs.autoRestorePanel}'.`);
      void switchToPreferredPanel(prefs.autoRestorePanel);
    }
  };

  const sidebarOpen = !!document.querySelector(layoutSelectors.rightSidebar);
  if ((active && active !== prefs.autoRestorePanel) || (!active && sidebarOpen)) {
    autoRestoreTimer = setTimeout(fire, prefs.autoRestoreTimeout * 1000);
  }
}

function handleSettingsChange(prefs: Prefs): void {
  clearTimer();
  if (prefs.autoRestoreEnabled && prefs.autoRestorePanel) handleSidebarPanelChange();
}

function observeSidebarChanges(): void {
  activePanelObserver?.disconnect();
  const mainView = document.querySelector(layoutSelectors.mainView);
  const rightSidebar = document.querySelector(layoutSelectors.rightSidebar);
  if (!mainView || !rightSidebar) {
    setTimeout(observeSidebarChanges, RETRY.DELAY * 3);
    return;
  }
  activePanelObserver = observe(rightSidebar, () => handleSidebarPanelChange(), {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'hidden', 'aria-selected'],
  });
  const mainContent = mainView.querySelector('.main-view-container > .os-content');
  if (mainContent) {
    observe(mainContent, () => handleSidebarPanelChange(), { childList: true, subtree: true });
  }
  handleSidebarPanelChange();
}

// --- Native profile menu ---
const PROFILE_SECTION_ID = 'pinned-sidebar-panel-profile-section';

function injectProfileSection(menu: Element): void {
  const prefs = prefsStore.load();
  const panelList = Object.values(PANELS);
  const existing = menu.querySelector<HTMLElement>(`#${PROFILE_SECTION_ID}`);
  if (existing) {
    updateProfileSection(existing, prefs);
    return;
  }

  const section = document.createElement('div');
  section.id = PROFILE_SECTION_ID;
  section.style.cssText =
    'padding:8px 0;border-top:1px solid var(--essential-subdued,rgba(255,255,255,0.1));border-bottom:1px solid var(--essential-subdued,rgba(255,255,255,0.1));margin:8px 0;';

  const heading = document.createElement('div');
  heading.textContent = 'Pinned Sidebar Panel';
  heading.style.cssText = 'padding:0 12px 4px;border-bottom:1px solid var(--essential-subdued,rgba(255,255,255,0.1));margin-bottom:4px;';
  section.appendChild(heading);

  const enabledRow = document.createElement('div');
  enabledRow.dataset.kind = 'enabled';
  enabledRow.style.cssText = 'display:flex;align-items:center;padding:8px 12px;cursor:pointer;justify-content:space-between;';
  enabledRow.innerHTML = `<span>Enabled</span><span class="pinned-sidebar-panel-toggle" style="width:40px;height:20px;display:flex;align-items:center;justify-content:center;"></span>`;
  enabledRow.addEventListener('click', () => {
    const current = prefsStore.load();
    current.autoRestoreEnabled = !current.autoRestoreEnabled;
    prefsStore.save(current);
    if (current.autoRestoreEnabled && current.autoRestorePanel) {
      clearTimer();
      void switchToPreferredPanel(current.autoRestorePanel);
    }
    handleSettingsChange(current);
    updateProfileSection(section, current);
  });
  section.appendChild(enabledRow);

  const panelRow = document.createElement('label');
  panelRow.dataset.kind = 'panel';
  panelRow.style.cssText = 'display:flex;align-items:center;padding:8px 12px;justify-content:space-between;gap:12px;';
  panelRow.innerHTML = '<span>Panel</span><select style="min-width:150px;background:#282828;color:white;border:1px solid #666;border-radius:4px;padding:4px;"></select>';
  const panelSelect = panelRow.querySelector('select') as HTMLSelectElement;
  panelList.forEach((panel) => panelSelect.add(new Option(panel.displayLabel(), panel.label)));
  panelSelect.addEventListener('change', () => {
    const current = prefsStore.load();
    current.autoRestorePanel = panelSelect.value;
    prefsStore.save(current);
    if (current.autoRestoreEnabled) {
      clearTimer();
      void switchToPreferredPanel(current.autoRestorePanel);
    }
    handleSettingsChange(current);
  });
  section.appendChild(panelRow);

  const timeoutRow = document.createElement('label');
  timeoutRow.dataset.kind = 'timeout';
  timeoutRow.style.cssText = 'display:flex;align-items:center;padding:8px 12px;justify-content:space-between;gap:12px;';
  timeoutRow.innerHTML = '<span>Restore after (s)</span><input type="number" min="15" step="15" style="width:64px;background:#282828;color:white;border:1px solid #666;border-radius:4px;padding:4px;">';
  const timeoutInput = timeoutRow.querySelector('input') as HTMLInputElement;
  timeoutInput.addEventListener('change', () => {
    const current = prefsStore.load();
    current.autoRestoreTimeout = Math.max(15, Number(timeoutInput.value) || 15);
    timeoutInput.value = String(current.autoRestoreTimeout);
    prefsStore.save(current);
    handleSettingsChange(current);
  });
  section.appendChild(timeoutRow);

  const settings = menu.querySelector('a[href*="preferences"]')?.closest('li');
  menu.insertBefore(section, settings ?? null);
  updateProfileSection(section, prefs);
}

function updateProfileSection(section: HTMLElement, prefs: Prefs): void {
  const enabledRow = section.querySelector<HTMLElement>('[data-kind="enabled"]');
  const toggle = enabledRow?.querySelector<HTMLElement>('.pinned-sidebar-panel-toggle');
  if (toggle) toggle.innerHTML = toggleSwitch(prefs.autoRestoreEnabled);
  const panelSelect = section.querySelector<HTMLSelectElement>('[data-kind="panel"] select');
  if (panelSelect) {
    panelSelect.value = prefs.autoRestorePanel ?? '';
    panelSelect.disabled = !prefs.autoRestoreEnabled;
  }
  const timeoutInput = section.querySelector<HTMLInputElement>('[data-kind="timeout"] input');
  if (timeoutInput) {
    timeoutInput.value = String(prefs.autoRestoreTimeout);
    timeoutInput.disabled = !prefs.autoRestoreEnabled;
  }
}

// --- Startup ---
async function waitForSidebarReady(timeoutMs = 10000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const rightSidebar = document.querySelector('.Root__right-sidebar, [class*="right-sidebar"]');
    const hasActivator =
      document.querySelector(PANELS.FRIEND_ACTIVITY.activator()) ||
      document.querySelector(PANELS.QUEUE.activator()) ||
      document.querySelector(PANELS.CONNECT.activator());
    if (rightSidebar && hasActivator) return true;
    await sleep(200);
  }
  return false;
}

async function main(): Promise<void> {
  if (__SPICETIFY_EXTENSIONS_DEBUG__) log.log('Initializing...');
  await whenReady({ api: 'History', react: true });
  await sleep(1000); // let Spotify's sidebar settle

  observeProfileMenu(injectProfileSection);
  observeSidebarChanges();

  const prefs = prefsStore.load();
  if (prefs.autoRestoreEnabled && prefs.autoRestorePanel) {
    if (await waitForSidebarReady()) {
      if (getActivePanelLabel() !== prefs.autoRestorePanel) {
        clearTimer();
        for (let attempt = 1; attempt <= 3; attempt++) {
          await switchToPreferredPanel(prefs.autoRestorePanel);
          await sleep(500);
          if (getActivePanelLabel() === prefs.autoRestorePanel) break;
          await sleep(1000);
        }
        setTimeout(() => handleSidebarPanelChange(), 250);
      }
    } else {
      if (__SPICETIFY_EXTENSIONS_DEBUG__)
        if (__SPICETIFY_EXTENSIONS_DEBUG__)
          log.warn('Sidebar not ready; skipping startup switch.');
    }
  }

  setTimeout(() => {
    isStartupPhase = false;
    if (__SPICETIFY_EXTENSIONS_DEBUG__) log.log('Startup phase complete.');
  }, 2000);

  if (__SPICETIFY_EXTENSIONS_DEBUG__) log.log('Initialized.');
}

main().catch((err) => {
  if (__SPICETIFY_EXTENSIONS_DEBUG__) log.error('init failed', err);
});
