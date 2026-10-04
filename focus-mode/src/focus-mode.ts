// Focus Mode - Spicetify extension
// Hides everything except album art, shows controls on mouse move, exits on click or Esc.
import { whenReady, injectStyle } from '@spicetify-ext/core';

type TrackMetadata = Record<string, string | undefined>;
type AnyEvent = { data?: unknown };

// React runtimes (assigned in main once ready). Typed via the ambient globals,
// which declare them as `any`, so no explicit-any is introduced here.
let react = Spicetify.React;
let reactDOM = Spicetify.ReactDOM;

// The vendored Player type doesn't cover getLyrics or the data-carrying event
// callbacks we use, so access those through a narrow structural view.
interface LoosePlayer {
  addEventListener(event: string, cb: (ev: AnyEvent) => void): void;
  removeEventListener(event: string, cb: (ev: AnyEvent) => void): void;
  getLyrics?: () => Promise<{ lines?: unknown[] } | null>;
}
const player = Spicetify.Player as unknown as LoosePlayer;

// --- Constants ---
const FM_TIMEOUT_MS = 3000;
const FM_FADE_DURATION_MS = 500;
const FM_CLASS_NAME = 'focus-mode-active';
const FM_CONTROLS_VISIBLE_CLASS = 'focus-mode-controls-visible';
const FM_ELEMENT_ID_PREFIX = 'focus-mode-';
const FM_ALBUM_ART_ID = `${FM_ELEMENT_ID_PREFIX}album-art`;
const FM_PLAYER_CONTROLS_ID = `${FM_ELEMENT_ID_PREFIX}player-controls`;
const FM_TRACK_INFO_ID = `${FM_ELEMENT_ID_PREFIX}track-info`;
const FM_REACT_ROOT_ID = `${FM_ELEMENT_ID_PREFIX}react-root`;
const FM_BUTTON_LABEL = 'Focus Mode';
const FM_STYLE_ID = 'focus-mode-styles';

const FM_PLAYBAR_ICON_WRAPPER_CLASS = 'e-9800-button__icon-wrapper';
const FM_PLAYBAR_SVG_CLASSES = 'e-9800-icon e-9800-baseline';

