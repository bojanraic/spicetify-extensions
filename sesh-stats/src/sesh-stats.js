// Session Stats Extension for Spicetify
// Track session listening time, song count, and unique tracks

(function SeshStats() {
  // Variables to track session data
  let sessionStartTime = Date.now();
  let totalPlaybackTime = 0;
  let isPlaying = false;
  let playbackStartTime = 0;
  let songCount = 0; // Increments when songchange event fires
  let uniqueSongs = new Set();
  let songsStartedCount = 0; // Increments when songchange event fires (same as songCount)
  let songsCompletedOrSkippedCount = 0; // Increments when track URI changes
  let currentPlayingUri = null; // To track the currently playing song URI
  
  // Element references
  let detailsOverlay;
  let timerInterval;
  let isOverlayVisible = false;
  
  // Initialize the extension
  async function init() {
    // Wait for Spicetify to be ready
    while (!Spicetify || !Spicetify.Player || !Spicetify.Platform) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Removed the problematic initial check for isPlaying()
    // We will rely on the event listeners to capture the initial state
    
    // Add styles
    addStyles();
    
    // Create UI elements
    injectPlayTimeButton();
    createDetailsOverlay();
    
    setupEventListeners();
    
    // Start timer interval for updating the display
    timerInterval = setInterval(updateTimer, 1000);
    
    console.log("Session Stats initialized - relying on events for initial state.");
  }
  
  function addStyles() {
    const style = document.createElement("style");
    style.textContent = `
      /* Overlay styles */
      #sesh-stats-overlay {
        position: fixed;
        bottom: 52px; /* Position above the button */
        /* Position will be set by JavaScript */
        background-color: var(--spice-card);
        border-radius: 8px;
        padding: 16px;
        color: var(--spice-text);
        font-size: 14px;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        display: none;
        width: 300px;
        max-width: 90vw;
        transition: transform 0.2s ease, opacity 0.2s ease; /* Smooth transition */
        transform-origin: bottom center;
      }
      
      #sesh-stats-overlay.visible {
        display: block;
        animation: slideUp 0.2s ease;
      }
      
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(10px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      
      #sesh-stats-overlay h3 {
        margin: 0 0 12px 0;
        font-size: 16px;
        font-weight: 700;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      #sesh-stats-close {
        background: none;
        border: none;
        color: var(--spice-text);
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        transition: background-color 0.2s ease;
      }
      
      #sesh-stats-close:hover {
        background-color: var(--spice-button);
      }
      
      #sesh-stats-overlay .stat-row {
        display: flex;
        justify-content: space-between;
        margin: 8px 0;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--spice-button-disabled);
      }
      
      #sesh-stats-overlay .stat-row:last-of-type {
        border-bottom: none;
      }
      
      .sesh-stats-button {
        background: none !important;
        border: none !important;
        color: var(--spice-text) !important;
        cursor: pointer !important;
        font-size: 12px !important;
        font-weight: 400 !important;
        opacity: 0.7 !important;
        padding: 0 8px !important;
        transition: opacity 0.2s ease !important;
        height: 32px !important;
        display: flex !important;
        align-items: center !important;
      }
      
      .sesh-stats-button svg {
        width: 14px;
        height: 14px;
        margin-right: 4px;
        fill: currentColor;
        vertical-align: text-bottom; /* Align icons with text */
      }
      
      /* Fixed-width font for the timer to prevent shifting */
      #sesh-stats-time-display {
        font-family: 'Courier New', monospace;
        display: inline-block;
        min-width: 80px; /* Set a fixed minimum width */
        text-align: left;
        font-size: 14px; /* Slightly larger text */
        font-weight: bold; /* Make it bold */
      }
      
      .sesh-stats-button:hover {
        opacity: 1 !important;
      }
    `;
    document.head.appendChild(style);
  }
  
  function injectPlayTimeButton() {
    // Wait for React to be ready
    if (document.readyState !== 'complete') {
      setTimeout(injectPlayTimeButton, 300);
      return;
    }
    
    // Create a simple DOM button instead of using React
    const injectToExtraControls = () => {
      // Look for right controls bar
      const extraControls = document.querySelector('.main-nowPlayingBar-extraControls');
      
      if (!extraControls) {
        setTimeout(injectToExtraControls, 300);
        return;
      }
      
      // Create a container for our button
      const statsButtonContainer = document.createElement('div');
      statsButtonContainer.id = 'sesh-stats-container';
      statsButtonContainer.style.display = 'inline-flex';
      statsButtonContainer.style.alignItems = 'center';
      
      // Create the button directly with DOM
      // SVG Icons (Music Note & Clock)
      const playIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/></svg>';
      const clockIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-clock" viewBox="0 0 16 16"><path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71z"/><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0"/></svg>';

      const button = document.createElement('button');
      button.className = "sesh-stats-button Button-sc-1dqy6lx-0 Button-buttonTertiary-small-iconOnly-useBrowserDefaultFocusStyle e-9800-overflow-wrap-anywhere e-9800-button-tertiary--icon-only";
      button.onclick = toggleDetailsOverlay;
      button.setAttribute("aria-label", "Session Stats");
      // Set initial content with icons and time
      const initialTime = formatTime(getCurrentPlaybackTime());
      button.innerHTML = `${playIconSvg}${clockIconSvg} <span id="sesh-stats-time-display">${initialTime}</span>`;
      button.title = `Session Stats: Play Time ${initialTime} - Click for details`;
      
      // Add at the beginning of extra controls
      statsButtonContainer.appendChild(button);
      extraControls.insertBefore(statsButtonContainer, extraControls.firstChild);
      
      // Update the time display periodically
      setInterval(() => {
        const currentTime = formatTime(getCurrentPlaybackTime());
        const timeDisplayElement = button.querySelector('#sesh-stats-time-display');
        if (timeDisplayElement) {
          timeDisplayElement.textContent = currentTime;
        }
        // Update title as well
        button.title = `Session Stats: Play Time ${currentTime} - Click for details`;
      }, 1000);
    };
    
    injectToExtraControls();
  }
  
  function createDetailsOverlay() {
    detailsOverlay = document.createElement("div");
    detailsOverlay.id = "sesh-stats-overlay";
    
    updateDetailsOverlay();
    
    document.body.appendChild(detailsOverlay);
    
    // Close when clicking outside
    document.addEventListener("click", (e) => {
      if (isOverlayVisible && 
          !detailsOverlay.contains(e.target) && 
          !e.target.closest("#sesh-stats-container")) {
        hideDetailsOverlay();
      }
    });
    
    // Escape key to close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOverlayVisible) {
        hideDetailsOverlay();
      }
    });
  }
  
  function updateDetailsOverlay() {
    if (!detailsOverlay) return;
    
    console.log(`SeshStats: Updating overlay. Started: ${songsStartedCount}, Completed/Skipped: ${songsCompletedOrSkippedCount}, Unique: ${uniqueSongs.size}`);
    
    // Calculate session duration
    const sessionDuration = Date.now() - sessionStartTime;
    
    // Update the overlay content - simplified
    detailsOverlay.innerHTML = `
      <h3>
        <span>Session Stats</span>
        <button id="sesh-stats-close" aria-label="Close">×</button>
      </h3>
      <div class="stat-row">
        <span>Session Duration:</span>
        <span>${formatTime(sessionDuration)}</span>
      </div>
      <div class="stat-row">
        <span>Playback Time:</span>
        <span>${formatTime(getCurrentPlaybackTime())}</span>
      </div>
      <div class="stat-row">
        <span>Songs Started:</span> 
        <span>${songsStartedCount}</span> 
      </div>
      <div class="stat-row">
        <span>Songs Completed/Skipped:</span>
        <span>${songsCompletedOrSkippedCount}</span>
      </div>
      <div class="stat-row">
        <span>Unique Tracks Played:</span>
        <span>${uniqueSongs.size}</span>
      </div>
    `;
    
    // Add close button event
    const closeButton = detailsOverlay.querySelector("#sesh-stats-close");
    if (closeButton) {
      closeButton.addEventListener("click", hideDetailsOverlay);
    }
  }
  
  function toggleDetailsOverlay() {
    if (isOverlayVisible) {
      hideDetailsOverlay();
    } else {
      showDetailsOverlay();
    }
  }
  
  function showDetailsOverlay() {
    // Update content before showing
    updateDetailsOverlay();
    // Position the overlay relative to the button
    const buttonElement = document.querySelector('#sesh-stats-container');
    if (buttonElement) {
      const buttonRect = buttonElement.getBoundingClientRect();
      const overlayElement = document.getElementById('sesh-stats-overlay');
      if (overlayElement) {
        // Center the overlay with respect to the button's center
        const buttonCenter = buttonRect.left + (buttonRect.width / 2);
        const windowWidth = window.innerWidth;
        const overlayWidth = 300; // Same as in CSS
        
        // Calculate position to center the overlay on the button
        let leftPos = buttonCenter - (overlayWidth / 2);
        const maxLeft = windowWidth - overlayWidth - 10; // 10px buffer from right edge
        
        // If it would go off-screen to the right, adjust it
        if (leftPos > maxLeft) {
          leftPos = maxLeft;
        }
        
        // Ensure it doesn't go off-screen to the left
        if (leftPos < 10) { // 10px buffer from left edge
          leftPos = 10;
        }
        
        overlayElement.style.left = `${leftPos}px`;
      }
    }
    detailsOverlay.classList.add("visible");
    isOverlayVisible = true;
  }
  
  function hideDetailsOverlay() {
    detailsOverlay.classList.remove("visible");
    isOverlayVisible = false;
  }
  
  function setupEventListeners() {
    // Listen for play/pause events
    Spicetify.Player.addEventListener("onplaypause", () => {
      if (Spicetify.Player.isPlaying()) {
        onPlayStart();
      } else {
        onPlayPause();
      }
    });
    
    // Listen for song changes
    Spicetify.Player.addEventListener("songchange", onSongChange);
  }
  
  function onPlayStart() {
    if (!isPlaying) {
      isPlaying = true;
      playbackStartTime = Date.now();
    }
  }
  
  function onPlayPause() {
    if (isPlaying) {
      isPlaying = false;
      totalPlaybackTime += Date.now() - playbackStartTime;
    }
  }
  
  function onSongChange() { // No longer needs async
    console.log("SeshStats: Song changed event fired.");
    
    // Update song count
    songCount++;
    
    // Get current track - try multiple methods
    let trackUri = null;
    
    // Method 1: Try the standard Spicetify.Player.data.track approach
    if (Spicetify.Player.data?.track?.uri) {
      trackUri = Spicetify.Player.data.track.uri;
      console.log(`SeshStats: Found track via Player.data.track: ${trackUri}`);
    }
    // Method 2: Try getting it from Spicetify.Player.data.item
    else if (Spicetify.Player.data?.item?.uri) {
      trackUri = Spicetify.Player.data.item.uri;
      console.log(`SeshStats: Found track via Player.data.item: ${trackUri}`);
    }
    // Method 3: Try the getTrack method if available
    else if (typeof Spicetify.Player.getTrack === 'function') {
      const track = Spicetify.Player.getTrack();
      if (track?.uri) {
        trackUri = track.uri;
        console.log(`SeshStats: Found track via getTrack(): ${trackUri}`);
      }
    }
    // Method 4: Try getting the metadata directly
    else if (Spicetify.Platform?.PlayerAPI?.getState?.()) {
      const state = Spicetify.Platform.PlayerAPI.getState();
      if (state?.item?.uri) {
        trackUri = state.item.uri;
        console.log(`SeshStats: Found track via Platform.PlayerAPI: ${trackUri}`);
      }
    }
    
    // Debug log available data
    console.log("SeshStats Debug:", JSON.stringify({
      hasPlayerData: !!Spicetify.Player.data,
      playerDataKeys: Spicetify.Player.data ? Object.keys(Spicetify.Player.data) : [],
      hasTrack: !!Spicetify.Player.data?.track,
      hasItem: !!Spicetify.Player.data?.item
    }));
    
    // If we couldn't get a track URI
    if (!trackUri) {
      console.log("SeshStats: No track URI found by any method");
      return;
    }
    
    // Increment songs started count
    songsStartedCount = songCount;
    console.log(`SeshStats: Songs started count: ${songsStartedCount}`);
    
    // Check if the track URI has actually changed
    if (currentPlayingUri && currentPlayingUri !== trackUri) {
        songsCompletedOrSkippedCount++;
        console.log(`SeshStats: Song completed/skipped. Count: ${songsCompletedOrSkippedCount}`);
    }
    currentPlayingUri = trackUri; // Update the currently playing URI
    
    // Add to unique songs
    uniqueSongs.add(trackUri);
    console.log(`SeshStats: Added track. Unique songs count: ${uniqueSongs.size}`);
    
    // If overlay is visible, update it
    if (isOverlayVisible) {
      updateDetailsOverlay();
    }
  }
  
  function getCurrentPlaybackTime() {
    let currentTotal = totalPlaybackTime;
    try {
      if (isPlaying && Spicetify.Player.isPlaying()) {
        currentTotal += Date.now() - playbackStartTime;
      }
    } catch (e) {
      // Ignore error if player state is not ready
    }
    return currentTotal;
  }
  
  function updateTimer() {
    // Only update overlay if visible
    if (isOverlayVisible) {
      updateDetailsOverlay();
    }
  }
  
  function formatTime(ms) {
    // Format milliseconds into HH:MM:SS
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  // Start the extension
  init();
})(); 