// YT-Video Spicetify Extension
// Opens YouTube videos for Spotify songs without cookies or tracking.
// A YouTube Data API key is required (anonymous search calls are no longer
// permitted by YouTube), so the key is mandatory — not an optional toggle.
import { whenReady, createLogger } from '@spicetify-ext/core';
import { resolveContextMenuTrackInfo } from './context-menu';

const log = createLogger('YT-Video');

// ── UI text ──
const YTV_BUTTON_TOOLTIP = 'Watch on YouTube';
const YTV_CONTEXT_MENU_ITEM = 'Play video';

// ── CSS / DOM ──
const YTV_BUTTON_CLASS = 'ytv-button';
const YTV_BUTTON_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>`;
const YTV_CONTEXT_MENU_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="#FF0000" style="margin-right: 4px; vertical-align: -3px;"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>`;

// ── Config ──
const YTV_RETRY_LIMIT = 5;
const YTV_DELAY_MS = 120;
const YTV_NOCOOKIE_DOMAIN = 'www.youtube-nocookie.com';
const YTV_BUTTON_COLOR = '#FF0000';
const YTV_SETTINGS_KEY = 'yt-video:settings';
const YTV_MUSIC_VIDEO_SEARCH_SUFFIX = 'music video';
const YTV_CACHE_KEY_PREFIX = 'yt-video:cache:';
const YTV_CACHE_DURATION_MS = 24 * 60 * 60 * 1000;
const YTV_SEARCH_CACHE_SIZE = 100;
const YTV_CONTEXT_MENU_GUARD_MS = 800;
const YTV_RATE_LIMIT_FALLBACK_SECONDS = 15;
const YTV_MAX_RETRY_AFTER_SECONDS = 60;
const YTV_NOTIFICATION_DURATION_MS = 3000;
const YTV_CONTEXT_LAST_TRACK_INFO_TTL_MS = 5000;

// ── Types ──
interface YtvSettings {
  apiKey: string;
  showThumbnails: boolean;
  autoplay: boolean;
}
const YTV_DEFAULT_SETTINGS: YtvSettings = { apiKey: '', showThumbnails: true, autoplay: true };

interface TrackInfo {
  name: string;
  artist: string;
  album: string;
}
interface YtVideoItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: { medium: { url: string } };
  };
}
interface YtSearchResponse {
  items?: YtVideoItem[];
  error?: { message?: string };
}
interface CachedItem<T> {
  value: T;
  timestamp: number;
}

declare global {
  interface Window {
    ytvCurrentState: { videoId: string; videoIndex: number; videoList: YtVideoItem[] } | null;
    ytvSearchResults?: YtVideoItem[];
    __ytvContextMenuRegistered?: boolean;
  }
}

// ── State ──
let ytvSettings: YtvSettings = { ...YTV_DEFAULT_SETTINGS };
const ytvRateLimitedUntilByUri = new Map<string, number>();
let ytvLastContextMenuActionAt = 0;
let ytvLastContextTrackInfo: { timestamp: number; trackInfo: TrackInfo } | null = null;

// Assigned inside openYouTubeVideoForTrack (closures over the search input).
let performSearch: () => void = () => {};
let showApiResults: (query: string) => Promise<void> = async () => {};

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const hasApiKey = (): boolean => ytvSettings.apiKey.trim().length > 0;

function showYtvNotification(message: string, durationMs = YTV_NOTIFICATION_DURATION_MS): void {
  const showNotification = (Spicetify as typeof Spicetify & {
    showNotification?: (text: string, isError?: boolean, timeoutMs?: number) => void;
  }).showNotification;
  if (typeof showNotification === 'function') {
    showNotification(message, false, durationMs);
    return;
  }

  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText =
    'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:10000;padding:12px 18px;border-radius:4px;background:#282828;color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.4);font-size:14px;pointer-events:none;';
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), durationMs);
}

function popupContent(html: string): HTMLElement {
  const content = document.createElement('div');
  content.innerHTML = html;
  return content;
}

// ── Track-info extraction (for the right-click context menu) ──
function extractTrackInfoFromRow(element: Element | null): TrackInfo | null {
  const row = element?.closest?.('[role="row"], [role="listitem"], [data-testid="tracklist-row"]');
  if (!row) return null;
  const name = row.querySelector('.main-trackInfo-name')?.textContent?.trim();
  const artist = row.querySelector('.main-trackInfo-artists')?.textContent?.trim();
  if (name && artist) return { name, artist, album: '' };
  return null;
}

