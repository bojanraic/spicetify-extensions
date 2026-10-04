import {
  whenReady,
  createLogger,
  defineStore,
  panelSelectors,
  layoutSelectors,
  hideNowPlayingCss,
  collapseRightSidebarCss,
  injectStyle,
  observeProfileMenu,
  toggleSwitch,
} from '@spicetify-ext/core';
import { menuEntries } from './menu-entries';

const log = createLogger('SidebarCustomizer');

const STYLE_TAG_ID = 'sidebar-customizer-styles';
const HIDDEN_NPV_CLASS = 'sidebar-customizer-hidden-npv';

// Playbar / NPV selectors specific to this extension (not shared with side-hide).
const EXPAND_BUTTON = '.main-coverSlotCollapsed-expandButton';
const COVER_ART_CONTAINER = '[data-testid="CoverSlotCollapsed__container"]';
const NPV_HIDE_BTN = 'button.main-nowPlayingView-headerCloseButton';
const NPV_CLOSE_BTN = "div[data-testid='PanelHeader_CloseButton'] > button";
const PROFILE_SECTION_ID = 'sidebar-customizer-profile-section';

// --- Preferences ---
// Storage key and pref names are preserved for backward compatibility. Note
// `friendActivity` is a legacy key; it is displayed as "Listening Activity".
interface Prefs {
  friendActivity: boolean;
  whatsNew: boolean;
  queue: boolean;
  connect: boolean;
  nowPlaying: boolean;
  albumArtHandler: boolean;
}

const DEFAULT_PREFS: Prefs = {
  friendActivity: false,
  whatsNew: false,
  queue: false,
  connect: false,
  nowPlaying: false,
  albumArtHandler: false,
};

const prefsStore = defineStore<Prefs>('sidebar-customizer-prefs', DEFAULT_PREFS);

function sidebarPanelsHidden(p: Prefs): boolean {
  // Friend Activity and What's New are topbar controls. They do not occupy
  // the right sidebar and must not affect its collapsed layout state.
  return !p.nowPlaying && !p.queue && !p.connect;
}

// --- Styles ---
function buildCss(prefs: Prefs): string {
  const parts: string[] = [
    `.${HIDDEN_NPV_CLASS} { visibility: hidden !important; width: 0 !important; min-width: 0 !important; display: none !important; }`,
  ];

  if (!prefs.nowPlaying) {
    parts.push(hideNowPlayingCss());
    parts.push(`${EXPAND_BUTTON} { display: none !important; }`);
  } else {
    parts.push(
      `${EXPAND_BUTTON} { display: flex !important; visibility: visible !important; opacity: 1 !important; cursor: pointer !important; }`,
    );
  }

  // Album art click affordance (clicks blocked by a capture listener below).
  parts.push(
    `${panelSelectors.coverArtButton} { cursor: ${prefs.albumArtHandler ? 'pointer' : 'default'} !important; }`,
  );

  if (!prefs.friendActivity)
    parts.push(`${panelSelectors.listeningActivityButton()} { display: none !important; }`);
  if (!prefs.whatsNew) parts.push(`${panelSelectors.whatsNewButton()} { display: none !important; }`);
  if (!prefs.queue) parts.push(`${panelSelectors.queueButton()} { display: none !important; }`);
  if (!prefs.connect) parts.push(`${panelSelectors.connectButton()} { display: none !important; }`);

  if (sidebarPanelsHidden(prefs)) {
    parts.push(collapseRightSidebarCss());
  } else {
    parts.push(`${layoutSelectors.mainView} { margin-right: 0 !important; }`);
    parts.push(
      `${layoutSelectors.rightSidebar}, ${layoutSelectors.rightSidebar} > * { padding: 0 !important; margin: 0 !important; }`,
    );
  }

  return parts.join('\n');
}

function applyStyles(prefs: Prefs): void {
  injectStyle(STYLE_TAG_ID, buildCss(prefs));

  // If the sidebar was force-collapsed inline and should now show, clear it.
  const rightSidebar = document.querySelector<HTMLElement>(layoutSelectors.rightSidebar);
  if (rightSidebar && rightSidebar.style.display === 'none' && !sidebarPanelsHidden(prefs)) {
    rightSidebar.style.display = '';
    rightSidebar.style.visibility = '';
    rightSidebar.style.width = '';
    rightSidebar.style.minWidth = '';
    rightSidebar.style.maxWidth = '';
  }
}

// --- Preference application (imperative NPV open/close on top of CSS) ---
function applyPreferences(prefs: Prefs = prefsStore.load(), userInitiated = false): void {
  applyStyles(prefs);

  const aside = document.querySelector<HTMLElement>(panelSelectors.nowPlayingAside());
  if (aside) {
    if (!prefs.nowPlaying) {
      const closeBtn =
        aside.querySelector<HTMLElement>(NPV_HIDE_BTN) ?? aside.querySelector<HTMLElement>(NPV_CLOSE_BTN);
      closeBtn?.click();
      aside.classList.add(HIDDEN_NPV_CLASS);
    } else {
      aside.classList.remove(HIDDEN_NPV_CLASS);
    }
  }

  scheduleOpenNpv(userInitiated);
}

// Spotify keeps the NPV <aside> mounted while the panel is closed, so its
// presence says nothing about open/closed. The collapsed strip's expander is
// visible only while the NPV is closed.
function npvExpander(): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(panelSelectors.nowPlayingExpandButton());
  return el && el.getBoundingClientRect().width > 0 ? el : null;
}

