// Session Stats Extension for Spicetify
// Track session listening time, song count, and unique tracks
// Persists daily history to localStorage

(function SeshStats() {
  const STORAGE_KEY = 'sesh-stats-history';
  const SCROBBLE_THRESHOLD_MS = 30000; // 30s before counting a track
  const TOP_N_OPTIONS = [10, 25, 50];

  // Session state
  let sessionStartTime = Date.now();
  let totalPlaybackTime = 0;
  let isPlaying = false;
  let playbackStartTime = 0;
  let songCount = 0;
  let uniqueSongs = new Set();
  let songsStartedCount = 0;
  let songsCompletedOrSkippedCount = 0;
  let currentPlayingUri = null;
  let currentTrackStartTime = null;
  let currentTrackScrobbled = false;

  // History state
  let historyData = {}; // { 'YYYY-MM-DD': { playbackMs, tracks: {uri: {name,artist,album,count,ms}}, artists: {name: {count,ms}}, albums: {name: {artist,count,ms}} } }
  let flushedPlaybackMs = 0; // how much playback time has already been written to history

  // UI state
  let detailsOverlay;
  let timerInterval;
  let isOverlayVisible = false;
  let activeTab = 'session'; // 'session' | 'history'
  let historyRange = '7d'; // '7d' | '30d' | '90d' | 'all'
  let topN = 10;

  // ── Storage ──────────────────────────────────────────────────────────────

  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      historyData = raw ? JSON.parse(raw) : {};
    } catch (e) {
      historyData = {};
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(historyData));
    } catch (e) {
      console.warn('SeshStats: localStorage save failed', e);
    }
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function ensureToday() {
    const key = todayKey();
    if (!historyData[key]) {
      historyData[key] = { playbackMs: 0, tracks: {}, artists: {}, albums: {} };
    }
    return key;
  }

  function flushSessionToHistory() {
    const current = getCurrentPlaybackTime();
    const delta = current - flushedPlaybackMs;
    if (delta <= 0) return;
    const key = ensureToday();
    historyData[key].playbackMs += delta;
    flushedPlaybackMs = current;
    saveHistory();
  }

  function recordScrobble(meta) {
    const key = ensureToday();
    const day = historyData[key];

    // Track
    if (!day.tracks[meta.uri]) {
      day.tracks[meta.uri] = { name: meta.name, artist: meta.artist, album: meta.album, imageUrl: meta.imageUrl || null, count: 0, ms: 0 };
    }
    if (meta.imageUrl && !day.tracks[meta.uri].imageUrl) day.tracks[meta.uri].imageUrl = meta.imageUrl;
    day.tracks[meta.uri].count++;
    day.tracks[meta.uri].ms += meta.durationMs || 0;

    // Artist — key by URI if available, else name
    if (meta.artist) {
      const artistKey = meta.artistUri || meta.artist;
      if (!day.artists[artistKey]) day.artists[artistKey] = { name: meta.artist, uri: meta.artistUri || null, imageUrl: meta.imageUrl || null, count: 0, ms: 0 };
      if (meta.imageUrl && !day.artists[artistKey].imageUrl) day.artists[artistKey].imageUrl = meta.imageUrl;
      day.artists[artistKey].count++;
      day.artists[artistKey].ms += meta.durationMs || 0;
    }

    // Album — key by URI if available, else name
    if (meta.album) {
      const albumKey = meta.albumUri || meta.album;
      if (!day.albums[albumKey]) day.albums[albumKey] = { name: meta.album, uri: meta.albumUri || null, artist: meta.artist, imageUrl: meta.imageUrl || null, count: 0, ms: 0 };
      if (meta.imageUrl && !day.albums[albumKey].imageUrl) day.albums[albumKey].imageUrl = meta.imageUrl;
      day.albums[albumKey].count++;
      day.albums[albumKey].ms += meta.durationMs || 0;
    }

    saveHistory();
  }

  // ── Aggregation ───────────────────────────────────────────────────────────

  function getDaysInRange(range) {
    const now = new Date();
    const cutoff = new Date();
    if (range === '7d') cutoff.setDate(now.getDate() - 7);
    else if (range === '30d') cutoff.setDate(now.getDate() - 30);
    else if (range === '90d') cutoff.setDate(now.getDate() - 90);
    else return null; // 'all'
    return cutoff.toISOString().slice(0, 10);
  }

  function aggregateHistory(range) {
    const cutoff = getDaysInRange(range);
    const agg = { playbackMs: 0, tracks: {}, artists: {}, albums: {}, dayCount: 0 };

    for (const [day, data] of Object.entries(historyData)) {
      if (cutoff && day < cutoff) continue;
      agg.playbackMs += data.playbackMs || 0;
      agg.dayCount++;

      for (const [uri, t] of Object.entries(data.tracks || {})) {
        if (!agg.tracks[uri]) agg.tracks[uri] = { name: t.name, artist: t.artist, album: t.album, imageUrl: t.imageUrl || null, count: 0, ms: 0 };
        if (t.imageUrl && !agg.tracks[uri].imageUrl) agg.tracks[uri].imageUrl = t.imageUrl;
        agg.tracks[uri].count += t.count;
        agg.tracks[uri].ms += t.ms;
      }
      for (const [key, a] of Object.entries(data.artists || {})) {
        if (!agg.artists[key]) agg.artists[key] = { name: a.name || key, uri: a.uri || null, imageUrl: a.imageUrl || null, count: 0, ms: 0 };
        if (a.imageUrl && !agg.artists[key].imageUrl) agg.artists[key].imageUrl = a.imageUrl;
        agg.artists[key].count += a.count;
        agg.artists[key].ms += a.ms;
      }
      for (const [key, al] of Object.entries(data.albums || {})) {
        const displayName = (al.name && !al.name.startsWith('spotify:')) ? al.name : null;
        if (!agg.albums[key]) agg.albums[key] = { name: displayName || al.name || key, uri: al.uri || (key.startsWith('spotify:') ? key : null), artist: al.artist, imageUrl: al.imageUrl || null, count: 0, ms: 0 };
        if (!agg.albums[key].name || agg.albums[key].name.startsWith('spotify:')) {
          if (displayName) agg.albums[key].name = displayName;
        }
        if (al.imageUrl && !agg.albums[key].imageUrl) agg.albums[key].imageUrl = al.imageUrl;
        agg.albums[key].count += al.count;
        agg.albums[key].ms += al.ms;
      }
    }

    return agg;
  }

  function topN_sorted(obj, n) {
    return Object.entries(obj)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, n);
  }

  // ── Export ────────────────────────────────────────────────────────────────

  function exportJSON() {
    const blob = new Blob([JSON.stringify(historyData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sesh-stats-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Metadata helper ───────────────────────────────────────────────────────

  function getCurrentUri() {
    if (Spicetify.Player.data?.track?.uri) return Spicetify.Player.data.track.uri;
    if (Spicetify.Player.data?.item?.uri) return Spicetify.Player.data.item.uri;
    if (typeof Spicetify.Player.getTrack === 'function') return Spicetify.Player.getTrack()?.uri || null;
    return Spicetify.Platform?.PlayerAPI?.getState?.()?.item?.uri || null;
  }

  function getCurrentMeta() {
    const data = Spicetify.Player.data;
    const track = data?.track || data?.item;
    const uri = getCurrentUri();
    if (!uri) return null;
    const meta = track?.metadata || {};
    return {
      uri,
      name: meta.title || track?.name || 'Unknown',
      artist: meta.artist_name || track?.artists?.[0]?.name || 'Unknown',
      artistUri: meta.artist_uri || track?.artists?.[0]?.uri || null,
      album: meta.album_title || track?.album?.name || 'Unknown',
      albumUri: meta.album_uri || track?.album?.uri || null,
      imageUrl: meta.image_url || meta.image_large_url || meta.image_xlarge_url || null,
      durationMs: parseInt(meta.duration, 10) || track?.duration?.milliseconds || 0,
    };
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  function onPlayStart() {
    if (!isPlaying) {
      isPlaying = true;
      playbackStartTime = Date.now();
      if (currentTrackStartTime === null) currentTrackStartTime = Date.now();
    }
  }

  function onPlayPause() {
    if (isPlaying) {
      isPlaying = false;
      totalPlaybackTime += Date.now() - playbackStartTime;
      checkScrobble();
    }
  }

  function checkScrobble() {
    if (currentTrackScrobbled || !currentPlayingUri || currentTrackStartTime === null) return;
    const elapsed = Date.now() - currentTrackStartTime;
    if (elapsed >= SCROBBLE_THRESHOLD_MS) {
      const meta = getCurrentMeta();
      if (meta) {
        recordScrobble(meta);
        currentTrackScrobbled = true;
        uniqueSongs.add(currentPlayingUri);
      }
    }
  }

  function onSongChange() {
    songCount++;
    songsStartedCount = songCount;

    const trackUri = getCurrentUri();
    if (!trackUri) return;

    if (currentPlayingUri && currentPlayingUri !== trackUri) {
      songsCompletedOrSkippedCount++;
      checkScrobble();
    }

    currentPlayingUri = trackUri;
    currentTrackStartTime = Date.now();
    currentTrackScrobbled = false;

    if (isOverlayVisible) updateDetailsOverlay();
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  async function init() {
    while (!Spicetify || !Spicetify.Player || !Spicetify.Platform) {
      await new Promise(r => setTimeout(r, 100));
    }

    loadHistory();
    addStyles();
    injectPlayTimeButton();
    createDetailsOverlay();
    setupEventListeners();

    // Capture track already playing at load time
    const uri = getCurrentUri();
    if (uri) {
      currentPlayingUri = uri;
      currentTrackStartTime = Date.now();
      if (Spicetify.Player.isPlaying()) {
        isPlaying = true;
        playbackStartTime = Date.now();
      }
    }

    timerInterval = setInterval(onTick, 1000);
    setInterval(flushSessionToHistory, 60000);

    // Flush on page unload
    window.addEventListener('beforeunload', flushSessionToHistory);
  }

  function setupEventListeners() {
    Spicetify.Player.addEventListener('onplaypause', () => {
      Spicetify.Player.isPlaying() ? onPlayStart() : onPlayPause();
    });
    Spicetify.Player.addEventListener('songchange', onSongChange);
  }

  function onTick() {
    checkScrobble();
    if (isOverlayVisible) updateTimersInPlace();
  }

  function updateTimersInPlace() {
    const pb = detailsOverlay.querySelector('#sesh-playback-time');
    const sd = detailsOverlay.querySelector('#sesh-session-duration');
    if (pb) pb.textContent = formatTime(getCurrentPlaybackTime());
    if (sd) sd.textContent = formatTime(Date.now() - sessionStartTime);
  }

  // ── Formatting ────────────────────────────────────────────────────────────

  function formatTime(ms) {
    const s = Math.floor((ms / 1000) % 60);
    const m = Math.floor((ms / 60000) % 60);
    const h = Math.floor(ms / 3600000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function formatTimeShort(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function getCurrentPlaybackTime() {
    let total = totalPlaybackTime;
    try {
      if (isPlaying && Spicetify.Player.isPlaying()) total += Date.now() - playbackStartTime;
    } catch (e) {}
    return total;
  }

  // ── Styles ────────────────────────────────────────────────────────────────

  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* ── Backdrop ── */
      #sesh-stats-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.75);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        z-index: 9998;
        display: none;
        animation: seshFadeIn 0.25s ease;
      }
      #sesh-stats-backdrop.visible { display: block; }
      @keyframes seshFadeIn {
        from { opacity: 0; } to { opacity: 1; }
      }

      /* ── Panel ── */
      #sesh-stats-overlay {
        position: fixed;
        bottom: 90px;
        left: 50%;
        transform: translateX(-50%);
        width: 80%;
        height: 80vh;
        background: var(--spice-card);
        border-radius: 16px;
        color: var(--spice-text);
        font-size: 13px;
        z-index: 9999;
        box-shadow: 0 24px 64px rgba(0,0,0,0.8);
        display: none;
        overflow: hidden;
        box-sizing: border-box;
        flex-direction: column;
      }
      #sesh-stats-overlay.visible {
        display: flex;
        animation: seshSlideUp 0.25s cubic-bezier(0.16,1,0.3,1);
      }
      @keyframes seshSlideUp {
        from { opacity: 0; transform: translateX(-50%) translateY(24px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
      }

      /* ── Hero (now playing) ── */
      #sesh-hero {
        position: relative;
        display: flex;
        align-items: center;
        gap: 20px;
        padding: 24px 24px 20px;
        flex-shrink: 0;
        overflow: hidden;
      }
      #sesh-hero-bg {
        position: absolute;
        inset: 0;
        background-size: cover;
        background-position: center;
        filter: blur(40px) brightness(0.35) saturate(1.4);
        transform: scale(1.2);
        z-index: 0;
      }
      #sesh-hero > * { position: relative; z-index: 1; }
      #sesh-hero-art {
        width: 80px;
        height: 80px;
        border-radius: 6px;
        object-fit: cover;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        flex-shrink: 0;
        background: var(--spice-button-disabled);
        transition: opacity 0.15s;
      }
      #sesh-hero-art.sesh-hero-link { cursor: pointer; }
      #sesh-hero-art.sesh-hero-link:hover { opacity: 0.8; }
      #sesh-hero-info { flex: 1; min-width: 0; }
      #sesh-hero-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: rgba(255,255,255,0.5);
        margin-bottom: 4px;
      }
      #sesh-hero-track {
        font-size: 20px;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #fff;
      }
      #sesh-hero-artist {
        font-size: 13px;
        color: rgba(255,255,255,0.65);
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sesh-hero-link {
        cursor: pointer;
        transition: opacity 0.15s;
      }
      .sesh-hero-link:hover { opacity: 0.75; text-decoration: underline; }
      #sesh-hero-close {
        background: rgba(255,255,255,0.1);
        border: none;
        color: rgba(255,255,255,0.7);
        cursor: pointer;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all 0.15s;
        align-self: flex-start;
      }
      #sesh-hero-close:hover { background: rgba(255,255,255,0.2); color: #fff; }

      /* ── Body (scrollable) ── */
      #sesh-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px 24px 24px;
      }

      #sesh-stats-overlay h2 {
        margin: 0 0 16px 0;
        font-size: 18px;
        font-weight: 700;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .sesh-tabs {
        display: flex;
        gap: 4px;
        margin-bottom: 16px;
        border-bottom: 1px solid var(--spice-button-disabled);
        padding-bottom: 8px;
      }
      .sesh-tab {
        background: none;
        border: none;
        color: var(--spice-subtext);
        cursor: pointer;
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
        transition: all 0.15s;
      }
      .sesh-tab.active {
        background: var(--spice-button);
        color: var(--spice-text);
      }
      .sesh-tab:hover:not(.active) {
        background: var(--spice-button-disabled);
        color: var(--spice-text);
      }
      .sesh-controls {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }
      .sesh-select {
        background: var(--spice-button-disabled);
        border: none;
        color: var(--spice-text);
        padding: 5px 10px;
        border-radius: 20px;
        font-size: 12px;
        cursor: pointer;
        outline: none;
      }
      .sesh-btn-export {
        background: none;
        border: 1px solid var(--spice-button-disabled);
        color: var(--spice-subtext);
        padding: 5px 12px;
        border-radius: 20px;
        font-size: 12px;
        cursor: pointer;
        margin-left: auto;
        transition: all 0.15s;
      }
      .sesh-btn-export:hover {
        border-color: var(--spice-text);
        color: var(--spice-text);
      }
      .sesh-btn-clear {
        background: none;
        border: 1px solid var(--spice-button-disabled);
        color: var(--spice-subtext);
        padding: 5px 12px;
        border-radius: 20px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .sesh-btn-clear:hover {
        border-color: #e24;
        color: #e24;
      }
      .sesh-btn-clear.confirming {
        border-color: #e24;
        color: #fff;
        background: #e24;
      }
      .sesh-clear-confirm {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
      }
      .sesh-clear-confirm button {
        background: none;
        border: 1px solid currentColor;
        border-radius: 12px;
        padding: 3px 10px;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .sesh-clear-yes {
        color: #e24;
      }
      .sesh-clear-yes:hover {
        background: #e24 !important;
        color: #fff !important;
      }
      .sesh-clear-no {
        color: var(--spice-subtext);
      }
      .sesh-clear-no:hover {
        background: var(--spice-button-disabled) !important;
        color: var(--spice-text) !important;
      }
      .sesh-summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 12px;
        margin-bottom: 20px;
      }
      .sesh-summary-card {
        background: var(--spice-button-disabled);
        border-radius: 8px;
        padding: 12px;
        text-align: center;
      }
      .sesh-summary-card .val {
        font-size: 20px;
        font-weight: 700;
        display: block;
      }
      .sesh-summary-card .lbl {
        font-size: 11px;
        color: var(--spice-subtext);
        margin-top: 2px;
        display: block;
      }
      .sesh-top-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 16px;
      }
      @media (max-width: 600px) {
        .sesh-top-grid { grid-template-columns: 1fr; }
      }
      .sesh-top-section h4 {
        margin: 0 0 8px 0;
        font-size: 13px;
        font-weight: 700;
        color: var(--spice-subtext);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .sesh-top-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .sesh-top-list li {
        display: flex;
        align-items: center;
        padding: 5px 0;
        border-bottom: 1px solid var(--spice-button-disabled);
        gap: 8px;
      }
      .sesh-top-list li:last-child { border-bottom: none; }
      .sesh-top-list .rank {
        color: var(--spice-subtext);
        font-size: 11px;
        min-width: 16px;
      }
      .sesh-top-list .name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 12px;
      }
      .sesh-top-list .sub {
        font-size: 11px;
        color: var(--spice-subtext);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sesh-top-list .cnt {
        font-size: 11px;
        color: var(--spice-subtext);
        white-space: nowrap;
        margin-left: auto;
      }
      .sesh-art {
        width: 36px;
        height: 36px;
        border-radius: 3px;
        object-fit: cover;
        flex-shrink: 0;
        background: var(--spice-button-disabled);
      }
      .sesh-art-placeholder {
        width: 36px;
        height: 36px;
        border-radius: 3px;
        flex-shrink: 0;
        background: var(--spice-button-disabled);
      }
      .sesh-name-stack {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }
      #sesh-stats-close {
        background: none;
        border: none;
        color: var(--spice-text);
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
        padding: 0 4px;
        opacity: 0.6;
        transition: opacity 0.15s;
      }
      #sesh-stats-close:hover { opacity: 1; }
      .sesh-stats-button {
        background: none !important;
        border: none !important;
        color: var(--spice-text) !important;
        cursor: pointer !important;
        opacity: 0.7 !important;
        padding: 0 8px !important;
        transition: opacity 0.2s ease !important;
        height: 32px !important;
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
      }
      .sesh-stats-button:hover { opacity: 1 !important; }

      /* ── Equalizer icon ── */
      .sesh-eq {
        display: flex;
        align-items: flex-end;
        gap: 2px;
        height: 14px;
      }
      .sesh-eq span {
        display: block;
        width: 3px;
        border-radius: 1px;
        background: currentColor;
        transform-origin: bottom;
      }
      .sesh-eq span:nth-child(1) { height: 40%; animation: seshBar1 0.9s ease-in-out infinite alternate; }
      .sesh-eq span:nth-child(2) { height: 90%; animation: seshBar2 0.7s ease-in-out infinite alternate; }
      .sesh-eq span:nth-child(3) { height: 60%; animation: seshBar3 1.1s ease-in-out infinite alternate; }
      .sesh-eq span:nth-child(4) { height: 75%; animation: seshBar1 0.8s ease-in-out infinite alternate; }
      .sesh-eq.paused span { animation-play-state: paused !important; }
      @keyframes seshBar1 { from { transform: scaleY(0.3); } to { transform: scaleY(1); } }
      @keyframes seshBar2 { from { transform: scaleY(0.5); } to { transform: scaleY(1); } }
      @keyframes seshBar3 { from { transform: scaleY(0.2); } to { transform: scaleY(0.9); } }
      .sesh-empty {
        color: var(--spice-subtext);
        font-size: 12px;
        padding: 8px 0;
        font-style: italic;
      }
      .sesh-link {
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 2px;
        text-decoration-color: transparent;
        transition: text-decoration-color 0.15s, color 0.15s;
      }
      .sesh-link:hover {
        color: var(--spice-button-active, #1db954);
        text-decoration-color: currentColor;
      }
    `;
    document.head.appendChild(style);
  }

  // ── Button ────────────────────────────────────────────────────────────────

  function injectPlayTimeButton() {
    if (document.readyState !== 'complete') { setTimeout(injectPlayTimeButton, 300); return; }
    const inject = () => {
      const extraControls = document.querySelector('.main-nowPlayingBar-extraControls');
      if (!extraControls) { setTimeout(inject, 300); return; }

      const container = document.createElement('div');
      container.id = 'sesh-stats-container';
      container.style.cssText = 'display:inline-flex;align-items:center;';

      const btn = document.createElement('button');
      btn.className = 'sesh-stats-button Button-sc-1dqy6lx-0 Button-buttonTertiary-small-iconOnly-useBrowserDefaultFocusStyle';
      btn.setAttribute('aria-label', 'Session Stats');
      btn.title = 'Session Stats';
      btn.onclick = toggleDetailsOverlay;
      btn.innerHTML = `
        <span class="sesh-eq${isPlaying ? '' : ' paused'}" id="sesh-eq-icon">
          <span></span><span></span><span></span><span></span>
        </span>`;

      // Keep eq animation in sync with play state
      setInterval(() => {
        const eq = btn.querySelector('#sesh-eq-icon');
        if (eq) eq.classList.toggle('paused', !isPlaying);
      }, 500);

      container.appendChild(btn);
      extraControls.insertBefore(container, extraControls.firstChild);
    };
    inject();
  }

  // ── Overlay ───────────────────────────────────────────────────────────────

  function createDetailsOverlay() {
    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'sesh-stats-backdrop';
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', hideDetailsOverlay);

    detailsOverlay = document.createElement('div');
    detailsOverlay.id = 'sesh-stats-overlay';
    updateDetailsOverlay();
    document.body.appendChild(detailsOverlay);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isOverlayVisible) hideDetailsOverlay();
    });
  }

  function updateDetailsOverlay() {
    if (!detailsOverlay) return;
    detailsOverlay.innerHTML = buildOverlayHTML();
    detailsOverlay.querySelector('#sesh-hero-close')?.addEventListener('click', hideDetailsOverlay);

    detailsOverlay.querySelectorAll('.sesh-hero-link').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        navigateToUri(el.dataset.uri);
        hideDetailsOverlay();
      });
    });

    // Tab buttons
    detailsOverlay.querySelectorAll('.sesh-tab').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        activeTab = btn.dataset.tab;
        updateDetailsOverlay();
      });
    });

    // History controls
    const rangeEl = detailsOverlay.querySelector('#sesh-range');
    if (rangeEl) rangeEl.addEventListener('change', e => { e.stopPropagation(); historyRange = e.target.value; updateDetailsOverlay(); });

    const topNEl = detailsOverlay.querySelector('#sesh-topn');
    if (topNEl) topNEl.addEventListener('change', e => { e.stopPropagation(); topN = parseInt(e.target.value, 10); updateDetailsOverlay(); });

    detailsOverlay.querySelector('#sesh-export')?.addEventListener('click', e => { e.stopPropagation(); exportJSON(); });

    const wireClearBtn = () => {
      const btn = detailsOverlay.querySelector('#sesh-clear');
      if (!btn) return;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const wrap = detailsOverlay.querySelector('#sesh-clear-wrap');
        if (!wrap) return;
        wrap.innerHTML = `
          <span class="sesh-clear-confirm">
            <span style="color:var(--spice-subtext)">Clear all history?</span>
            <button class="sesh-clear-yes">Yes, clear</button>
            <button class="sesh-clear-no">Cancel</button>
          </span>`;
        wrap.querySelector('.sesh-clear-yes').addEventListener('click', ev => {
          ev.stopPropagation();
          seshStatsReset();
          updateDetailsOverlay();
        });
        wrap.querySelector('.sesh-clear-no').addEventListener('click', ev => {
          ev.stopPropagation();
          wrap.innerHTML = '<button id="sesh-clear" class="sesh-btn-clear">Clear Stats</button>';
          wireClearBtn();
        });
        setTimeout(() => {
          if (wrap.querySelector('.sesh-clear-confirm')) {
            wrap.innerHTML = '<button id="sesh-clear" class="sesh-btn-clear">Clear Stats</button>';
            wireClearBtn();
          }
        }, 5000);
      });
    };
    wireClearBtn();

    // Navigation links
    detailsOverlay.querySelectorAll('.sesh-link').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        navigateToUri(el.dataset.uri);
        hideDetailsOverlay();
      });
    });
  }

  function buildOverlayHTML() {
    const meta = getCurrentMeta();
    const imageUrl = meta?.imageUrl || '';
    const trackName = meta ? escHtml(meta.name) : 'Nothing playing';
    const artistName = meta ? escHtml(meta.artist) : '';
    const tabSession = activeTab === 'session' ? 'active' : '';
    const tabHistory = activeTab === 'history' ? 'active' : '';

    return `
      <div id="sesh-hero">
        <div id="sesh-hero-bg" style="background-image:url('${escHtml(imageUrl)}')"></div>
        ${imageUrl
          ? `<img id="sesh-hero-art" src="${escHtml(imageUrl)}" alt="" ${meta?.uri ? `class="sesh-hero-link" data-uri="${meta.uri}"` : ''}>`
          : '<div id="sesh-hero-art"></div>'}
        <div id="sesh-hero-info">
          <div id="sesh-hero-label">Now Playing</div>
          <div id="sesh-hero-track" ${meta?.uri ? `class="sesh-hero-link" data-uri="${meta.uri}"` : ''}>${trackName}</div>
          <div id="sesh-hero-artist" ${meta?.artistUri ? `class="sesh-hero-link" data-uri="${meta.artistUri}"` : ''}>${artistName}</div>
        </div>
        <button id="sesh-hero-close" aria-label="Close">×</button>
      </div>
      <div id="sesh-body">
        <div class="sesh-tabs">
          <button class="sesh-tab ${tabSession}" data-tab="session">This Session</button>
          <button class="sesh-tab ${tabHistory}" data-tab="history">History</button>
        </div>
        ${activeTab === 'session' ? buildSessionHTML() : buildHistoryHTML()}
      </div>
    `;
  }

  function buildSessionHTML() {
    const playbackMs = getCurrentPlaybackTime();
    const sessionMs = Date.now() - sessionStartTime;
    return `
      <div class="sesh-summary">
        <div class="sesh-summary-card"><span class="val" id="sesh-playback-time">${formatTime(playbackMs)}</span><span class="lbl">Playback Time</span></div>
        <div class="sesh-summary-card"><span class="val" id="sesh-session-duration">${formatTime(sessionMs)}</span><span class="lbl">Session Duration</span></div>
        <div class="sesh-summary-card"><span class="val">${songsStartedCount}</span><span class="lbl">Tracks Started</span></div>
        <div class="sesh-summary-card"><span class="val">${songsCompletedOrSkippedCount}</span><span class="lbl">Tracks Finished/Skipped</span></div>
        <div class="sesh-summary-card"><span class="val">${uniqueSongs.size}</span><span class="lbl">Unique Tracks (30s+)</span></div>
      </div>
    `;
  }

  function buildHistoryHTML() {
    const agg = aggregateHistory(historyRange);
    const tracks = topN_sorted(agg.tracks, topN);
    const artists = topN_sorted(agg.artists, topN);
    const albums = topN_sorted(agg.albums, topN);
    const hasData = agg.dayCount > 0;

    const rangeOpts = [
      ['7d','Last 7 days'], ['30d','Last 30 days'], ['90d','Last 90 days'], ['all','All time']
    ].map(([v, l]) => `<option value="${v}" ${historyRange === v ? 'selected' : ''}>${l}</option>`).join('');

    const topNOpts = TOP_N_OPTIONS.map(n =>
      `<option value="${n}" ${topN === n ? 'selected' : ''}>${n}</option>`
    ).join('');

    const summaryCards = hasData ? `
      <div class="sesh-summary">
        <div class="sesh-summary-card"><span class="val">${formatTimeShort(agg.playbackMs)}</span><span class="lbl">Playback Time</span></div>
        <div class="sesh-summary-card"><span class="val">${agg.dayCount}</span><span class="lbl">Days</span></div>
        <div class="sesh-summary-card"><span class="val">${Object.keys(agg.tracks).length}</span><span class="lbl">Unique Tracks</span></div>
        <div class="sesh-summary-card"><span class="val">${Object.keys(agg.artists).length}</span><span class="lbl">Artists</span></div>
        <div class="sesh-summary-card"><span class="val">${Object.keys(agg.albums).length}</span><span class="lbl">Albums</span></div>
      </div>
    ` : '<p class="sesh-empty">No history yet — stats save after 30s of playback.</p>';

    const topGrid = hasData ? `
      <div class="sesh-top-grid">
        <div class="sesh-top-section">
          <h4>Top Tracks</h4>
          ${buildTrackList(tracks)}
        </div>
        <div class="sesh-top-section">
          <h4>Top Artists</h4>
          ${buildArtistList(artists)}
        </div>
        <div class="sesh-top-section">
          <h4>Top Albums</h4>
          ${buildAlbumList(albums)}
        </div>
      </div>
    ` : '';

    return `
      <div class="sesh-controls">
        <select id="sesh-range" class="sesh-select">${rangeOpts}</select>
        <label style="font-size:12px;color:var(--spice-subtext)">Top</label>
        <select id="sesh-topn" class="sesh-select">${topNOpts}</select>
        <button id="sesh-export" class="sesh-btn-export">Export JSON</button>
        <div id="sesh-clear-wrap">
          <button id="sesh-clear" class="sesh-btn-clear">Clear Stats</button>
        </div>
      </div>
      ${summaryCards}
      ${topGrid}
    `;
  }

  function navigateToUri(uri) {
    if (!uri) return;
    try {
      // e.g. spotify:track:ID or spotify:album:ID
      const parts = uri.split(':');
      if (parts.length >= 3) Spicetify.Platform.History.push(`/${parts[1]}/${parts[2]}`);
    } catch (e) {}
  }

  function artImg(imageUrl, rounded) {
    if (imageUrl) return `<img class="sesh-art" src="${escHtml(imageUrl)}" style="${rounded ? 'border-radius:50%' : ''}" alt="">`;
    return `<span class="sesh-art-placeholder" style="${rounded ? 'border-radius:50%' : ''}"></span>`;
  }

  function buildTrackList(entries) {
    if (!entries.length) return '<p class="sesh-empty">Nothing yet.</p>';
    const items = entries.map(([uri, t], i) => `
      <li>
        <span class="rank">${i + 1}</span>
        ${artImg(t.imageUrl, false)}
        <span class="sesh-name-stack">
          <span class="name sesh-link" data-uri="${uri}" title="${escHtml(t.name)}">${escHtml(t.name)}</span>
          <span class="sub" title="${escHtml(t.artist)}">${escHtml(t.artist)}</span>
        </span>
        <span class="cnt">${t.count}×</span>
      </li>
    `).join('');
    return `<ul class="sesh-top-list">${items}</ul>`;
  }

  function buildArtistList(entries) {
    if (!entries.length) return '<p class="sesh-empty">Nothing yet.</p>';
    const items = entries.map(([key, a], i) => {
      const name = a.name || key;
      const linkAttr = a.uri ? ` data-uri="${a.uri}"` : '';
      const cls = a.uri ? ' sesh-link' : '';
      return `
        <li>
          <span class="rank">${i + 1}</span>
          ${artImg(a.imageUrl, true)}
          <span class="sesh-name-stack">
            <span class="name${cls}"${linkAttr} title="${escHtml(name)}">${escHtml(name)}</span>
          </span>
          <span class="cnt">${a.count}×</span>
        </li>
      `;
    }).join('');
    return `<ul class="sesh-top-list">${items}</ul>`;
  }

  function buildAlbumList(entries) {
    if (!entries.length) return '<p class="sesh-empty">Nothing yet.</p>';
    const items = entries.map(([key, al], i) => {
      const name = (al.name && !al.name.startsWith('spotify:')) ? al.name : 'Unknown Album';
      const uri = al.uri || (key.startsWith('spotify:') ? key : null);
      const linkAttr = uri ? ` data-uri="${uri}"` : '';
      const cls = uri ? ' sesh-link' : '';
      return `
        <li>
          <span class="rank">${i + 1}</span>
          ${artImg(al.imageUrl, false)}
          <span class="sesh-name-stack">
            <span class="name${cls}"${linkAttr} title="${escHtml(name)}">${escHtml(name)}</span>
            <span class="sub" title="${escHtml(al.artist)}">${escHtml(al.artist)}</span>
          </span>
          <span class="cnt">${al.count}×</span>
        </li>
      `;
    }).join('');
    return `<ul class="sesh-top-list">${items}</ul>`;
  }

  function buildTopList(entries, getName, getSub, getUri, getCount) {
    if (!entries.length) return '<p class="sesh-empty">Nothing yet.</p>';
    const items = entries.map(([key, val], i) => {
      const name = getName([key, val]);
      const sub = getSub([key, val]);
      const uri = getUri ? getUri([key, val]) : null;
      const cls = uri ? ' sesh-link' : '';
      const uriAttr = uri ? ` data-uri="${uri}"` : '';
      return `
        <li>
          <span class="rank">${i + 1}</span>
          <span class="name${cls}"${uriAttr} title="${escHtml(name)}">${escHtml(name)}</span>
          ${sub ? `<span class="sub" title="${escHtml(sub)}">${escHtml(sub)}</span>` : ''}
          <span class="cnt">${getCount([key, val])}×</span>
        </li>
      `;
    }).join('');
    return `<ul class="sesh-top-list">${items}</ul>`;
  }

  function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function toggleDetailsOverlay() {
    isOverlayVisible ? hideDetailsOverlay() : showDetailsOverlay();
  }

  function showDetailsOverlay() {
    flushSessionToHistory();
    updateDetailsOverlay();
    detailsOverlay.classList.add('visible');
    document.getElementById('sesh-stats-backdrop')?.classList.add('visible');
    isOverlayVisible = true;
  }

  function hideDetailsOverlay() {
    detailsOverlay.classList.remove('visible');
    document.getElementById('sesh-stats-backdrop')?.classList.remove('visible');
    isOverlayVisible = false;
  }

  window.seshStatsReset = () => {
    historyData = {};
    localStorage.removeItem(STORAGE_KEY);
    console.log('SeshStats: history cleared');
  };

  init();
})();