function extractTrackInfoFromPlayButtonAria(scope: Element | null): TrackInfo | null {
  if (!(scope instanceof Element)) return null;
  const rowInfo = extractTrackInfoFromRow(scope);
  if (rowInfo) return rowInfo;
  const button = scope.matches?.('.main-trackList-rowImagePlayButton')
    ? scope
    : scope.querySelector('.main-trackList-rowImagePlayButton');
  const label = button?.getAttribute('aria-label') || '';
  if (!label.includes(' by ')) return null;
  const afterPlay = label.replace(/^[^"]*?\s/, '');
  const splitAt = afterPlay.lastIndexOf(' by ');
  if (splitAt <= 0) return null;
  return { name: afterPlay.slice(0, splitAt).trim(), artist: afterPlay.slice(splitAt + 4).trim(), album: '' };
}

function extractTrackInfoFromAriaLabel(target: Element | null): TrackInfo | null {
  if (!(target instanceof Element)) return null;
  const rowInfo = extractTrackInfoFromRow(target);
  if (rowInfo) return rowInfo;
  const playInfo = extractTrackInfoFromPlayButtonAria(target.closest('[role="row"]') || target);
  if (playInfo) return playInfo;
  const labelled = target.closest('[aria-label]');
  const label = labelled?.getAttribute('aria-label') || '';
  if (!label.includes(' by ')) return null;
  const afterVerb = label.replace(/^[^"]*?\s/, '');
  const splitAt2 = afterVerb.lastIndexOf(' by ');
  if (splitAt2 <= 0) return null;
  return { name: afterVerb.slice(0, splitAt2).trim(), artist: afterVerb.slice(splitAt2 + 4).trim(), album: '' };
}

function captureContextMenuTrackInfo(event: Event): void {
  try {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const trackInfo = extractTrackInfoFromAriaLabel(target);
    if (!trackInfo) return;
    ytvLastContextTrackInfo = { timestamp: Date.now(), trackInfo };
  } catch (error) {
    if (__SPICETIFY_EXTENSIONS_DEBUG__)
      log.log('failed to capture contextmenu track info:', errMsg(error));
  }
}

function getRecentLastContextTrackInfo(): TrackInfo | null {
  if (!ytvLastContextTrackInfo) return null;
  if (Date.now() - ytvLastContextTrackInfo.timestamp > YTV_CONTEXT_LAST_TRACK_INFO_TTL_MS) {
    ytvLastContextTrackInfo = null;
    return null;
  }
  return ytvLastContextTrackInfo.trackInfo;
}

// ── Video player ──
const showVideoPlayer = (videoId: string, videoIndex = 0, videoList: YtVideoItem[] = []): void => {
  if (Spicetify.Player && Spicetify.Player.isPlaying()) Spicetify.Player.pause();

  window.ytvCurrentState = { videoId, videoIndex, videoList };

  const searchBar = document.getElementById('ytv-search-bar');
  if (searchBar) searchBar.style.display = 'none';
  const modalHeader = document.querySelector<HTMLElement>('.main-trackCreditsModal-header');
  if (modalHeader) modalHeader.style.display = 'none';

  const contentContainer = document.getElementById('ytv-content');
  if (!contentContainer) return;
  contentContainer.style.height = '100%';

  const modalContainer = document.querySelector<HTMLElement>('.GenericModal');
  if (modalContainer) {
    modalContainer.style.padding = '0';
    modalContainer.style.margin = '0';
    const contentSection = modalContainer.querySelector<HTMLElement>('.main-trackCreditsModal-mainSection');
    if (contentSection) {
      contentSection.style.height = '100%';
      contentSection.style.maxHeight = '100%';
      contentSection.style.overflow = 'hidden';
      contentSection.style.padding = '0';
      contentSection.style.margin = '0';
    }
    const innerContainer = modalContainer.querySelector<HTMLElement>('.main-embedWidgetGenerator-container');
    if (innerContainer) {
      innerContainer.style.padding = '0';
      innerContainer.style.margin = '0';
    }
    const creditsContainer = modalContainer.querySelector<HTMLElement>('.main-trackCreditsModal-originalCredits');
    if (creditsContainer) {
      creditsContainer.style.padding = '0';
      creditsContainer.style.margin = '0';
    }
    const modalOverlay = document.querySelector<HTMLElement>('.GenericModal__overlay');
    if (modalOverlay) modalOverlay.style.padding = '0';
  }

  contentContainer.innerHTML = '';

  const playerContainer = document.createElement('div');
  playerContainer.id = 'ytv-player-container';
  playerContainer.style.cssText =
    'width:100%;height:100%;position:relative;overflow:hidden;padding:0;margin:0;background-color:#000';

  const iframe = document.createElement('iframe');
  iframe.id = 'ytv-player-iframe';
  iframe.style.cssText = 'width:100%;height:100%;border:none;padding:0;margin:0;display:block;position:absolute;top:0;left:0;right:0;bottom:0';
  iframe.loading = 'lazy';
  iframe.src = `https://${YTV_NOCOOKIE_DOMAIN}/embed/${videoId}?autoplay=${ytvSettings.autoplay ? '1' : '0'}&rel=0&controls=1&enablejsapi=1&iv_load_policy=3`;
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;

  const navButtonCss =
    'position:absolute;top:50%;transform:translateY(-50%);background-color:rgba(0,0,0,0.8);color:#fff;border:2px solid rgba(255,255,255,0.3);border-radius:50%;width:48px;height:48px;cursor:pointer;z-index:1000;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.5);transition:all 0.2s ease';

  const backButton = document.createElement('button');
  backButton.id = 'ytv-back-button';
  backButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12l-4.58 4.59z"/></svg>`;
  backButton.style.cssText = navButtonCss + ';left:16px';
  backButton.setAttribute('aria-label', 'Previous video');
  backButton.setAttribute('title', 'Previous video');

  const forwardButton = document.createElement('button');
  forwardButton.id = 'ytv-forward-button';
  forwardButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="currentColor"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12l-4.58 4.59z"/></svg>`;
  forwardButton.style.cssText = navButtonCss + ';right:16px';
  forwardButton.setAttribute('aria-label', 'Next video');
  forwardButton.setAttribute('title', 'Next video');

  const addButtonHoverEffects = (button: HTMLElement) => {
    button.addEventListener('mouseover', () => {
      button.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
      button.style.borderColor = 'rgba(255, 255, 255, 0.5)';
      button.style.transform = 'translateY(-50%) scale(1.1)';
    });
    button.addEventListener('mouseout', () => {
      button.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      button.style.borderColor = 'rgba(255, 255, 255, 0.3)';
      button.style.transform = 'translateY(-50%) scale(1)';
    });
  };
  addButtonHoverEffects(backButton);
  addButtonHoverEffects(forwardButton);

  const restoreSearchView = () => {
    if (searchBar) searchBar.style.display = 'flex';
    if (modalHeader) modalHeader.style.display = 'flex';
    contentContainer.style.height = 'calc(100% - 56px)';
    if (modalContainer) {
      modalContainer.style.padding = '';
      const contentSection = modalContainer.querySelector<HTMLElement>('.main-trackCreditsModal-mainSection');
      if (contentSection) {
        contentSection.style.height = 'calc(80vh - 60px)';
        contentSection.style.maxHeight = 'calc(80vh - 60px)';
        contentSection.style.padding = '';
        contentSection.style.margin = '';
      }
      const innerContainer = modalContainer.querySelector<HTMLElement>('.main-embedWidgetGenerator-container');
      if (innerContainer) {
        innerContainer.style.padding = '';
        innerContainer.style.margin = '';
      }
      const creditsContainer = modalContainer.querySelector<HTMLElement>('.main-trackCreditsModal-originalCredits');
      if (creditsContainer) {
        creditsContainer.style.padding = '';
        creditsContainer.style.margin = '';
      }
      const modalOverlay = document.querySelector<HTMLElement>('.GenericModal__overlay');
      if (modalOverlay) modalOverlay.style.padding = '';
    }
    performSearch();
  };

  backButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const state = window.ytvCurrentState;
    if (state && state.videoList.length > 0) {
      if (state.videoIndex > 0) {
        const prevIndex = state.videoIndex - 1;
        showVideoPlayer(state.videoList[prevIndex].id.videoId, prevIndex, state.videoList);
      } else {
        restoreSearchView();
      }
    } else {
      restoreSearchView();
    }
  });

  forwardButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const state = window.ytvCurrentState;
    if (state && state.videoList.length > 0) {
      if (state.videoIndex < state.videoList.length - 1) {
        const nextIndex = state.videoIndex + 1;
        showVideoPlayer(state.videoList[nextIndex].id.videoId, nextIndex, state.videoList);
      } else {
        restoreSearchView();
      }
    } else {
      restoreSearchView();
    }
  });

  playerContainer.append(iframe, backButton, forwardButton);
  contentContainer.appendChild(playerContainer);
  playerContainer.addEventListener('click', (e) => e.stopPropagation());
};

