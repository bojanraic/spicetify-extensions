import { t } from './i18n';

/** Candidate selectors for the account/profile context-menu container. */
export const PROFILE_MENU_SELECTOR = "ul.main-contextMenu-menu, [role='menu'], ul[role='menu']";

/**
 * Locale-aware UI labels, resolved lazily at call time (Translations must be
 * loaded first). Single source of truth so extensions stop re-deriving keys.
 *
 * Note: topbar buttons have bundler-compressed `data-testid` values, so match
 * them by `[aria-label="<label()>"]` rather than testid.
 */
export const labels = {
  privateSession: () => t('user.private-session', 'Private session'),
  listeningActivity: () => t('buddy-feed.listening-activity', 'Listening activity'),
  whatsNew: () => t('web-player.whats-new-feed.button-label', "What's New"),
  queue: () => t('playback-control.queue', 'Queue'),
  connect: () => t('playback-control.connect-picker', 'Connect to a device'),
  nowPlayingView: () => t('web-player.now-playing-view.label', 'Now playing view'),
  nowPlayingHide: () => t('web-player.now-playing-view.hide', 'Hide Now Playing view'),
};

/**
 * Element selectors for the right-sidebar panels and their toggle buttons.
 * Shared so side-hide and sidebar-customizer emit identical, correct rules.
 * Button labels use aria-label because topbar data-testids are compressed.
 */
export const panelSelectors = {
  listeningActivityButton: () =>
    `[data-testid="friend-activity-button"], [aria-label="${labels.listeningActivity()}"]`,
  whatsNewButton: () =>
    `[data-testid="whats-new-button"], [aria-label="${labels.whatsNew()}"]`,
  queueButton: () =>
    `button[data-testid="control-button-queue"], button[aria-label="${labels.queue()}"]`,
  connectButton: () =>
    `button[data-testid="super-connect-button"], button[aria-label="${labels.connect()}"]`,
  // data-testid from dwp-now-playing-bar.js is stable (not compressed).
  nowPlayingButton: 'button[data-testid="control-button-npv"]',
  nowPlayingButtonByLabel: () => `button[aria-label="${labels.nowPlayingView()}"]`,
  nowPlayingRestoreFocus: 'button[data-restore-focus-key="now_playing_view"]',
  nowPlayingAside: () => `aside[aria-label="${labels.nowPlayingView()}"]`,
  // Exclusion guards: the playbar mini-widget and cover-art button share
  // labels/ancestry with the NPV panel and must NOT be caught by hide rules.
  nowPlayingWidget: '[data-testid="now-playing-widget"]',
  coverArtButton: '[data-testid="cover-art-button"]',
};

/** Layout containers for collapsing the right sidebar and reclaiming space. */
export const layoutSelectors = {
  rightSidebar: '.Root__right-sidebar',
  mainView: '.Root__main-view',
};

/**
 * CSS that hides the Now Playing view panel and its open buttons while
 * preserving the playbar now-playing widget and cover-art button.
 */
export function hideNowPlayingCss(): string {
  const p = panelSelectors;
  return [
    `${p.nowPlayingAside()}:not(${p.nowPlayingWidget}),`,
    `.main-nowPlayingView-container:has(${p.nowPlayingAside()}),`,
    `.Root__right-sidebar-peekContent:has(${p.nowPlayingAside()}) { display: none !important; width: 0 !important; min-width: 0 !important; }`,
    `${p.nowPlayingButton}:not(${p.coverArtButton}),`,
    `${p.nowPlayingButtonByLabel()}:not(${p.coverArtButton}),`,
    `${p.nowPlayingRestoreFocus}:not(${p.coverArtButton}) { display: none !important; }`,
  ].join('\n');
}

/**
 * CSS hiding every right-sidebar toggle button (Listening Activity, What's New,
 * Queue, Connect, Now Playing), preserving the playbar cover-art button.
 */
export function hideAllSidebarButtonsCss(): string {
  const p = panelSelectors;
  return [
    `${p.listeningActivityButton()} { display: none !important; }`,
    `${p.whatsNewButton()} { display: none !important; }`,
    `${p.queueButton()} { display: none !important; }`,
    `${p.connectButton()} { display: none !important; }`,
    `${p.nowPlayingButton}:not(${p.coverArtButton}),`,
    `${p.nowPlayingButtonByLabel()}:not(${p.coverArtButton}),`,
    `${p.nowPlayingRestoreFocus}:not(${p.coverArtButton}) { display: none !important; }`,
  ].join('\n');
}

/**
 * CSS that collapses the entire right sidebar (hiding every open panel at once)
 * and removes the main view's reserved right margin. The playbar now-playing
 * widget is unaffected — it lives in the bottom bar, not the sidebar.
 */
export function collapseRightSidebarCss(): string {
  const l = layoutSelectors;
  return [
    `${l.rightSidebar} { width: 0 !important; min-width: 0 !important; max-width: 0 !important; overflow: hidden !important; visibility: hidden !important; display: none !important; }`,
    `${l.mainView} { margin-right: 0 !important; }`,
  ].join('\n');
}
