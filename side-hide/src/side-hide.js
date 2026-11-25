(() => {
  const RETRY_LIMIT = 30;
  const RETRY_DELAY_MS = 300;
  const COVER_ART_BUTTON = '[data-testid="cover-art-button"]';
  const ALBUM_ART_SELECTOR = `${COVER_ART_BUTTON}, [data-testid="CoverSlotCollapsed__container"]`;

  function initialize(translations) {
    const nowPlayingLabel = translations?.['web-player.now-playing-view.label'] ?? 'Now playing view';
    const hideLabel = translations?.['web-player.now-playing-view.hide'] ?? 'Hide Now Playing view';
    const friendsLabel = translations?.['buddy-feed.listening-activity'] ?? 'Listening activity';
    const queueLabel = translations?.['playback-control.queue'] ?? 'Queue';
    const connectLabel = translations?.['playback-control.connect-picker'] ?? 'Connect to a device';
    const showLabel = translations?.['web-player.cinema-mode.peek.show.now-playing-view'] ?? 'Show Now Playing view';
    const panelSelector = `aside#Desktop_PanelContainer_Id, aside[aria-label="${CSS.escape(nowPlayingLabel)}"]`;
    const closeSelector = `button[aria-label="${CSS.escape(hideLabel)}"],
      div[data-testid="PanelHeader_CloseButton"] > button,
      button.main-nowPlayingView-headerCloseButton`;

    const style = document.createElement('style');
    style.textContent = `
      [aria-label="${CSS.escape(friendsLabel)}"],
      button[data-testid="control-button-npv"],
      button[data-testid="control-button-queue"],
      button[aria-label="${CSS.escape(queueLabel)}"],
      button[data-testid="super-connect-button"],
      button[aria-label="${CSS.escape(connectLabel)}"],
      button[aria-label="${CSS.escape(showLabel)}"],
      :has(> * > aside#Desktop_PanelContainer_Id),
      .Root__right-sidebar-peekContent {
        display: none !important;
      }
      ${COVER_ART_BUTTON} {
        cursor: default !important;
      }
    `;
    document.head.append(style);

    // Intercept the click before Spotify can expand the Now Playing panel.
    document.addEventListener('click', event => {
      if (!event.target?.closest?.(ALBUM_ART_SELECTOR)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    let currentPanel;
    let closeAttempted = false;

    function hideNowPlaying() {
      const panel = document.querySelector(panelSelector);
      if (panel !== currentPanel) {
        currentPanel = panel;
        closeAttempted = false;
      }
      if (!panel) return;

      const closeButton = !closeAttempted && panel.querySelector(closeSelector);
      if (closeButton) {
        closeAttempted = true;
        closeButton.click();
      }

      if (panel.style.display !== 'none' || panel.style.getPropertyPriority('display') !== 'important') {
        panel.style.setProperty('display', 'none', 'important');
      }
    }

    const observer = new MutationObserver(hideNowPlaying);
    // Ignore inline style writes, including Side Hide's own fallback.
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label'],
    });
    hideNowPlaying();
  }

  function start(attempt = 0) {
    const platform = globalThis.Spicetify?.Platform;

    if (document.body && (platform || attempt === RETRY_LIMIT)) {
      initialize(platform?.Translations);
    } else if (attempt < RETRY_LIMIT) {
      setTimeout(() => start(attempt + 1), RETRY_DELAY_MS);
    }
  }

  start();
})();