// ── Cache ──
const cacheUtils = {
  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(YTV_CACHE_KEY_PREFIX + key);
      if (!item) return null;
      const { value, timestamp } = JSON.parse(item) as CachedItem<T>;
      if (Date.now() - timestamp > YTV_CACHE_DURATION_MS) {
        localStorage.removeItem(YTV_CACHE_KEY_PREFIX + key);
        return null;
      }
      return value;
    } catch (error) {
      if (__SPICETIFY_EXTENSIONS_DEBUG__) log.warn('cache read error:', errMsg(error));
      return null;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      const item: CachedItem<T> = { value, timestamp: Date.now() };
      localStorage.setItem(YTV_CACHE_KEY_PREFIX + key, JSON.stringify(item));
    } catch (error) {
      if (__SPICETIFY_EXTENSIONS_DEBUG__) log.warn('cache write error:', errMsg(error));
      if (error instanceof Error && error.name === 'QuotaExceededError') this.cleanup();
    }
  },
  cleanup(): void {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(YTV_CACHE_KEY_PREFIX)) keys.push(key);
      }
      keys.sort((a, b) => {
        const at = (JSON.parse(localStorage.getItem(a) || '{}') as CachedItem<unknown>).timestamp || 0;
        const bt = (JSON.parse(localStorage.getItem(b) || '{}') as CachedItem<unknown>).timestamp || 0;
        return bt - at;
      });
      keys.slice(YTV_SEARCH_CACHE_SIZE).forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      if (__SPICETIFY_EXTENSIONS_DEBUG__) log.warn('cache cleanup error:', errMsg(error));
    }
  },
  getSearchKey(query: string): string {
    return `search:${query.toLowerCase().trim()}`;
  },
  getTrackKey(trackInfo: TrackInfo): string {
    return `track:${trackInfo.artist}:${trackInfo.name}`.toLowerCase().trim();
  },
};

// ── Settings ──
function loadSettings(): void {
  try {
    const raw = localStorage.getItem(YTV_SETTINGS_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<YtvSettings>) : null;
    ytvSettings = saved ? { ...YTV_DEFAULT_SETTINGS, ...saved } : { ...YTV_DEFAULT_SETTINGS };
  } catch (error) {
    if (__SPICETIFY_EXTENSIONS_DEBUG__) log.error('error loading settings:', errMsg(error));
    ytvSettings = { ...YTV_DEFAULT_SETTINGS };
  }
}

function saveSettings(): void {
  try {
    localStorage.setItem(YTV_SETTINGS_KEY, JSON.stringify(ytvSettings));
  } catch (error) {
    if (__SPICETIFY_EXTENSIONS_DEBUG__) log.error('error saving settings:', errMsg(error));
  }
}