const FM_CONTROL_BUTTON_STYLE = {
  background: 'rgba(255, 255, 255, 0.1)',
  color: 'white',
  border: 'none',
  borderRadius: '50%',
  padding: '8px',
  minWidth: '32px',
  minHeight: '32px',
  width: '32px',
  height: '32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

const FM_SELECTORS = {
  APP_CONTENT:
    'body .Root__top-bar, body .Root__nav-bar, body .Root__main-view, body .Root__now-playing-bar, body .Root__right-sidebar',
  EXTRA_ELEMENTS: '.main-nowPlayingView-section, .main-trackInfo-container, .main-trackList-trackList',
};

// --- Global state ---
let isFocusModeActive = false;
let latestTrackData: TrackMetadata | null = null;
let latestAlbumArtUrl: string | null = null;
let controlsVisible = false;
let visibilityTimeout: ReturnType<typeof setTimeout> | null = null;
let focusModeButton: Spicetify.Playbar.Button | null = null;
let reactRootElement: HTMLElement | null = null;
let wasFullscreenBefore = false;
let hasLyrics = false;
let isLyricsViewActive = false;
let originalPath: string | null = null;

// State setters exported by the React component, for external updates.
let volumeStateUpdater: ((v: number) => void) | null = null;
let sliderValueUpdater: ((v: number) => void) | null = null;
let dimOpacityUpdater: ((v: number) => void) | null = null;

// Assigned inside main() once React is ready.
let FocusModeUI: unknown = null;

// --- Helpers ---
function convertSpotifyImageUri(spotifyUri: string | null): string | null {
  if (!spotifyUri || !spotifyUri.startsWith('spotify:image:')) return null;
  const imageId = spotifyUri.substring('spotify:image:'.length);
  return `https://i.scdn.co/image/${imageId}`;
}

function buildStyles(): string {
  return `
    body.${FM_CLASS_NAME} ${FM_SELECTORS.APP_CONTENT} {
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
      transition: opacity ${FM_FADE_DURATION_MS}ms ease, visibility ${FM_FADE_DURATION_MS}ms ease;
    }
    body.${FM_CLASS_NAME} ${FM_SELECTORS.EXTRA_ELEMENTS} { display: none !important; }
    body.${FM_CLASS_NAME} { overflow: hidden !important; }

    #${FM_REACT_ROOT_ID} {
      display: none;
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      z-index: 9998; background-color: #000; pointer-events: none; cursor: none;
    }
    body.${FM_CLASS_NAME} #${FM_REACT_ROOT_ID} { display: block; pointer-events: auto; }

    #${FM_ALBUM_ART_ID} {
      display: block; position: absolute; top: 0; left: 0;
      width: 100%; height: 100%; object-fit: contain; margin: 0; padding: 0; border: none;
    }

    #${FM_PLAYER_CONTROLS_ID} {
      position: absolute; bottom: 0; left: 0; width: 100%; z-index: 10000;
      background: rgba(0, 0, 0, 0.7); padding: 16px 0; pointer-events: auto; opacity: 0;
      transition: opacity ${FM_FADE_DURATION_MS}ms ease !important;
      display: flex; justify-content: center; cursor: auto !important;
    }
    body.${FM_CLASS_NAME}.${FM_CONTROLS_VISIBLE_CLASS} #${FM_PLAYER_CONTROLS_ID} { opacity: 1 !important; }

    #${FM_TRACK_INFO_ID} {
      position: absolute; top: 0; left: 0; width: 100%; text-align: center; z-index: 10000;
      pointer-events: none; opacity: 0; transition: opacity ${FM_FADE_DURATION_MS}ms ease !important;
      background: rgba(0, 0, 0, 0.7); padding: 16px; color: white; cursor: none;
    }
    body.${FM_CLASS_NAME}.${FM_CONTROLS_VISIBLE_CLASS} #${FM_TRACK_INFO_ID} { opacity: 1 !important; cursor: auto !important; }
    #${FM_TRACK_INFO_ID} .track-title { font-size: 1.2em; font-weight: bold; }
    #${FM_TRACK_INFO_ID} .track-artist { font-size: 1em; opacity: 0.8; }
    #${FM_TRACK_INFO_ID} .track-album { font-size: 0.9em; opacity: 0.7; font-style: italic; }

    #fad-lyrics-plus-container.lyrics-overlay-container {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999;
      background: rgba(0, 0, 0, 0.7); overflow-y: auto; pointer-events: none; opacity: 0;
      transition: opacity ${FM_FADE_DURATION_MS}ms ease;
    }
    #fad-lyrics-plus-container.lyrics-overlay-container > * { pointer-events: auto; }
    body.focus-mode-lyrics-active #fad-lyrics-plus-container.lyrics-overlay-container { opacity: 1; }
    #${FM_TRACK_INFO_ID} { z-index: 10000; }
    #${FM_PLAYER_CONTROLS_ID} { z-index: 10000; }
    body.focus-mode-lyrics-active #fad-lyrics-plus-container .lyrics-config-button-container { display: none !important; }

    #focus-mode-progress-bar {
      -webkit-appearance: none; appearance: none; flex-grow: 1; height: 4px; border-radius: 2px;
      cursor: pointer; outline: none;
      background: linear-gradient(to right, #fff var(--progress-percent, 0%), rgba(255,255,255,0.3) var(--progress-percent, 0%));
    }
    #focus-mode-progress-bar::-webkit-slider-thumb,
    .focus-mode-volume-slider::-webkit-slider-thumb,
    .focus-mode-dim-slider::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none; width: 12px; height: 12px; background: #fff; border-radius: 50%; cursor: pointer;
    }
    #focus-mode-progress-bar::-moz-range-thumb,
    .focus-mode-volume-slider::-moz-range-thumb,
    .focus-mode-dim-slider::-moz-range-thumb {
      width: 12px; height: 12px; background: #fff; border-radius: 50%; border: none; cursor: pointer;
    }
    .focus-mode-volume-slider {
      -webkit-appearance: none; appearance: none; flex-grow: 1; height: 4px; border-radius: 2px; cursor: pointer; outline: none;
      background: linear-gradient(to right, #fff var(--volume-percent, 0%), rgba(255,255,255,0.3) var(--volume-percent, 0%));
    }
    .focus-mode-dim-slider {
      -webkit-appearance: none; appearance: none; flex-grow: 1; height: 4px; border-radius: 2px; cursor: pointer; outline: none;
      background: linear-gradient(to right, #fff var(--dim-percent, 25%), rgba(255,255,255,0.3) var(--dim-percent, 25%));
    }
  `;
}

function formatTime(milliseconds: number): string {
  if (isNaN(milliseconds) || milliseconds < 0) return '0:00';
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

async function checkForLyrics(): Promise<boolean> {
  try {
    const currentTrack = Spicetify.Player.data?.item;
    if (!currentTrack?.uri) return false;

    if (player.getLyrics) {
      try {
        const lyrics = await player.getLyrics();
        if (lyrics?.lines && lyrics.lines.length > 0) return true;
      } catch (e) {
        console.warn('Focus Mode: Error using getLyrics:', e);
      }
    }

    const meta = latestTrackData;
    if (meta?.has_lyrics === 'true' || meta?.lyrics === 'true' || meta?.lyrics_id) return true;
  } catch (e) {
    console.error('Focus Mode: Error during checkForLyrics:', e);
    return false;
  }
  return false;
}

function updateStoredTrackData(): void {
  const currentItem = Spicetify.Player.data?.item;
  if (!currentItem) {
    latestTrackData = null;
    latestAlbumArtUrl = null;
    hasLyrics = false;
    return;
  }

  const metadata = currentItem.metadata as TrackMetadata | undefined;
  if (!metadata) {
    latestTrackData = { uri: currentItem.uri };
    latestAlbumArtUrl = null;
    hasLyrics = false;
    return;
  }

  latestTrackData = metadata;
  latestAlbumArtUrl = metadata.image_xlarge_url || metadata.image_large_url || metadata.image_url || null;

  checkForLyrics()
    .then((result) => {
      hasLyrics = result;
      renderFocusModeUI();
    })
    .catch(() => {
      hasLyrics = false;
      renderFocusModeUI();
    });
}

// --- Rendering ---
function renderFocusModeUI(): void {
  if (!isFocusModeActive || !reactRootElement || !react || !reactDOM || !FocusModeUI) return;
  try {
    reactDOM.render(
      react.createElement(FocusModeUI, {
        trackData: latestTrackData,
        albumArtUrl: latestAlbumArtUrl,
        controlsVisible,
      }),
      reactRootElement,
    );
  } catch (e) {
    console.error('Focus Mode: Error during reactDOM.render:', e);
    Spicetify.showNotification?.('Error rendering Focus Mode UI. Check console.', true);
  }
}

function unmountFocusModeUI(): void {
  if (reactRootElement && reactDOM) {
    try {
      reactDOM.unmountComponentAtNode(reactRootElement);
    } catch (e) {
      console.error('Focus Mode: Error during unmount:', e);
    }
  }
}

// --- Event handlers ---
function handleMouseMove(): void {
  if (!isFocusModeActive) return;
  if (!controlsVisible) {
    controlsVisible = true;
    document.body.classList.add(FM_CONTROLS_VISIBLE_CLASS);
  }
  if (visibilityTimeout) clearTimeout(visibilityTimeout);
  visibilityTimeout = setTimeout(() => {
    controlsVisible = false;
    document.body.classList.remove(FM_CONTROLS_VISIBLE_CLASS);
    visibilityTimeout = null;
  }, FM_TIMEOUT_MS);
}

function handleDimAdjustment(change: number): void {
  const albumArt = document.getElementById(FM_ALBUM_ART_ID);
  if (!albumArt) return;
  const currentOpacity = parseFloat(albumArt.style.opacity || '0.25');
  const newOpacity = Math.max(0, Math.min(1, currentOpacity + change));
  albumArt.style.opacity = String(newOpacity);
  dimOpacityUpdater?.(newOpacity);
}

function handleKeyDown(event: KeyboardEvent): void {
  if (!isFocusModeActive) return;
  switch (event.key.toLowerCase()) {
    case 'escape':
      deactivateFocusMode();
      break;
    case ' ':
      Spicetify.Player.togglePlay();
      event.preventDefault();
      break;
    case 'arrowleft':
      Spicetify.Player.back();
      event.preventDefault();
      break;
    case 'arrowright':
      Spicetify.Player.next();
      event.preventDefault();
      break;
    case 'arrowup': {
      const newVolume = Math.min(1, Spicetify.Player.getVolume() + 0.05);
      Spicetify.Player.setVolume(newVolume);
      volumeStateUpdater?.(newVolume);
      sliderValueUpdater?.(newVolume);
      event.preventDefault();
      break;
    }
    case 'arrowdown': {
      const newVolume = Math.max(0, Spicetify.Player.getVolume() - 0.05);
      Spicetify.Player.setVolume(newVolume);
      volumeStateUpdater?.(newVolume);
      sliderValueUpdater?.(newVolume);
      event.preventDefault();
      break;
    }
    case '+':
    case '=':
      handleDimAdjustment(0.05);
      event.preventDefault();
      break;
    case '-':
      handleDimAdjustment(-0.05);
      event.preventDefault();
      break;
    case 'l':
      void toggleLyricsView();
      event.preventDefault();
      break;
    default:
      break;
  }
}

function handleClick(event: MouseEvent): void {
  const target = event.target as Element | null;
  if (
    isFocusModeActive &&
    !target?.closest(`#${FM_PLAYER_CONTROLS_ID}`) &&
    !target?.closest(`#${FM_TRACK_INFO_ID}`) &&
    focusModeButton &&
    !focusModeButton.element.contains(target as Node)
  ) {
    deactivateFocusMode();
  }
}

function handleSongChange(): void {
  setTimeout(() => {
    updateStoredTrackData();
    if (isFocusModeActive) renderFocusModeUI();
  }, 100);
}

function handleLyricsPlusUpdate(event: Event): void {
  console.log('Focus Mode: lyrics-plus-update', (event as CustomEvent).detail);
}

async function toggleLyricsView(): Promise<void> {
  if (!hasLyrics) {
    Spicetify.showNotification?.('Lyrics not available for this track.');
    return;
  }
  isLyricsViewActive = !isLyricsViewActive;

  if (isLyricsViewActive) {
    originalPath = Spicetify.Platform.History.location.pathname;
    if (originalPath !== '/lyrics-plus') Spicetify.Platform.History.push('/lyrics-plus');
    setTimeout(() => {
      window.addEventListener('lyrics-plus-update', handleLyricsPlusUpdate);
      window.dispatchEvent(new Event('fad-request'));
      document.body.classList.add('focus-mode-lyrics-active');
      renderFocusModeUI();
    }, 200);
  } else {
    window.removeEventListener('lyrics-plus-update', handleLyricsPlusUpdate);
    if (originalPath && originalPath !== '/lyrics-plus') Spicetify.Platform.History.push(originalPath);
    originalPath = null;
    document.body.classList.remove('focus-mode-lyrics-active');
    renderFocusModeUI();
  }
}

// --- Activation / deactivation ---
async function activateFocusMode(): Promise<void> {
  if (isFocusModeActive) return;

  wasFullscreenBefore = !!document.fullscreenElement;
  if (!wasFullscreenBefore && document.documentElement.requestFullscreen) {
    try {
      await document.documentElement.requestFullscreen();
    } catch (err) {
      console.warn('Focus Mode: Unable to enter fullscreen:', err);
    }
  }

  injectStyle(FM_STYLE_ID, buildStyles());

  isFocusModeActive = true;
  if (focusModeButton) focusModeButton.active = true;
  document.body.classList.add(FM_CLASS_NAME);

  updateStoredTrackData();

  if (!reactRootElement) {
    reactRootElement = document.createElement('div');
    reactRootElement.id = FM_REACT_ROOT_ID;
    document.body.appendChild(reactRootElement);
  }

  controlsVisible = false;
  document.body.classList.remove(FM_CONTROLS_VISIBLE_CLASS);
  renderFocusModeUI();

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('click', handleClick);

  handleMouseMove();
}

function deactivateFocusMode(): void {
  if (!isFocusModeActive) {
    controlsVisible = false;
    if (focusModeButton) focusModeButton.active = false;
    return;
  }

  if (!wasFullscreenBefore && document.fullscreenElement && document.exitFullscreen) {
    try {
      void document.exitFullscreen();
    } catch (err) {
      console.warn('Focus Mode: Unable to exit fullscreen:', err);
    }
  }

  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('click', handleClick);
  if (visibilityTimeout) {
    clearTimeout(visibilityTimeout);
    visibilityTimeout = null;
  }

  unmountFocusModeUI();

  document.body.classList.remove(FM_CLASS_NAME);
  document.body.classList.remove(FM_CONTROLS_VISIBLE_CLASS);

  document.querySelectorAll<HTMLElement>(FM_SELECTORS.APP_CONTENT).forEach((el) => {
    el.style.opacity = '1';
    el.style.visibility = 'visible';
    el.style.pointerEvents = 'auto';
    el.style.display = '';
  });

  isFocusModeActive = false;
  controlsVisible = false;
  if (focusModeButton) focusModeButton.active = false;

  if (reactRootElement) {
    reactRootElement.remove();
    reactRootElement = null;
  }
  document.getElementById(FM_STYLE_ID)?.remove();

  latestTrackData = null;
  latestAlbumArtUrl = null;
}

// --- Playbar button ---
function addFocusModeButton(): void {
  if (!Spicetify?.Playbar?.Button) {
    console.error('Focus Mode: Spicetify.Playbar.Button not available!');
    return;
  }

  const customIconSvgContent = `
    <rect x="32" y="32" width="64" height="64" rx="4" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M32 48 L32 32 L48 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M96 48 L96 32 L80 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M32 80 L32 96 L48 96" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M96 80 L96 96 L80 96" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="64" cy="64" r="12" fill="currentColor"/>
  `;
  const finalButtonIcon = `
    <span class="${FM_PLAYBAR_ICON_WRAPPER_CLASS}" aria-hidden="true">
      <svg role="img" height="16" width="16" aria-hidden="true" viewBox="0 0 128 128" fill="currentColor" class="${FM_PLAYBAR_SVG_CLASSES}">
        ${customIconSvgContent}
      </svg>
    </span>
  `;

  focusModeButton = new Spicetify.Playbar.Button(
    FM_BUTTON_LABEL,
    finalButtonIcon,
    () => {
      if (isFocusModeActive) deactivateFocusMode();
      else void activateFocusMode();
    },
    false,
  );

  try {
    focusModeButton.register();
  } catch (e) {
    console.error('Focus Mode: Failed to register button:', e);
  }
}

// --- Main ---
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  await whenReady({ api: 'FeedbackAPI', react: true });
  while (!(Spicetify.Playbar?.Button && Spicetify.Player?.addEventListener)) {
    await sleep(100);
  }

  react = Spicetify.React;
  reactDOM = Spicetify.ReactDOM;
  const icons = Spicetify.SVGIcons as Record<string, string>;

  const ButtonIcon = (props: { icon: string; onClick: () => void; className?: string; style?: object }) => {
    const { icon, onClick, className = '', style = {} } = props;
    const svgPath = icons[icon];
    if (!svgPath) return null;
    return react.createElement(
      'button',
      { className: `focus-mode-control-button ${className}`, onClick, style: { ...FM_CONTROL_BUTTON_STYLE, ...style } },
      react.createElement('svg', {
        width: 16,
        height: 16,
        viewBox: '0 0 16 16',
        fill: 'currentColor',
        dangerouslySetInnerHTML: { __html: svgPath },
      }),
    );
  };

  const FocusPlayerControls = () => {
    const [isPlaying, setIsPlaying] = react.useState(Spicetify.Player.isPlaying());
    const [, setVolume] = react.useState(Spicetify.Player.getVolume());
    const [sliderValue, setSliderValue] = react.useState(Spicetify.Player.getVolume());
    const [dimOpacity, setDimOpacity] = react.useState(0.25);
    const [progressPercent, setProgressPercent] = react.useState(0);
    const [trackDuration, setTrackDuration] = react.useState(
      Spicetify.Player.data?.item?.duration?.milliseconds || Spicetify.Player.getDuration() || 0,
    );
    const [currentTimeString, setCurrentTimeString] = react.useState('0:00');
    const [durationString, setDurationString] = react.useState(formatTime(trackDuration));
    const [showRemainingTime, setShowRemainingTime] = react.useState(false);

    const volumeSliderRef = react.useRef(null);
    const dimSliderRef = react.useRef(null);

    const updateSliderFill = (element: HTMLElement | null, variableName: string, value: number) => {
      if (element) element.style.setProperty(variableName, `${value * 100}%`);
    };

    react.useEffect(() => updateSliderFill(volumeSliderRef.current, '--volume-percent', sliderValue), [sliderValue]);
    react.useEffect(() => updateSliderFill(dimSliderRef.current, '--dim-percent', dimOpacity), [dimOpacity]);

    react.useEffect(() => {
      volumeStateUpdater = setVolume;
      sliderValueUpdater = setSliderValue;
      dimOpacityUpdater = setDimOpacity;
      return () => {
        volumeStateUpdater = null;
        sliderValueUpdater = null;
        dimOpacityUpdater = null;
      };
    }, []);

    react.useEffect(() => {
      const updateVolumeState = (ev: AnyEvent) => {
        const data = typeof ev?.data === 'number' ? ev.data : 0;
        setVolume(data);
        setSliderValue(data);
      };
      player.addEventListener('onvolumechange', updateVolumeState);
      const initialVolume = Spicetify.Player.getVolume();
      setVolume(initialVolume);
      setSliderValue(initialVolume);
      return () => player.removeEventListener('onvolumechange', updateVolumeState);
    }, []);

    react.useEffect(() => {
      const updatePlayState = () => setIsPlaying(Spicetify.Player.isPlaying());
      player.addEventListener('onplaypause', updatePlayState);
      updatePlayState();
      return () => player.removeEventListener('onplaypause', updatePlayState);
    }, []);

    react.useEffect(() => {
      const updateProgress = (event: AnyEvent) => {
        const currentProgressMs = typeof event?.data === 'number' ? event.data : 0;
        const duration = trackDuration || Spicetify.Player.getDuration();
        if (duration > 0) {
          setProgressPercent(Math.min(1, Math.max(0, currentProgressMs / duration)));
          setCurrentTimeString(formatTime(currentProgressMs));
        }
      };
      const handleSongChangeInternal = () => {
        setTimeout(() => {
          const newDuration = Spicetify.Player.data?.item?.duration?.milliseconds || Spicetify.Player.getDuration() || 0;
          setTrackDuration(newDuration);
          setDurationString(formatTime(newDuration));
          setProgressPercent(0);
          setCurrentTimeString('0:00');
        }, 100);
      };

      const initialDuration = Spicetify.Player.data?.item?.duration?.milliseconds || Spicetify.Player.getDuration() || 0;
      setTrackDuration(initialDuration);
      setDurationString(formatTime(initialDuration));
      const initialProgress = Spicetify.Player.getProgress();
      if (initialDuration > 0) {
        setProgressPercent(Math.min(1, Math.max(0, initialProgress / initialDuration)));
        setCurrentTimeString(formatTime(initialProgress));
      }

      player.addEventListener('onprogress', updateProgress);
      player.addEventListener('songchange', handleSongChangeInternal);
      return () => {
        player.removeEventListener('onprogress', updateProgress);
        player.removeEventListener('songchange', handleSongChangeInternal);
      };
    }, []);

    react.useEffect(() => {
      const albumArt = document.getElementById(FM_ALBUM_ART_ID);
      if (albumArt) albumArt.style.opacity = String(dimOpacity);
    }, []);

    const handleVolumeChange = (event: { target: HTMLInputElement }) => {
      const newVolume = parseFloat(event.target.value);
      setSliderValue(newVolume);
      Spicetify.Player.setVolume(newVolume);
    };
    const handleDimChange = (event: { target: HTMLInputElement }) => {
      const newOpacity = parseFloat(event.target.value);
      setDimOpacity(newOpacity);
      const albumArt = document.getElementById(FM_ALBUM_ART_ID);
      if (albumArt) albumArt.style.opacity = String(newOpacity);
    };
    const handleSeekChange = (event: { target: HTMLInputElement }) => {
      const newProgressPercent = parseFloat(event.target.value);
      setProgressPercent(newProgressPercent);
      const seekToMs = newProgressPercent * trackDuration;
      setCurrentTimeString(formatTime(seekToMs));
      if (isFinite(seekToMs)) Spicetify.Player.seek(seekToMs);
    };
    const toggleTimeDisplay = () => setShowRemainingTime((prev: boolean) => !prev);

    let durationDisplayString = durationString;
    if (showRemainingTime) {
      const remainingMs = Math.max(0, trackDuration - progressPercent * trackDuration);
      durationDisplayString = '-' + formatTime(remainingMs);
    }

    return react.createElement(
      'div',
      { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '10px' } },
      react.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', width: '80%', maxWidth: '500px', gap: '8px' } },
        react.createElement(
          'span',
          { id: 'focus-mode-current-time', style: { fontSize: '0.8em', minWidth: '35px', textAlign: 'right' } },
          currentTimeString,
        ),
        react.createElement('input', {
          type: 'range',
          min: 0,
          max: 1,
          step: 0.001,
          value: progressPercent,
          onChange: handleSeekChange,
          id: 'focus-mode-progress-bar',
          style: { flexGrow: 1, cursor: 'pointer', height: '4px', '--progress-percent': `${progressPercent * 100}%` },
        }),
        react.createElement(
          'span',
          {
            id: 'focus-mode-duration',
            style: { fontSize: '0.8em', minWidth: '35px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' },
            onClick: toggleTimeDisplay,
          },
          durationDisplayString,
        ),
      ),
      react.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', width: '100%', padding: '0 20px' } },
        react.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '5px', flexBasis: '150px' } },
          react.createElement('svg', {
            width: 16,
            height: 16,
            viewBox: '0 0 16 16',
            fill: 'currentColor',
            dangerouslySetInnerHTML: { __html: icons.brightness || icons.search },
          }),
          react.createElement('input', {
            type: 'range',
            min: 0,
            max: 1,
            step: 0.01,
            value: dimOpacity,
            onChange: handleDimChange,
            ref: dimSliderRef,
            style: { flexGrow: 1, cursor: 'pointer' },
            className: 'focus-mode-dim-slider',
          }),
        ),
        react.createElement(ButtonIcon, { icon: 'skip-back', onClick: Spicetify.Player.back }),
        react.createElement(ButtonIcon, {
          icon: isPlaying ? 'pause' : 'play',
          onClick: Spicetify.Player.togglePlay,
          style: { transform: 'scale(1.1)' },
        }),
        react.createElement(ButtonIcon, { icon: 'skip-forward', onClick: Spicetify.Player.next }),
        react.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '5px', flexBasis: '150px' } },
          react.createElement('svg', {
            width: 16,
            height: 16,
            viewBox: '0 0 16 16',
            fill: 'currentColor',
            dangerouslySetInnerHTML: {
              __html:
                sliderValue > 0.5
                  ? icons.volume
                  : sliderValue > 0
                    ? icons['volume-low']
                    : icons['volume-off'],
            },
          }),
          react.createElement('input', {
            type: 'range',
            min: 0,
            max: 1,
            step: 0.01,
            value: sliderValue,
            onChange: handleVolumeChange,
            ref: volumeSliderRef,
            className: 'focus-mode-volume-slider',
          }),
        ),
      ),
    );
  };

  FocusModeUI = (props: { trackData: TrackMetadata | null; albumArtUrl: string | null }) => {
    const usableAlbumArtUrl = convertSpotifyImageUri(props.albumArtUrl);
    const title = props.trackData?.title || 'Loading...';
    const artist = props.trackData?.artist_name || '';
    const album = props.trackData?.album_title || '';

    return react.createElement(
      'div',
      { id: FM_ELEMENT_ID_PREFIX + 'content' },
      usableAlbumArtUrl && react.createElement('img', { id: FM_ALBUM_ART_ID, src: usableAlbumArtUrl, alt: 'Album Art' }),
      react.createElement('div', { id: 'fad-lyrics-plus-container', className: 'lyrics-overlay-container' }),
      react.createElement(
        'div',
        { id: FM_TRACK_INFO_ID },
        react.createElement('div', { className: 'track-title' }, title),
        react.createElement('div', { className: 'track-artist' }, artist),
        album && react.createElement('div', { className: 'track-album' }, album),
      ),
      react.createElement('div', { id: FM_PLAYER_CONTROLS_ID }, react.createElement(FocusPlayerControls, null)),
    );
  };

  // Ensure a clean state on (re)load.
  deactivateFocusMode();
  latestTrackData = null;
  latestAlbumArtUrl = null;
  hasLyrics = false;
  isLyricsViewActive = false;

  addFocusModeButton();
  player.addEventListener('songchange', handleSongChange);
  setTimeout(handleSongChange, 500);
}

void main();