// Open the NPV when enabled. Startup and play/pause only open it while playing;
// an explicit toggle in the menu opens it regardless. State is re-read when the
// timer fires so a toggle in between can't leave a stale click behind, and a
// single pending timer keeps rapid toggling from clicking more than once.
let openNpvTimer: ReturnType<typeof setTimeout> | undefined;
let openNpvForced = false;

// Player.data is not populated on every Spicetify build; isPlaying() is.
function isPlaying(): boolean {
  return Spicetify?.Player?.isPlaying?.() ?? Spicetify?.Player?.data?.isPaused === false;
}

function scheduleOpenNpv(userInitiated = false): void {
  clearTimeout(openNpvTimer);
  openNpvForced ||= userInitiated;
  openNpvTimer = setTimeout(() => {
    const forced = openNpvForced;
    openNpvForced = false;
    if (!prefsStore.load().nowPlaying || (!forced && !isPlaying())) return;

    const expander = npvExpander();
    if (expander) {
      expander.click();
      return;
    }

    // Layouts without the collapsed-strip expander: fall back to the playbar toggle.
    const button =
      document.querySelector<HTMLElement>(panelSelectors.nowPlayingButton) ??
      document.querySelector<HTMLElement>(panelSelectors.nowPlayingButtonByLabel());
    const open = document.querySelector(panelSelectors.nowPlayingAside());
    if (button && !open && button.style.display !== 'none') button.click();
  }, 200);
}

// --- Profile submenu ---
function createProfileToggle(entry: ReturnType<typeof menuEntries>[number], prefs: Prefs): HTMLElement {
  const row = document.createElement('div');
  row.dataset.pref = entry.pref;
  row.setAttribute('role', 'menuitemcheckbox');
  row.setAttribute('aria-checked', String(prefs[entry.pref]));
  row.style.cssText =
    'display:flex;align-items:center;padding:8px 12px;cursor:pointer;justify-content:space-between;';

  const label = document.createElement('span');
  label.textContent = entry.name;
  const checkbox = document.createElement('span');
  checkbox.className = 'sidebar-customizer-toggle';
  checkbox.style.cssText = 'width:40px;height:20px;display:flex;align-items:center;justify-content:center;';
  checkbox.innerHTML = toggleSwitch(prefs[entry.pref]);
  row.append(label, checkbox);

  row.addEventListener('mouseenter', () => (row.style.backgroundColor = 'rgba(255,255,255,0.1)'));
  row.addEventListener('mouseleave', () => (row.style.backgroundColor = 'transparent'));
  row.addEventListener('click', () => {
    const current = prefsStore.load();
    current[entry.pref] = !current[entry.pref];
    prefsStore.save(current);
    applyPreferences(current, true);
    checkbox.innerHTML = toggleSwitch(current[entry.pref]);
    row.setAttribute('aria-checked', String(current[entry.pref]));
  });
  return row;
}

function injectProfileSection(menu: Element): void {
  const prefs = prefsStore.load();
  const existing = menu.querySelector<HTMLElement>(`#${PROFILE_SECTION_ID}`);
  if (existing) {
    existing.querySelectorAll<HTMLElement>('[data-pref]').forEach((row) => {
      const pref = row.dataset.pref as keyof Prefs;
      const checkbox = row.querySelector<HTMLElement>('.sidebar-customizer-toggle');
      if (!checkbox || !(pref in prefs)) return;
      checkbox.innerHTML = toggleSwitch(prefs[pref]);
      row.setAttribute('aria-checked', String(prefs[pref]));
    });
    return;
  }

  const section = document.createElement('div');
  section.id = PROFILE_SECTION_ID;
  section.style.cssText =
    'padding:8px 0;border-top:1px solid var(--essential-subdued,rgba(255,255,255,0.1));border-bottom:1px solid var(--essential-subdued,rgba(255,255,255,0.1));margin:8px 0;';

  const heading = document.createElement('div');
  heading.textContent = 'Sidebar Customizer';
  heading.style.cssText =
    'padding:0 12px 4px;font-weight:bold;border-bottom:1px solid var(--essential-subdued,rgba(255,255,255,0.1));margin-bottom:4px;';
  section.appendChild(heading);
  menuEntries().forEach((entry) => section.appendChild(createProfileToggle(entry, prefs)));

  const settings = menu.querySelector('a[href*="preferences"]')?.closest('li');
  menu.insertBefore(section, settings ?? null);
}

// --- Listeners ---
function setupListeners(): void {
  // Block album art clicks unless the handler pref is on.
  document.addEventListener(
    'click',
    (event) => {
      if (prefsStore.load().albumArtHandler) return;
      const target = (event.target as Element | null)?.closest?.(
        `${panelSelectors.coverArtButton}, ${COVER_ART_CONTAINER}`,
      );
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  // Re-open NPV on play when enabled.
  Spicetify?.Player?.addEventListener?.('onplaypause', () => scheduleOpenNpv());
}

// --- Init ---
async function main(): Promise<void> {
  await whenReady({ api: 'History', react: true });

  applyPreferences();
  observeProfileMenu(injectProfileSection);
  setupListeners();

  // Re-apply after Spotify's React finishes rendering the playbar buttons.
  setTimeout(() => applyStyles(prefsStore.load()), 1500);

  if (__SPICETIFY_EXTENSIONS_DEBUG__) log.log('initialized', prefsStore.load());
}

main().catch((err) => {
  if (__SPICETIFY_EXTENSIONS_DEBUG__) log.error('init failed', err);
});