function showSettings(): void {
  Spicetify.PopupModal.display({
    title: 'YT Video Settings',
    content: popupContent(`
      <div style="display:flex;flex-direction:column;gap:20px;padding:24px;max-width:600px;margin:0 auto;">
        <div style="display:flex;flex-direction:column;gap:12px;">
          <label for="ytv-api-key" style="font-size:16px;font-weight:700;">YouTube API Key <span style="color:#ff5555;">(required)</span></label>
          <input type="text" id="ytv-api-key" value="${ytvSettings.apiKey}" placeholder="Paste your YouTube Data API v3 key" style="padding:12px;border-radius:4px;border:1px solid #ccc;background:#282828;color:white;font-size:14px;">
          <a href="https://developers.google.com/youtube/v3/getting-started" target="_blank" style="color:#1DB954;font-size:14px;">How to get a YouTube API Key</a>
          <div id="ytv-api-key-error" style="color:#ff5555;font-size:13px;display:none;">A valid API key is required — anonymous YouTube search is no longer supported.</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <input type="checkbox" id="ytv-show-thumbnails" ${ytvSettings.showThumbnails ? 'checked' : ''} style="width:18px;height:18px;">
          <label for="ytv-show-thumbnails" style="font-size:16px;">Show video thumbnails in search results</label>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <input type="checkbox" id="ytv-autoplay" ${ytvSettings.autoplay ? 'checked' : ''} style="width:18px;height:18px;">
          <label for="ytv-autoplay" style="font-size:16px;">Autoplay videos</label>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:16px;margin-top:16px;">
          <button id="ytv-settings-cancel" style="background:#282828;color:white;border:none;padding:12px 24px;border-radius:4px;cursor:pointer;font-size:14px;">Cancel</button>
          <button id="ytv-settings-save" style="background:#1DB954;color:white;border:none;padding:12px 24px;border-radius:4px;cursor:pointer;font-size:14px;">Save Settings</button>
        </div>
      </div>
    `),
    isLarge: true,
  });

  setTimeout(() => {
    const apiKeyInput = document.getElementById('ytv-api-key') as HTMLInputElement | null;
    const showThumbnailsCheckbox = document.getElementById('ytv-show-thumbnails') as HTMLInputElement | null;
    const autoplayCheckbox = document.getElementById('ytv-autoplay') as HTMLInputElement | null;
    const cancelButton = document.getElementById('ytv-settings-cancel');
    const saveButton = document.getElementById('ytv-settings-save');
    const errorEl = document.getElementById('ytv-api-key-error');

    cancelButton?.addEventListener('click', () => Spicetify.PopupModal.hide());

    saveButton?.addEventListener('click', () => {
      const key = apiKeyInput?.value.trim() || '';
      if (!key) {
        if (errorEl) errorEl.style.display = 'block';
        apiKeyInput?.focus();
        return;
      }
      ytvSettings.apiKey = key;
      ytvSettings.showThumbnails = showThumbnailsCheckbox?.checked || false;
      ytvSettings.autoplay = autoplayCheckbox?.checked || false;
      saveSettings();
      Spicetify.PopupModal.hide();
      showYtvNotification('Settings saved');
    });
  }, 0);
}

// ── DOM helpers ──
async function getElement(selector: string, parent: Element | null = null): Promise<Element | null> {
  for (let retry = 0; retry < YTV_RETRY_LIMIT; retry++) {
    const element = parent instanceof Element ? parent.querySelector(selector) : document.querySelector(selector);
    if (element) return element;
    await new Promise((resolve) => setTimeout(resolve, YTV_DELAY_MS));
  }
  if (__SPICETIFY_EXTENSIONS_DEBUG__) log.warn(`failed to find element '${selector}'`);
  return null;
}

function createYouTubeButton(): HTMLElement {
  const button = document.createElement('button');
  button.classList.add(YTV_BUTTON_CLASS);
  button.setAttribute('title', YTV_BUTTON_TOOLTIP);
  button.setAttribute('aria-label', YTV_BUTTON_TOOLTIP);
  button.innerHTML = YTV_BUTTON_ICON;
  button.style.cssText = `background-color:transparent;border:none;color:${YTV_BUTTON_COLOR};cursor:pointer;padding:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;opacity:0.7;transition:opacity 0.2s ease-in-out`;
  button.addEventListener('mouseover', () => (button.style.opacity = '1'));
  button.addEventListener('mouseout', () => (button.style.opacity = '0.7'));
  button.addEventListener('click', openYouTubeVideo);
  return button;
}

// ── Current-track metadata ──
function getCurrentTrackInfo(): TrackInfo | null {
  try {
    const data = Spicetify.Player?.data as unknown as { track?: { metadata?: Record<string, string> } } | undefined;
    const metadata = data?.track?.metadata;
    if (metadata) {
      return { name: metadata.title, artist: metadata.artist_name, album: metadata.album_title };
    }

    const getTrackInfo = (Spicetify.Player as unknown as { getTrackInfo?: () => { track?: string; artist?: string; album?: string } })
      .getTrackInfo;
    if (typeof getTrackInfo === 'function') {
      const info = getTrackInfo();
      if (info) return { name: info.track || '', artist: info.artist || '', album: info.album || '' };
    }

    const nameEl = document.querySelector('.main-nowPlayingWidget-nowPlaying .main-trackInfo-name');
    const artistEl = document.querySelector('.main-nowPlayingWidget-nowPlaying .main-trackInfo-artists');
    if (nameEl && artistEl) {
      return { name: nameEl.textContent || '', artist: artistEl.textContent || '', album: '' };
    }

    const nameAlt = document.querySelector("[data-testid='now-playing-widget'] .main-trackInfo-name");
    const artistAlt = document.querySelector("[data-testid='now-playing-widget'] .main-trackInfo-artists");
    if (nameAlt && artistAlt) {
      return { name: nameAlt.textContent || '', artist: artistAlt.textContent || '', album: '' };
    }

    const title = document.title;
    if (title && title.includes(' - ') && !title.startsWith('Spotify')) {
      const parts = title.split(' - ');
      if (parts.length >= 2) return { name: parts[0], artist: parts[1].replace(' • Spotify', ''), album: '' };
    }
    return null;
  } catch (error) {
    if (__SPICETIFY_EXTENSIONS_DEBUG__)
      log.error('error getting current track info:', errMsg(error));
    return null;
  }
}

