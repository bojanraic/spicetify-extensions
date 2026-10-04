import {
  whenReady,
  createLogger,
  injectStyle,
  hideAllSidebarButtonsCss,
  collapseRightSidebarCss,
} from '@spicetify-ext/core';

// Spotify exposes no native API for these panels (no PanelAPI, no
// Spicetify.Panel; BuddyFeedAPI is data-only), so hiding is done with CSS:
// rules apply the instant elements appear and survive re-renders — no
// MutationObserver / click-to-close / polling needed.
//
// Scope: hide every right-sidebar toggle button (Listening Activity, What's New,
// Queue, Connect, Now Playing) AND collapse the whole right sidebar, which
// hides any open panel at once. The playbar now-playing widget stays visible.
// Selectors and rule builders live in core, shared with sidebar-customizer.

const log = createLogger('SideHide');
const STYLE_ID = 'side-hide-styles';

function buildCss(): string {
  return [hideAllSidebarButtonsCss(), collapseRightSidebarCss()].join('\n');
}

async function main(): Promise<void> {
  await whenReady({ api: 'FeedbackAPI' });
  injectStyle(STYLE_ID, buildCss());
  if (__SPICETIFY_EXTENSIONS_DEBUG__) log.log('styles injected');
}

main().catch((err) => {
  if (__SPICETIFY_EXTENSIONS_DEBUG__) log.error('init failed', err);
});