interface CosmosLike {
  code?: number;
  name?: string;
  artists?: { name?: string }[];
  album?: { name?: string };
  headers?: Record<string, string>;
  status?: number;
  response?: { status?: number; headers?: Record<string, string> };
}

async function getTrackInfoFromURI(uri: string): Promise<TrackInfo | null> {
  const blockedUntil = ytvRateLimitedUntilByUri.get(uri);
  if (blockedUntil && blockedUntil > Date.now()) return null;

  const getRetryAfterSeconds = (responseLike: CosmosLike): number => {
    const raw =
      responseLike?.headers?.['retry-after'] ??
      (responseLike as Record<string, string | undefined>)?.['retry-after'] ??
      responseLike?.response?.headers?.['retry-after'];
    const parsed = Number.parseInt(raw ?? '', 10);
    if (Number.isFinite(parsed) && parsed > 0) return Math.min(parsed, YTV_MAX_RETRY_AFTER_SECONDS);
    return YTV_RATE_LIMIT_FALLBACK_SECONDS;
  };

  const cosmos = Spicetify.CosmosAsync as unknown as { get(url: string): Promise<CosmosLike> };

  const makeApiCallWithRetry = async (apiUrl: string, retryCount = 0): Promise<CosmosLike> => {
    const MAX_RETRIES = 1;
    try {
      const response = await cosmos.get(apiUrl);
      if (response && response.code === 429 && retryCount < MAX_RETRIES) {
        const retryAfter = getRetryAfterSeconds(response);
        showYtvNotification(`Rate limited. Retrying in ${retryAfter}s...`);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        return makeApiCallWithRetry(apiUrl, retryCount + 1);
      }
      return response;
    } catch (error) {
      const err = error as CosmosLike;
      if ((err.status === 429 || err.response?.status === 429) && retryCount < MAX_RETRIES) {
        const retryAfter = getRetryAfterSeconds(err);
        showYtvNotification(`Rate limited. Retrying in ${retryAfter}s...`);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        return makeApiCallWithRetry(apiUrl, retryCount + 1);
      }
      throw error;
    }
  };

  try {
    if (uri.includes('spotify:track:')) {
      const trackId = uri.split('spotify:track:')[1];
      if (!trackId) return null;
      const trackInfo = await makeApiCallWithRetry(`https://api.spotify.com/v1/tracks/${trackId}`);
      if (trackInfo?.code === 429) {
        ytvRateLimitedUntilByUri.set(uri, Date.now() + getRetryAfterSeconds(trackInfo) * 1000);
        return null;
      }
      if (trackInfo?.name) {
        return { name: trackInfo.name, artist: trackInfo.artists?.[0]?.name || '', album: trackInfo.album?.name || '' };
      }
    } else if (uri.includes('spotify:album:')) {
      const albumId = uri.split('spotify:album:')[1];
      if (!albumId) return null;
      const albumInfo = await makeApiCallWithRetry(`https://api.spotify.com/v1/albums/${albumId}`);
      if (albumInfo?.code === 429) {
        ytvRateLimitedUntilByUri.set(uri, Date.now() + getRetryAfterSeconds(albumInfo) * 1000);
        return null;
      }
      if (albumInfo?.name) {
        return { name: albumInfo.name, artist: albumInfo.artists?.[0]?.name || '', album: albumInfo.name };
      }
    } else if (uri.includes('spotify:artist:')) {
      const artistId = uri.split('spotify:artist:')[1];
      if (!artistId) return null;
      const artistInfo = await makeApiCallWithRetry(`https://api.spotify.com/v1/artists/${artistId}`);
      if (artistInfo?.code === 429) {
        ytvRateLimitedUntilByUri.set(uri, Date.now() + getRetryAfterSeconds(artistInfo) * 1000);
        return null;
      }
      if (artistInfo?.name) return { name: '', artist: artistInfo.name, album: '' };
    }
  } catch (error) {
    if (__SPICETIFY_EXTENSIONS_DEBUG__)
      log.error('error getting track info from URI:', errMsg(error));
  }
  return null;
}

// ── Search UI + results ──
function openYouTubeVideoForTrack(trackInfo: TrackInfo | null): void {
  if (!trackInfo) {
    showYtvNotification('No track information available');
    return;
  }

  // API key is mandatory — without it, show settings instead of a dead search.
  if (!hasApiKey()) {
    showYtvNotification('A YouTube API key is required. Please add it in settings.');
    showSettings();
    return;
  }

  let searchQuery: string;
  const headerTitle = 'YT Video Search';
  if (trackInfo.name && trackInfo.artist) {
    searchQuery = `${trackInfo.artist} - ${trackInfo.name} ${YTV_MUSIC_VIDEO_SEARCH_SUFFIX}`;
  } else if (!trackInfo.name && trackInfo.artist) {
    searchQuery = `${trackInfo.artist} ${YTV_MUSIC_VIDEO_SEARCH_SUFFIX}`;
  } else if (trackInfo.name && !trackInfo.artist) {
    searchQuery = `${trackInfo.name} full album`;
  } else {
    showYtvNotification('Insufficient track information');
    return;
  }

  showYtvNotification(`Searching for "${searchQuery}" on YouTube...`);

  Spicetify.PopupModal.display({
    title: headerTitle,
    content: popupContent(`
      <div id="ytv-container" style="width:100%;height:80vh;">
        <div id="ytv-search-bar" style="padding:8px;display:flex;gap:8px;align-items:center;">
          <input type="text" id="ytv-search-input" value="${searchQuery}" style="flex:1;padding:8px;border-radius:4px;border:1px solid #ccc;background:#282828;color:white;">
          <button id="ytv-search-button" style="background-color:#FF0000;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;">Search</button>
          <button id="ytv-youtube-button" style="background:#282828;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;">Open on YouTube</button>
          <button id="ytv-settings-button" style="background:#282828;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;">Settings</button>
          <button id="ytv-help-button" title="Show keyboard shortcuts" style="background:#282828;color:white;border:none;padding:0;width:32px;height:32px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:bold;">?</button>
        </div>
        <div id="ytv-content" style="height:calc(100% - 56px);position:relative;">
          <div id="ytv-loading" style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;justify-content:center;align-items:center;background:#121212;">
            <div class="main-loadingSpinner-spinner"></div>
          </div>
        </div>
      </div>
    `),
    isLarge: true,
  });

  setTimeout(() => {
    const modalContainer = document.querySelector<HTMLElement>('.GenericModal');
    if (modalContainer) {
      modalContainer.style.cssText +=
        ';width:80vw;height:80vh;max-width:80vw;max-height:80vh;position:fixed;left:50%;top:45%;transform:translate(-50%,-50%);z-index:9999';
      const contentSection = modalContainer.querySelector<HTMLElement>('.main-trackCreditsModal-mainSection');
      if (contentSection) {
        contentSection.style.height = 'calc(80vh - 40px)';
        contentSection.style.maxHeight = 'calc(80vh - 40px)';
        contentSection.style.overflow = 'hidden';
      }
      const container = modalContainer.querySelector<HTMLElement>('.main-embedWidgetGenerator-container');
      if (container) container.style.cssText += ';width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden';
      const header = modalContainer.querySelector<HTMLElement>('.main-trackCreditsModal-header');
      if (header) {
        header.style.padding = '8px 16px';
        header.style.minHeight = '40px';
        header.style.height = '40px';
        const title = header.querySelector<HTMLElement>('.main-type-alto');
        if (title) title.style.cssText += ';font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:calc(100% - 40px)';
      }
      const modalOverlay = document.querySelector<HTMLElement & { onclick: ((e: MouseEvent) => void) | null }>('.GenericModal__overlay');
      if (modalOverlay) {
        const original = modalOverlay.onclick;
        modalOverlay.onclick = (e: MouseEvent) => {
          if (e.target === modalOverlay) {
            window.ytvCurrentState = null;
            original?.call(modalOverlay, e);
          } else {
            e.stopPropagation();
          }
        };
      }
      const closeButton = modalContainer.querySelector<HTMLElement & { onclick: ((e: MouseEvent) => void) | null }>('[aria-label="Close"]');
      if (closeButton) {
        const original = closeButton.onclick;
        closeButton.onclick = (e: MouseEvent) => {
          window.ytvCurrentState = null;
          original?.call(closeButton, e);
        };
      }
      document.getElementById('ytv-container')?.addEventListener('click', (e) => e.stopPropagation());
    }
  }, 100);

  setTimeout(() => {
    const searchInput = document.getElementById('ytv-search-input') as HTMLInputElement | null;
    const searchButton = document.getElementById('ytv-search-button');
    const youtubeButton = document.getElementById('ytv-youtube-button');
    const settingsButton = document.getElementById('ytv-settings-button');
    const helpButton = document.getElementById('ytv-help-button');
    const contentContainer = document.getElementById('ytv-content');

    showApiResults = async (query: string) => {
      const currentContent = document.getElementById('ytv-content');
      if (!currentContent) return;
      currentContent.innerHTML = `<div style="width:100%;height:100%;display:flex;justify-content:center;align-items:center;background:#121212;"><div class="main-loadingSpinner-spinner"></div></div>`;

      try {
        const searchCacheKey = cacheUtils.getSearchKey(query);
        let data = cacheUtils.get<YtSearchResponse>(searchCacheKey);
        if (!data) {
          const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=15&key=${ytvSettings.apiKey}`,
          );
          data = (await response.json()) as YtSearchResponse;
          if (data.error) throw new Error(data.error.message || 'API Error');
          if (data.items && data.items.length > 0) cacheUtils.set(searchCacheKey, data);
        }

        if (!data.items || data.items.length === 0) {
          currentContent.innerHTML = `<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;background:#121212;color:white;text-align:center;padding:20px;"><p>No results found for "${query}"</p><button onclick="window.open('https://www.youtube.com/results?search_query=${encodeURIComponent(query)}', '_blank')" style="background-color:#282828;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;margin-top:16px;">Open Search on YouTube</button></div>`;
          return;
        }

        const items = data.items;
        window.ytvSearchResults = items;

        const resultsContainer = document.createElement('div');
        resultsContainer.id = 'ytv-results-container';
        resultsContainer.style.cssText = 'width:100%;height:100%;overflow:auto;padding:16px;background:#121212';
        const resultsGrid = document.createElement('div');
        resultsGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px';

        items.forEach((item, index) => {
          const resultItem = document.createElement('div');
          resultItem.className = 'ytv-result';
          resultItem.dataset.videoId = item.id.videoId;
          resultItem.dataset.videoIndex = String(index);
          resultItem.style.cssText = 'cursor:pointer;transition:transform 0.2s;background:#333;border-radius:4px;overflow:hidden';

          if (ytvSettings.showThumbnails) {
            const thumbnail = document.createElement('img');
            thumbnail.src = item.snippet.thumbnails.medium.url;
            thumbnail.style.cssText = 'width:100%;height:180px;object-fit:cover';
            resultItem.appendChild(thumbnail);
          } else {
            const placeholder = document.createElement('div');
            placeholder.style.cssText = 'width:100%;height:180px;background:#222;display:flex;justify-content:center;align-items:center';
            placeholder.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#FF0000"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>`;
            resultItem.appendChild(placeholder);
          }

          const infoDiv = document.createElement('div');
          infoDiv.style.padding = '12px';
          const titleDiv = document.createElement('div');
          titleDiv.style.cssText = 'font-weight:bold;margin-bottom:4px';
          titleDiv.textContent = item.snippet.title;
          const channelDiv = document.createElement('div');
          channelDiv.style.cssText = 'color:#b3b3b3;font-size:14px';
          channelDiv.textContent = item.snippet.channelTitle;
          const dateDiv = document.createElement('div');
          dateDiv.style.cssText = 'color:#b3b3b3;font-size:12px;margin-top:4px';
          dateDiv.textContent = new Date(item.snippet.publishedAt).toLocaleDateString();
          infoDiv.append(titleDiv, channelDiv, dateDiv);
          resultItem.appendChild(infoDiv);

          resultItem.addEventListener('mouseover', () => {
            resultItem.style.transform = 'scale(1.02)';
            resultItem.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
          });
          resultItem.addEventListener('mouseout', () => {
            resultItem.style.transform = 'scale(1)';
            resultItem.style.boxShadow = 'none';
          });
          resultItem.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showVideoPlayer(item.id.videoId, index, items);
          });

          resultsGrid.appendChild(resultItem);
        });

        resultsContainer.appendChild(resultsGrid);
        currentContent.innerHTML = '';
        currentContent.appendChild(resultsContainer);
        resultsContainer.addEventListener('click', (e) => e.stopPropagation());
      } catch (error) {
        currentContent.innerHTML = `<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;background:#121212;color:white;text-align:center;padding:20px;"><p>Error: ${errMsg(error)}</p><p style="margin-top:8px;color:#b3b3b3;">Please check your API key in settings or try again later.</p><button onclick="window.open('https://www.youtube.com/results?search_query=${encodeURIComponent(query)}', '_blank')" style="background-color:#282828;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;margin-top:16px;">Open Search on YouTube</button></div>`;
      }
    };

    performSearch = () => {
      const query = searchInput?.value.trim() || '';
      void showApiResults(query);
    };

    performSearch();

    searchButton?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      performSearch();
    });
    searchInput?.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        performSearch();
      }
    });
    searchInput?.addEventListener('click', (e) => e.stopPropagation());

    youtubeButton?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const query = searchInput?.value.trim() || '';
      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
    });

    settingsButton?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setTimeout(showSettings, 100);
    });

    helpButton?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.getElementById('ytv-shortcuts-overlay')?.remove();

      const overlay = document.createElement('div');
      overlay.id = 'ytv-shortcuts-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background-color:rgba(0,0,0,0.5);z-index:10000;display:flex;justify-content:center;align-items:center';
      const box = document.createElement('div');
      box.style.cssText = 'position:relative;background-color:#282828;color:white;padding:24px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);max-width:480px;text-align:left';
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '&times;';
      closeBtn.style.cssText = 'position:absolute;top:8px;right:12px;background:none;border:none;color:#aaa;font-size:28px;line-height:1;padding:0;cursor:pointer';
      closeBtn.setAttribute('aria-label', 'Close help');
      closeBtn.addEventListener('click', () => overlay.remove());
      box.appendChild(closeBtn);

      const heading = document.createElement('h3');
      heading.textContent = 'Keyboard Shortcuts';
      heading.style.cssText = 'margin-top:0;margin-bottom:16px;border-bottom:1px solid #444;padding-bottom:8px';
      box.appendChild(heading);

      const list = document.createElement('ul');
      list.style.cssText = 'list-style-type:none;padding-left:0;margin:0';
      const shortcuts = [
        { key: 'Ctrl/Cmd + Y', desc: 'Open Search Panel' },
        { key: 'Alt/Opt + Left Arrow', desc: 'Previous Video (in player)' },
        { key: 'Alt/Opt + Right Arrow', desc: 'Next Video (in player)' },
        { key: 'ESC', desc: 'Close Help / Search / Player' },
      ];
      shortcuts.forEach((s) => {
        const li = document.createElement('li');
        li.style.marginBottom = '8px';
        li.innerHTML = `<strong style="color:#1DB954;min-width:180px;display:inline-block;">${s.key}:</strong> ${s.desc}`;
        list.appendChild(li);
      });
      box.appendChild(list);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) overlay.remove();
      });
    });

    contentContainer?.addEventListener('click', (e) => e.stopPropagation());
  }, 150);
}

function openYouTubeVideo(): void {
  const trackInfo = getCurrentTrackInfo();
  if (trackInfo) openYouTubeVideoForTrack(trackInfo);
  else showYtvNotification('No track information available');
}

// ── Keyboard shortcuts ──
function handleKeyboardShortcut(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    const helpOverlay = document.getElementById('ytv-shortcuts-overlay');
    if (helpOverlay) {
      helpOverlay.remove();
      return;
    }
    const modal = document.querySelector('.GenericModal');
    if (modal && document.getElementById('ytv-container')) {
      window.ytvCurrentState = null;
      Spicetify.PopupModal.hide();
    }
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.code === 'KeyY') {
    event.preventDefault();
    event.stopPropagation();
    openYouTubeVideo();
    return;
  }

  const state = window.ytvCurrentState;
  if (event.altKey && state && state.videoList.length > 0) {
    if (event.code === 'ArrowLeft') {
      event.preventDefault();
      event.stopPropagation();
      if (state.videoIndex > 0) {
        const prevIndex = state.videoIndex - 1;
        showVideoPlayer(state.videoList[prevIndex].id.videoId, prevIndex, state.videoList);
      } else {
        showYtvNotification('Already at the first video');
      }
    } else if (event.code === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      if (state.videoIndex < state.videoList.length - 1) {
        const nextIndex = state.videoIndex + 1;
        showVideoPlayer(state.videoList[nextIndex].id.videoId, nextIndex, state.videoList);
      } else {
        showYtvNotification('Already at the last video');
      }
    }
  }
}

// ── Button injection ──
async function addYouTubeButton(): Promise<boolean> {
  if (document.querySelector(`.${YTV_BUTTON_CLASS}`)) return true;
  const button = createYouTubeButton();
  const locations = [
    '.main-trackInfo-container',
    '.main-nowPlayingBar-extraControls',
    '.main-nowPlayingBar-right',
    '.main-nowPlayingWidget-nowPlaying',
  ];
  for (const location of locations) {
    const container = await getElement(location);
    if (container) {
      container.appendChild(button);
      return true;
    }
  }
  button.style.cssText += ';position:fixed;bottom:80px;right:16px;z-index:9999';
  document.body.appendChild(button);
  return true;
}

// ── Native right-click context menu ──
function addContextMenuItems(): void {
  if (window.__ytvContextMenuRegistered) return;
  if (!Spicetify.ContextMenu) {
    if (__SPICETIFY_EXTENSIONS_DEBUG__) log.error('Spicetify.ContextMenu is not available');
    return;
  }

  const item = new Spicetify.ContextMenu.Item(
    YTV_CONTEXT_MENU_ITEM,
    async (uris: string[]) => {
      const now = Date.now();
      if (now - ytvLastContextMenuActionAt < YTV_CONTEXT_MENU_GUARD_MS) return;
      ytvLastContextMenuActionAt = now;

      if (!uris || !uris.length) {
        showYtvNotification('Error: No track URI provided');
        return;
      }
      if (Spicetify.Player.isPlaying()) Spicetify.Player.pause();

      const uri = uris[0];
      const trackInfo = await resolveContextMenuTrackInfo(
        getRecentLastContextTrackInfo(),
        () => getTrackInfoFromURI(uri),
        getCurrentTrackInfo,
      );
      if (!trackInfo) {
        showYtvNotification('Could not retrieve track information');
        return;
      }
      openYouTubeVideoForTrack(trackInfo);
    },
    (uris: string[]) => {
      if (!uris || !uris.length) return false;
      const uri = uris[0];
      return uri.includes('spotify:track:') || uri.includes('spotify:album:') || uri.includes('spotify:artist:');
    },
    YTV_CONTEXT_MENU_ICON as Spicetify.Icon,
  );
  item.register();
  window.__ytvContextMenuRegistered = true;
}

// ── Init ──
async function init(): Promise<void> {
  // react:true — Spicetify.ContextMenu.Item uses the React jsx runtime, which
  // isn't ready when FeedbackAPI first appears (throws "reading 'jsx'").
  await whenReady({ api: 'FeedbackAPI', react: true });

  loadSettings();
  cacheUtils.cleanup();

  // Register the context menu + listeners FIRST, so a later failure (e.g. in
  // the awaited button injection) can't strand them. Guard the menu so a bad
  // registration can't abort the rest of init either.
  try {
    addContextMenuItems();
  } catch (error) {
    if (__SPICETIFY_EXTENSIONS_DEBUG__)
      log.error('context menu registration failed:', errMsg(error));
  }
  document.addEventListener('keydown', handleKeyboardShortcut, true);
  document.addEventListener('pointerdown', captureContextMenuTrackInfo, true);
  document.addEventListener('mousedown', captureContextMenuTrackInfo, true);
  document.addEventListener('contextmenu', captureContextMenuTrackInfo, true);

  await addYouTubeButton();

  Spicetify.Player.addEventListener('songchange', () => {
    if (!document.querySelector(`.${YTV_BUTTON_CLASS}`)) void addYouTubeButton();
  });
  Spicetify.Platform.History.listen(() => {
    if (!document.querySelector(`.${YTV_BUTTON_CLASS}`)) void addYouTubeButton();
  });

  // API key is mandatory — prompt for it on first load if it's missing.
  if (!hasApiKey()) {
    showYtvNotification('YT-Video needs a YouTube API key to search. Opening settings…');
    showSettings();
  }

  if (__SPICETIFY_EXTENSIONS_DEBUG__) log.log('initialized');
}

void init().catch((error) => {
  if (__SPICETIFY_EXTENSIONS_DEBUG__) log.error('init failed:', errMsg(error));
});
