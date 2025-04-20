// Focus Mode - Spicetify extension
// Hides everything except album art, shows controls on mouse move, exits on click or Esc key

// --- Global Variables (Assigned in main) ---
let react = null;
let reactDOM = null;

// Constants
const FM_TIMEOUT_MS = 3000; // Time before controls fade out (milliseconds)
const FM_FADE_DURATION_MS = 500; // Duration of the fade animation (milliseconds)
const FM_CLASS_NAME = "focus-mode-active";
const FM_CONTROLS_VISIBLE_CLASS = "focus-mode-controls-visible";
const FM_ELEMENT_ID_PREFIX = "focus-mode-";
const FM_ALBUM_ART_ID = `${FM_ELEMENT_ID_PREFIX}album-art`; // Used within React component
const FM_PLAYER_CONTROLS_ID = `${FM_ELEMENT_ID_PREFIX}player-controls`; // Used within React component
const FM_TRACK_INFO_ID = `${FM_ELEMENT_ID_PREFIX}track-info`; // Used within React component
const FM_REACT_ROOT_ID = `${FM_ELEMENT_ID_PREFIX}react-root`;
const FM_BUTTON_LABEL = "Focus Mode";
const FM_SVG_ICON_CLASS = "e-9800-icon"; // Standard class for Spicetify icons

// Constants for the main Playbar button icon structure
const FM_PLAYBAR_ICON_WRAPPER_CLASS = "e-9800-button__icon-wrapper";
const FM_PLAYBAR_SVG_CLASSES = "e-9800-icon e-9800-baseline"; // Classes from example button

const FM_CONTROL_BUTTON_STYLE = {
    background: 'rgba(255, 255, 255, 0.1)', // Semi-transparent white background
    color: 'white',
    border: 'none',
    borderRadius: '50%', // Circular buttons
    padding: '8px',
    minWidth: '32px', // Ensure minimum size
    minHeight: '32px',
    width: '32px', // Explicit size
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
};

const FM_SELECTORS = {
  APP_CONTENT: "body .Root__top-bar, body .Root__nav-bar, body .Root__main-view, body .Root__now-playing-bar, body .Root__right-sidebar",
  EXTRA_ELEMENTS: ".main-nowPlayingView-section, .main-trackInfo-container, .main-trackList-trackList",
  PLAYER_CONTROLS_CENTER: ".main-nowPlayingBar-center",
};

// --- Global State (Managed outside React for simplicity in this structure) ---
let isFocusModeActive = false;
let latestTrackData = null; // Store latest track metadata 
let latestAlbumArtUrl = null; // Store latest album art *Spotify URI*
let controlsVisible = false;
let visibilityTimeout = null;
let focusModeButton = null;
let reactRootElement = null;
let wasFullscreenBefore = false; // Track fullscreen state before focus mode activated
let hasLyrics = false; // Whether the current track has lyrics available
let isLyricsViewActive = false; // Whether the lyrics split-screen view is active
let currentLyricsData = null; // To store { lines: [{ time: number, words: string }], ... }
let activeLyricIndex = -1;
let originalPath = null; // To store path before navigating to lyrics-plus

// State update callbacks (set by React components to allow external state updates)
let volumeStateUpdater = null; // Function to update volume state from outside React
let sliderValueUpdater = null; // Function to update slider visual state from outside React
let dimOpacityUpdater = null; // Function to update dim opacity state from outside React

// --- Helper Functions ---

/**
 * Converts a spotify:image: URI to a usable HTTPS URL.
 */
function convertSpotifyImageUri(spotifyUri) {
    if (!spotifyUri || !spotifyUri.startsWith("spotify:image:")) {
        return null;
    }
    const imageId = spotifyUri.substring("spotify:image:".length);
    return `https://i.scdn.co/image/${imageId}`;
}

/**
 * Creates and injects CSS for the focus mode
 */
function injectFocusModeStyles() {
  const styleId = "focus-mode-styles";
  // Returns the CSS string, does not inject directly
  return `
    /* Hide original UI when focus mode active */
    body.${FM_CLASS_NAME} ${FM_SELECTORS.APP_CONTENT} {
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
      transition: opacity ${FM_FADE_DURATION_MS}ms ease, visibility ${FM_FADE_DURATION_MS}ms ease;
    }
    body.${FM_CLASS_NAME} ${FM_SELECTORS.EXTRA_ELEMENTS} {
      display: none !important;
    }
    body.${FM_CLASS_NAME} { 
      overflow: hidden !important; 
      /* Cursor hidden globally removed */
    }

    /* Focus Mode Root Container - Initially hidden */
    #${FM_REACT_ROOT_ID} {
      display: none; /* Hidden by default */
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      z-index: 9998; 
      background-color: #000; 
      pointer-events: none; /* Initially no pointer events */
      cursor: none; /* Hide cursor only on the background element */
    }

    /* Show and enable root container only when active */
    body.${FM_CLASS_NAME} #${FM_REACT_ROOT_ID} {
        display: block;
        pointer-events: auto; /* Enable clicks on background */
    }

    /* Album Art Styling (within React component) */
    #${FM_ALBUM_ART_ID} {
      display: block;
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      object-fit: contain; 
      margin: 0; padding: 0; border: none;
    }

    /* Controls Container Styling (within React component) */
    #${FM_PLAYER_CONTROLS_ID} {
      position: absolute; 
      bottom: 0; left: 0;
      width: 100%;
      z-index: 10000; 
      background: rgba(0, 0, 0, 0.7); 
      padding: 16px 0; 
      pointer-events: auto; 
      opacity: 0; 
      transition: opacity ${FM_FADE_DURATION_MS}ms ease !important;
      display: flex; 
      justify-content: center;
      cursor: auto !important;
    }
    body.${FM_CLASS_NAME}.${FM_CONTROLS_VISIBLE_CLASS} #${FM_PLAYER_CONTROLS_ID} {
      opacity: 1 !important;
    }

    /* Track Info Container Styling (within React component) */
    #${FM_TRACK_INFO_ID} {
      position: absolute; 
      top: 0; left: 0;
      width: 100%;
      text-align: center; 
      z-index: 10000; 
      pointer-events: none; /* Let mouse events pass through by default */
      opacity: 0; 
      transition: opacity ${FM_FADE_DURATION_MS}ms ease !important;
      background: rgba(0, 0, 0, 0.7); 
      padding: 16px; 
      color: white; 
      cursor: none; /* Hide cursor by default on this layer */
    }
    /* Allow pointer events on the icon when it's shown */
    #${FM_TRACK_INFO_ID} .track-title span[title="Toggle Lyrics (L)"] {
      pointer-events: auto;
      /* Ensure the SVG icon inherits text color */
      fill: currentColor;
      width: 1em;
      height: 1em;
      display: inline-block; /* Explicitly set display */
      cursor: pointer; /* Show pointer specifically on the icon */
    }
    body.${FM_CLASS_NAME}.${FM_CONTROLS_VISIBLE_CLASS} #${FM_TRACK_INFO_ID} {
      opacity: 1 !important;
      cursor: auto !important; /* Show cursor when overlay is visible */
    }
    #${FM_TRACK_INFO_ID} .track-title {
      font-size: 1.2em; font-weight: bold;
    }
    #${FM_TRACK_INFO_ID} .track-artist {
      font-size: 1em; opacity: 0.8;
    }
    #${FM_TRACK_INFO_ID} .track-album {
      font-size: 0.9em; opacity: 0.7; font-style: italic;
    }
    
    /* Ensure cloned controls inherit necessary styles */
    #${FM_PLAYER_CONTROLS_ID} .main-nowPlayingBar-center {
        /* Add specific overrides if needed */
    }
    
    /* --- Lyrics Overlay Styles --- */
    #fad-lyrics-plus-container.lyrics-overlay-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 9999; /* Above art (9998), below controls/info (10000) */
      background: rgba(0, 0, 0, 0.7); /* Semi-transparent background */
      overflow-y: auto; /* Allow scrolling if lyrics-plus content overflows */
      pointer-events: none; /* Allow clicks through to bg/art by default */
      opacity: 0; /* Hidden by default */
      transition: opacity ${FM_FADE_DURATION_MS}ms ease;
      
      /* Assume lyrics-plus provides its own text styling (color, size, alignment) */
      /* We only provide the container */
    }
    
    /* Enable pointer events if lyrics-plus content needs interaction */
    /* This might need adjustment depending on lyrics-plus behavior */
    #fad-lyrics-plus-container.lyrics-overlay-container > * {
      pointer-events: auto; 
    }
    
    /* Show the overlay when lyrics are active */
    body.focus-mode-lyrics-active #fad-lyrics-plus-container.lyrics-overlay-container {
      opacity: 1;
    }
    
    /* Ensure Track Info and Player Controls are definitely above the lyrics */
    #${FM_TRACK_INFO_ID} { z-index: 10000; }
    #${FM_PLAYER_CONTROLS_ID} { z-index: 10000; }
    
    /* Hide lyrics-plus config button container when lyrics overlay is active */
    body.focus-mode-lyrics-active #fad-lyrics-plus-container .lyrics-config-button-container {
      display: none !important; /* Hide the element */
    }
    
    /* --- Progress Bar Styling --- */
    #focus-mode-progress-bar {
      -webkit-appearance: none; 
      appearance: none;
      /* width: 80%; */ /* Width now controlled by flex container */
      /* max-width: 500px; */ /* Max-width now controlled by flex container */
      flex-grow: 1; /* Allow input to fill space in flex container */
      height: 4px; 
      border-radius: 2px;
      cursor: pointer;
      outline: none;
      /* Use linear gradient for fill effect */
      background: linear-gradient(to right, 
          #fff var(--progress-percent, 0%), /* White fill */
          rgba(255, 255, 255, 0.3) var(--progress-percent, 0%) /* Dim background */
      );
    }
    
    /* Style the thumb (the draggable part) */
    #focus-mode-progress-bar::-webkit-slider-thumb {
      -webkit-appearance: none; 
      appearance: none;
      width: 12px; 
      height: 12px; 
      background: #fff; /* White thumb */
      border-radius: 50%;
      cursor: pointer; 
    }
    
    #focus-mode-progress-bar::-moz-range-thumb {
      width: 12px; 
      height: 12px; 
      background: #fff;
      border-radius: 50%;
      border: none;
      cursor: pointer;
    }
    
    /* Style the track/fill (requires prefixes, might not work perfectly on all browsers/themes) */
    /* This part is notoriously tricky to style consistently */
    #focus-mode-progress-bar::-webkit-slider-runnable-track {
      /* You might need specific selectors based on browser/theme */
      /* For now, rely on the thumb position */
    }
    #focus-mode-progress-bar::-moz-range-track {
      /* You might need specific selectors based on browser/theme */
      /* For now, rely on the thumb position */
    }
    
  `;
}

/**
 * Checks if lyrics are available for the current track
 * @returns {Promise<boolean>} True if lyrics are available
 */
async function checkForLyrics() {
    console.log("Focus Mode: Starting checkForLyrics...");
    try {
        if (!Spicetify.Platform || !Spicetify.Platform.PlayerAPI) {
            console.warn("Focus Mode: Lyrics API (Platform/PlayerAPI) not available");
            return false;
        }
        
        const currentTrack = Spicetify.Player.data?.item;
        if (!currentTrack || !currentTrack.uri) {
            console.warn("Focus Mode: No current track URI to check for lyrics");
            return false;
        }
        console.log("Focus Mode: Current track URI:", currentTrack.uri);
        
        // Try Spicetify.Player.getLyrics
        if (Spicetify.Player.getLyrics) {
            console.log("Focus Mode: Trying Spicetify.Player.getLyrics()...");
            try {
                const lyrics = await Spicetify.Player.getLyrics();
                const result = !!lyrics && lyrics.lines && lyrics.lines.length > 0;
                console.log("Focus Mode: Spicetify.Player.getLyrics() result:", result, "(Data:", lyrics, ")");
                if (result) return true;
            } catch (e) {
                console.warn("Focus Mode: Error using getLyrics:", e);
            }
        } else {
            console.log("Focus Mode: Spicetify.Player.getLyrics() not available.");
        }
        
        // Try Spicetify.Platform.PlayerAPI.getPlayerState
        if (Spicetify.Platform.PlayerAPI.getPlayerState) {
            console.log("Focus Mode: Trying Spicetify.Platform.PlayerAPI.getPlayerState()...");
            try {
                const state = await Spicetify.Platform.PlayerAPI.getPlayerState();
                const result = !!state?.track?.hasLyrics || !!state?.track?.lyrics;
                console.log("Focus Mode: Spicetify.Platform.PlayerAPI.getPlayerState() lyrics check result:", result, "(State:", state, ")");
                if (result) return true;
            } catch (e) {
                console.warn("Focus Mode: Error checking player state for lyrics:", e);
            }
        } else {
             console.log("Focus Mode: Spicetify.Platform.PlayerAPI.getPlayerState() not available.");
        }
        
        // Fallback - check metadata properties
        console.log("Focus Mode: Checking metadata properties as fallback...");
        const metaHasLyrics = !!(latestTrackData?.has_lyrics === "true" || 
                                latestTrackData?.lyrics === "true" || 
                                latestTrackData?.lyrics_id);
        console.log("Focus Mode: Metadata fallback check result:", metaHasLyrics, "(Metadata:", latestTrackData, ")");
        if (metaHasLyrics) return true;
                 
    } catch (e) {
        console.error("Focus Mode: Error during checkForLyrics execution:", e);
        return false;
    }
    
    console.log("Focus Mode: checkForLyrics finished, returning false.");
    return false; // Default to false if no checks succeeded
}

/**
 * Fetches the latest track data and updates the global state variables.
 */
function updateStoredTrackData() {
    const currentItem = Spicetify.Player.data?.item;
    if (!currentItem) {
        console.warn("Focus Mode: Player data item not available for update.");
        latestTrackData = null;
        latestAlbumArtUrl = null;
        hasLyrics = false;
        return;
    }

    // Log the complete Player data for debugging
    console.log("Focus Mode DEBUG: Complete Player.data:", JSON.stringify(Spicetify.Player.data, null, 2));
    console.log("Focus Mode: Player.data.item on update check:", JSON.stringify(currentItem, null, 2));

    const metadata = currentItem.metadata;
    if (!metadata) {
        console.warn("Focus Mode: Metadata missing in Player data item.");
        latestTrackData = { uri: currentItem.uri }; // Keep URI at least
        latestAlbumArtUrl = null;
        hasLyrics = false;
    } else {
        console.log("Focus Mode: Raw metadata on update check:", JSON.stringify(metadata, null, 2));
        
        // Check if Spicetify has a lyrics API
        if (Spicetify.Platform && Spicetify.Platform.PlayerAPI) {
            console.log("Focus Mode: Checking PlayerAPI for lyrics capabilities");
            console.log("Focus Mode: PlayerAPI methods:", Object.keys(Spicetify.Platform.PlayerAPI));
        }
        
        latestTrackData = metadata; // Store latest metadata
        const derivedSpotifyUri = metadata?.image_xlarge_url || metadata?.image_large_url || metadata?.image_url;
        // console.log("Focus Mode: Derived spotify URI:", derivedSpotifyUri);

        if (!derivedSpotifyUri) {
            console.warn("Focus Mode: Failed to derive spotify image URI from metadata.");
            latestAlbumArtUrl = null; 
        } else {
            latestAlbumArtUrl = derivedSpotifyUri;
            // console.log("Focus Mode: Updated stored latestAlbumArtUrl (spotify URI):", latestAlbumArtUrl);
        }
        
        // Check for lyrics after updating track data
        console.log("Focus Mode: Initiating lyrics check in updateStoredTrackData...");
        checkForLyrics().then(result => {
            hasLyrics = result;
            console.log("Focus Mode: Lyrics check completed. hasLyrics is now:", hasLyrics);
            renderFocusModeUI(); // Force UI update after lyrics check
        }).catch(err => {
            console.error("Focus Mode: Error during async lyrics check:", err);
            hasLyrics = false;
            renderFocusModeUI(); // Force UI update even on error
        });
    }
}

// --- React Components ---

const ButtonIcon = ({ icon, onClick, className = "", style = {} }) => {
    // Spicetify.SVGIcons is an object where keys are icon names and values are SVG strings
    const svgPath = Spicetify.SVGIcons[icon];
    console.log(`Focus Mode ButtonIcon: Icon key='${icon}', Retrieved SVG path data:`, svgPath);

    if (!svgPath) {
        console.warn(`Focus Mode ButtonIcon: Invalid SVG path data for icon key '${icon}'`);
        return null;
    }

    return react.createElement("button", {
        className: `focus-mode-control-button ${className}`, // Use a custom class if needed + passed class
        onClick: onClick,
        style: { ...FM_CONTROL_BUTTON_STYLE, ...style }, // Combine constant style with passed props
    }, svgPath ? 
        react.createElement("svg", { 
           width: 16, 
           height: 16, 
           viewBox: "0 0 16 16", 
           fill: "currentColor", 
           dangerouslySetInnerHTML: { __html: svgPath }
       }) : 
       // Fallback/placeholder if svgPath is invalid
       react.createElement("svg", { 
           width: 16, 
           height: 16, 
           viewBox: "0 0 16 16", 
           fill: "rgba(255, 255, 255, 0.5)" 
        }, react.createElement("path", { 
           d: "M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8z" 
       }))
    );
};

// Helper function to format time in MM:SS
function formatTime(milliseconds) {
    if (isNaN(milliseconds) || milliseconds < 0) {
        return "0:00";
    }
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

const FocusPlayerControls = () => {
    const [isPlaying, setIsPlaying] = react.useState(Spicetify.Player.isPlaying());
    const [volume, setVolume] = react.useState(Spicetify.Player.getVolume());
    const [sliderValue, setSliderValue] = react.useState(volume);
    const [dimOpacity, setDimOpacity] = react.useState(0.25);
    
    // New state for progress bar
    const [progressPercent, setProgressPercent] = react.useState(0);
    const [trackDuration, setTrackDuration] = react.useState(Spicetify.Player.data?.item?.duration?.milliseconds || Spicetify.Player.getDuration() || 0);
    
    // New state for time strings
    const [currentTimeString, setCurrentTimeString] = react.useState("0:00");
    const [durationString, setDurationString] = react.useState(formatTime(trackDuration));
    
    // New state for toggling time display
    const [showRemainingTime, setShowRemainingTime] = react.useState(false);

    // Register state updaters with global callbacks
    react.useEffect(() => {
        // Register the state updaters for external components to use
        volumeStateUpdater = setVolume;
        sliderValueUpdater = setSliderValue;
        dimOpacityUpdater = setDimOpacity;
        
        return () => {
            // Clean up when component unmounts
            volumeStateUpdater = null;
            sliderValueUpdater = null;
            dimOpacityUpdater = null;
        };
    }, []);

    // --- Volume Listener ---
    react.useEffect(() => {
        const updateVolumeState = ({ data }) => {
             console.log("Focus Controls: Volume changed externally:", data);
             setVolume(data); // Update the confirmed volume state
             setSliderValue(data); // Sync slider value with confirmed state
        };
        Spicetify.Player.addEventListener("onvolumechange", updateVolumeState);
        console.log("Focus Controls: Added volume listener.");

        // Fetch initial volume again in case it changed before listener attach
        const initialVolume = Spicetify.Player.getVolume();
        setVolume(initialVolume);
        setSliderValue(initialVolume);

        return () => {
            Spicetify.Player.removeEventListener("onvolumechange", updateVolumeState);
            console.log("Focus Controls: Removed volume listener.");
        };
    }, []);

    // --- Play/Pause Listener ---
    react.useEffect(() => {
        const updatePlayState = () => setIsPlaying(Spicetify.Player.isPlaying());
        Spicetify.Player.addEventListener("onplaypause", updatePlayState);
        console.log("Focus Controls: Added play/pause listener.");

        // Initial check in case state changed before listener attached
        updatePlayState(); // Initial check

        return () => {
            Spicetify.Player.removeEventListener("onplaypause", updatePlayState);
            console.log("Focus Controls: Removed play/pause listener.");
        };
    }, []);

    // --- Progress Listener and Song Change Handling ---
    react.useEffect(() => {
        const updateProgress = (event) => {
            if (!event || !event.data) return;
            const currentProgressMs = event.data;
            const duration = trackDuration || Spicetify.Player.getDuration(); 
            if (duration > 0) {
                const newProgressPercent = Math.min(1, Math.max(0, currentProgressMs / duration)); // Clamp between 0 and 1
                setProgressPercent(newProgressPercent);
                setCurrentTimeString(formatTime(currentProgressMs)); // Update current time string
            }
        };

        const handleSongChange = () => {
            console.log("Focus Controls: Song changed, updating duration and resetting progress.");
            setTimeout(() => {
                 const newDuration = Spicetify.Player.data?.item?.duration?.milliseconds || Spicetify.Player.getDuration() || 0;
                 setTrackDuration(newDuration);
                 setDurationString(formatTime(newDuration)); // Update duration string
                 // Reset progress and current time string
                 setProgressPercent(0); 
                 setCurrentTimeString("0:00"); 
                 console.log("Focus Controls: New track duration:", newDuration);
            }, 100); 
        };

        // Initial setup
        const initialDuration = Spicetify.Player.data?.item?.duration?.milliseconds || Spicetify.Player.getDuration() || 0;
        setTrackDuration(initialDuration);
        setDurationString(formatTime(initialDuration));
        const initialProgress = Spicetify.Player.getProgress();
        if (initialDuration > 0) {
             const initialPercent = Math.min(1, Math.max(0, initialProgress / initialDuration));
             setProgressPercent(initialPercent);
             setCurrentTimeString(formatTime(initialProgress));
        }

        // Add listeners
        Spicetify.Player.addEventListener("onprogress", updateProgress);
        Spicetify.Player.addEventListener("songchange", handleSongChange);
        console.log("Focus Controls: Added progress and songchange listeners.");

        // Cleanup
        return () => {
            Spicetify.Player.removeEventListener("onprogress", updateProgress);
            Spicetify.Player.removeEventListener("songchange", handleSongChange);
            console.log("Focus Controls: Removed progress and songchange listeners.");
        };
    }, []); // Only run on mount/unmount

    // --- Effect to set initial album art opacity ---
    react.useEffect(() => {
        const albumArt = document.getElementById(FM_ALBUM_ART_ID);
        if (albumArt) {
            console.log(`Focus Controls: Setting initial dim opacity to ${dimOpacity}`);
            albumArt.style.opacity = dimOpacity;
        }
    }, []); // Run only on mount

    // --- Event Handlers for Sliders ---
    const handleVolumeChange = (event) => {
        const newVolume = parseFloat(event.target.value);
        setSliderValue(newVolume); // Update slider visual immediately
        // setVolume(newVolume); // DO NOT update confirmed volume here
        Spicetify.Player.setVolume(newVolume); // Tell the player to change volume
    };

    const handleDimChange = (event) => {
        const newOpacity = parseFloat(event.target.value);
        setDimOpacity(newOpacity);
        const albumArt = document.getElementById(FM_ALBUM_ART_ID);
        if (albumArt) {
            albumArt.style.opacity = newOpacity;
        }
    };

    // --- Handler for Progress Bar Seeking ---
    const handleSeekChange = (event) => {
        const newProgressPercent = parseFloat(event.target.value);
        setProgressPercent(newProgressPercent); // Update visual immediately
        const seekToMs = newProgressPercent * trackDuration;
        setCurrentTimeString(formatTime(seekToMs)); // Update time string immediately on seek
        if (isFinite(seekToMs)) {
            Spicetify.Player.seek(seekToMs);
            console.log(`Focus Mode: Seeking to ${seekToMs}ms (${(newProgressPercent * 100).toFixed(1)}%)`);
        } else {
            console.warn("Focus Mode: Invalid seek value calculated.");
        }
    };

    // --- New Handler for Toggling Time Display ---
    const toggleTimeDisplay = () => {
        setShowRemainingTime(prev => !prev);
    };

    console.log(`Focus Controls: Rendering - isPlaying: ${isPlaying}, volume: ${volume}, dimOpacity: ${dimOpacity}`);

    // --- Render ---
    // Calculate duration display string based on state
    let durationDisplayString = durationString;
    if (showRemainingTime) {
        const currentProgressMs = progressPercent * trackDuration;
        const remainingMs = Math.max(0, trackDuration - currentProgressMs);
        durationDisplayString = "-" + formatTime(remainingMs);
    }

    return react.createElement("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '10px' } },
        // Progress Bar Row (Times + Slider)
        react.createElement("div", { style: { display: 'flex', alignItems: 'center', width: '80%', maxWidth: '500px', gap: '8px' } },
            // Current Time
            react.createElement("span", { id: "focus-mode-current-time", style: { fontSize: '0.8em', minWidth: '35px', textAlign: 'right' } }, currentTimeString),
            // Progress Bar Input
            react.createElement("input", {
                type: "range",
                min: 0,
                max: 1,
                step: 0.001, 
                value: progressPercent,
                onChange: handleSeekChange,
                id: "focus-mode-progress-bar", 
                style: { 
                    flexGrow: 1, // Allow bar to take available space
                    cursor: 'pointer', 
                    height: '4px',
                    // Set CSS variable for background gradient
                    '--progress-percent': `${(progressPercent * 100)}%` 
                } 
            }),
            // Duration (now clickable)
            react.createElement("span", { 
                id: "focus-mode-duration", 
                style: { 
                    fontSize: '0.8em', 
                    minWidth: '35px', 
                    textAlign: 'left', 
                    cursor: 'pointer', // Make it look clickable
                    userSelect: 'none' // Prevent text selection on click
                }, 
                onClick: toggleTimeDisplay // Add the click handler
            }, durationDisplayString) // Use the calculated display string
        ),
        
        // Existing Controls Row
        react.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', width: '100%', padding: '0 20px' } },
             // Dim Slider (Far Left)
             react.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '5px', flexBasis: '150px' } },
                // Dim Icon
                react.createElement("svg", { 
                    width: 16, height: 16, viewBox: "0 0 16 16", fill: "currentColor",
                    dangerouslySetInnerHTML: { __html: Spicetify.SVGIcons.brightness || Spicetify.SVGIcons.search }
                }),
                // Dim Input Slider
                react.createElement("input", {
                    type: "range", min: 0, max: 1, step: 0.01, value: dimOpacity,
                    onChange: handleDimChange,
                    style: { flexGrow: 1, cursor: 'pointer' }
                })
             ),
             // Playback Buttons (Center)
             react.createElement(ButtonIcon, {
                 icon: "skip-back",
                 onClick: Spicetify.Player.back,
             }),
             react.createElement(ButtonIcon, {
                 icon: isPlaying ? "pause" : "play",
                 onClick: Spicetify.Player.togglePlay,
                 style: { transform: 'scale(1.1)' } // Make play slightly larger
             }),
             react.createElement(ButtonIcon, {
                 icon: "skip-forward",
                 onClick: Spicetify.Player.next,
             }),
             // Volume Slider (Far Right)
             react.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '5px', flexBasis: '150px' } },
                 // Volume Icon
                 react.createElement("svg", { 
                     width: 16, height: 16, viewBox: "0 0 16 16", fill: "currentColor",
                     dangerouslySetInnerHTML: { __html: volume > 0.5 ? Spicetify.SVGIcons.volume : (volume > 0 ? Spicetify.SVGIcons['volume-low'] : Spicetify.SVGIcons['volume-off']) }
                 }),
                 // Volume Input Slider
                 react.createElement("input", {
                     type: "range", min: 0, max: 1, step: 0.01, value: sliderValue, 
                     onChange: handleVolumeChange,
                     style: { flexGrow: 1, cursor: 'pointer' }
                 })
             )
        )
    );
};

/**
 * Toggles the lyrics view on/off.
 */
async function toggleLyricsView() {
    console.log("Focus Mode: toggleLyricsView called. Current hasLyrics state:", hasLyrics);
    if (!hasLyrics) {
        console.warn("Focus Mode: Cannot toggle lyrics view, hasLyrics is false.");
        Spicetify.showNotification("Lyrics not available for this track.");
        return;
    }

    isLyricsViewActive = !isLyricsViewActive;
    console.log("Focus Mode: Toggling lyrics view. Active:", isLyricsViewActive);

    if (isLyricsViewActive) {
        // --- Activate Lyrics View (Integrate with lyrics-plus) ---
        
        // Store original path
        originalPath = Spicetify.Platform.History.location.pathname;
        console.log("Focus Mode: Stored original path:", originalPath);
        
        // Navigate to lyrics-plus first (if not already there)
        if (originalPath !== "/lyrics-plus") {
            console.log("Focus Mode: Navigating to /lyrics-plus...");
            Spicetify.Platform.History.push("/lyrics-plus");
        } else {
            console.log("Focus Mode: Already on /lyrics-plus path.");
        }
        
        // Wait briefly for lyrics-plus to potentially initialize after navigation
        setTimeout(() => {
            console.log("Focus Mode: Delayed activation steps starting...");
            // Add listener
            console.log("Focus Mode: Adding lyrics-plus-update listener...");
            window.addEventListener("lyrics-plus-update", handleLyricsPlusUpdate);
            
            // Dispatch event
            console.log("Focus Mode: Dispatching fad-request...");
            window.dispatchEvent(new Event("fad-request"));
            
            // Add body class
            document.body.classList.add("focus-mode-lyrics-active");
            
            // Clear any old lyrics data
            currentLyricsData = null; 
            activeLyricIndex = -1;
            
             // Render the UI *after* delay and adding listener/dispatching event
             console.log("Focus Mode: Calling renderFocusModeUI() inside timeout.");
            renderFocusModeUI(); 
            
        }, 200); // 200ms delay - adjust if needed
        
    } else {
        // --- Deactivate Lyrics View ---
        console.log("Focus Mode: Removing lyrics-plus-update listener...");
        window.removeEventListener("lyrics-plus-update", handleLyricsPlusUpdate);
        
        // Navigate back first if we changed path
        if (originalPath && originalPath !== "/lyrics-plus") {
            console.log("Focus Mode: Navigating back to original path:", originalPath);
            Spicetify.Platform.History.push(originalPath);
        } else {
            console.log("Focus Mode: Not navigating back (was already on lyrics-plus or no path stored).");
        }
        originalPath = null; // Reset stored path
        
        // Clean up state
        document.body.classList.remove("focus-mode-lyrics-active");
        currentLyricsData = null;
        activeLyricIndex = -1;
        
        // Ensure old progress listener is removed
        Spicetify.Player.removeEventListener("onprogress", handleProgressForLyrics);
        
        // Re-render the UI AFTER navigation back
        renderFocusModeUI();
    }

    // NOTE: renderFocusModeUI is now called INSIDE the timeout for activation,
    // and AFTER navigation back for deactivation.
    // Do not call it synchronously here for activation.
}

/**
 * Handles updates received from the lyrics-plus extension.
 */
function handleLyricsPlusUpdate(event) {
    // Log the entire event detail to see its structure
    console.log("Focus Mode: Received lyrics-plus-update event. Detail:", event.detail);
    
    // TODO: Extract relevant data (current line, full lyrics?) from event.detail
    // TODO: Update currentLyricsData and activeLyricIndex based on event.detail
    // TODO: Potentially call renderFocusModeUI() if state used by UI changes here
}

/**
 * Handles player progress updates for synchronized lyrics scrolling.
 * THIS FUNCTION IS NO LONGER USED FOR LYRICS - Keeping temporarily for reference/cleanup
 */
function handleProgressForLyrics(event) {
    console.warn("Focus Mode: handleProgressForLyrics called - this should no longer happen for lyrics sync.");
    // ... (keep the old code here for now, but it shouldn't be called)
}

const FocusModeUI = ({ trackData, albumArtUrl, controlsVisible }) => {
    const usableAlbumArtUrl = convertSpotifyImageUri(albumArtUrl);
    const title = trackData?.title || "Loading...";
    const artist = trackData?.artist_name || "";
    const album = trackData?.album_title || "";
    
    return react.createElement("div", { id: FM_ELEMENT_ID_PREFIX + "content" },
        
        // Always render Album Art
        usableAlbumArtUrl && react.createElement("img", { 
            id: FM_ALBUM_ART_ID, 
            src: usableAlbumArtUrl, 
            alt: "Album Art" 
        }),
        
        // Always render the container for lyrics-plus to inject into
        react.createElement("div", { 
            id: "fad-lyrics-plus-container",
            className: "lyrics-overlay-container" 
        }),
        
        // Always render Track Info Overlay
        react.createElement("div", { id: FM_TRACK_INFO_ID },
            react.createElement("div", { className: "track-title" }, 
                title
            ),
            react.createElement("div", { className: "track-artist" }, artist),
            album && react.createElement("div", { className: "track-album" }, album)
        ),
        
        // Always render Player Controls Overlay
        react.createElement("div", { id: FM_PLAYER_CONTROLS_ID }, 
            react.createElement(FocusPlayerControls, null)
        )
    );
};

// --- Rendering Logic ---

function renderFocusModeUI() {
    if (!isFocusModeActive || !reactRootElement) return;
    
    console.log(`Focus Mode: Rendering React UI. Controls visible: ${controlsVisible}`, { 
        dataForRender: { trackData: latestTrackData, albumArtUrl: latestAlbumArtUrl } 
    });
    reactDOM.render(
        react.createElement(FocusModeUI, { 
            trackData: latestTrackData, 
            albumArtUrl: latestAlbumArtUrl, 
            controlsVisible: controlsVisible 
        }),
        reactRootElement
    );
}

function unmountFocusModeUI() {
    if (reactRootElement) {
        reactDOM.unmountComponentAtNode(reactRootElement);
        console.log("Focus Mode: Unmounted React UI.");
    }
}

// --- Event Handlers ---

function handleMouseMove() {
    if (!isFocusModeActive) return;
    
    if (!controlsVisible) {
        controlsVisible = true;
        document.body.classList.add(FM_CONTROLS_VISIBLE_CLASS);
        // No need to re-render React component just for class change
    }
    
    if (visibilityTimeout) clearTimeout(visibilityTimeout);
    
    visibilityTimeout = setTimeout(() => {
        controlsVisible = false;
        document.body.classList.remove(FM_CONTROLS_VISIBLE_CLASS);
        // No need to re-render React component just for class change
        visibilityTimeout = null;
    }, FM_TIMEOUT_MS);
}

function handleKeyDown(event) {
  // Log ALL key presses reaching the listener
  console.log(`Focus Mode: KeyDown received - Key: ${event.key}, Code: ${event.code}`);
  
  if (!isFocusModeActive) return;
  
  // console.log(`Focus Mode: handleKeyDown received key: ${event.key}`);
  
  // Only process if focus mode is active
  if (isFocusModeActive) {
    switch(event.key.toLowerCase()) { // Use toLowerCase for case-insensitivity
      case "escape":
        console.log("Focus Mode: Escape key pressed, deactivating...");
        deactivateFocusMode();
        break;
      
      // Playback controls
      case " ": // Space bar
        // console.log("Focus Mode: Space key pressed, toggling play/pause...");
        Spicetify.Player.togglePlay();
        event.preventDefault(); // Prevent scrolling on space
        break;
      case "arrowleft":
        // console.log("Focus Mode: Left arrow key pressed, previous track...");
        Spicetify.Player.back();
        event.preventDefault();
        break;
      case "arrowright":
        // console.log("Focus Mode: Right arrow key pressed, next track...");
        Spicetify.Player.next();
        event.preventDefault();
        break;
        
      // Volume controls
      case "arrowup":
        // console.log("Focus Mode: Up arrow key pressed, volume up...");
        const currentVolume = Spicetify.Player.getVolume();
        const newVolume = Math.min(1, currentVolume + 0.05); // Increment by 5%, cap at 100%
        Spicetify.Player.setVolume(newVolume);
        
        // Update React state if registered
        if (volumeStateUpdater && sliderValueUpdater) {
          volumeStateUpdater(newVolume);
          sliderValueUpdater(newVolume);
          // console.log(`Focus Mode: Updated React state for volume to ${newVolume}`);
        }
        
        event.preventDefault();
        break;
      case "arrowdown":
        // console.log("Focus Mode: Down arrow key pressed, volume down...");
        const curVolume = Spicetify.Player.getVolume();
        const updatedVolume = Math.max(0, curVolume - 0.05); // Decrement by 5%, floor at 0%
        Spicetify.Player.setVolume(updatedVolume);
        
        // Update React state if registered
        if (volumeStateUpdater && sliderValueUpdater) {
          volumeStateUpdater(updatedVolume);
          sliderValueUpdater(updatedVolume);
          // console.log(`Focus Mode: Updated React state for volume to ${updatedVolume}`);
        }
        
        event.preventDefault();
        break;
        
      // Dim controls  
      case "+":
      case "=": // The + key is often the shifted = key
        // console.log("Focus Mode: '+' key pressed, increasing album art brightness...");
        handleDimAdjustment(0.05); // +5% brightness
        event.preventDefault();
        break;
      case "-":
        // console.log("Focus Mode: '-' key pressed, decreasing album art brightness...");
        handleDimAdjustment(-0.05); // -5% brightness
        event.preventDefault();
        break;
        
      // Lyrics Toggle
      case "l":
        console.log("Focus Mode: 'L' key pressed, attempting to toggle lyrics...");
        toggleLyricsView();
        event.preventDefault();
        break;
      
      default:
        // Unhandled key
        break;
    }
  }
}

// Helper function to adjust dim level from keyboard
function handleDimAdjustment(change) {
  const albumArt = document.getElementById(FM_ALBUM_ART_ID);
  if (albumArt) {
    const currentOpacity = parseFloat(albumArt.style.opacity || 0.25);
    const newOpacity = Math.max(0, Math.min(1, currentOpacity + change)); // Ensure between 0-1
    albumArt.style.opacity = newOpacity;
    
    // Update React state if registered
    if (dimOpacityUpdater) {
      dimOpacityUpdater(newOpacity);
      console.log(`Focus Mode: Updated React state for dim opacity to ${newOpacity}`);
    }
    
    console.log(`Focus Mode: Adjusted album art brightness to ${newOpacity}`);
  }
}

function handleClick(event) {
  // console.log("Focus Mode: handleClick detected on target:", event.target);
  // Check if click is outside BOTH the controls container AND the track info container, and not on the activation button
  if (isFocusModeActive && 
      !event.target.closest(`#${FM_PLAYER_CONTROLS_ID}`) &&
      !event.target.closest(`#${FM_TRACK_INFO_ID}`) && // Added this check
      focusModeButton && !focusModeButton.element.contains(event.target)) 
  {
    console.log("Focus Mode: Background click detected (outside controls/info), deactivating...");
    deactivateFocusMode();
  }
}

function handleSongChange() {
    console.log("Focus Mode: Detected songchange event.");
    // Use a small delay as data might not be instantly available
    setTimeout(() => {
        console.log(`Focus Mode: handleSongChange timeout - isFocusModeActive: ${isFocusModeActive}`);
        updateStoredTrackData();
        if (isFocusModeActive) {
            renderFocusModeUI(); // Re-render with new data
        }
    }, 100); // Slightly longer delay might be safer
}

// --- Activation / Deactivation ---

async function activateFocusMode() {
  console.log("Focus Mode: activateFocusMode() called!"); 
  if (isFocusModeActive) return;
  console.log("Focus Mode: Activating...");
  // Controls are now rendered via React, no cloning needed here.

  // Enter fullscreen if document supports it
  wasFullscreenBefore = !!document.fullscreenElement; // Store current state
  if (!wasFullscreenBefore && document.documentElement.requestFullscreen) {
    try {
      await document.documentElement.requestFullscreen();
      console.log("Focus Mode: Entered fullscreen mode");
    } catch (err) {
      console.warn("Focus Mode: Unable to enter fullscreen mode:", err);
      // Continue with focus mode regardless of fullscreen success
    }
  }

  // Inject Styles if they don't exist
  const styleId = "focus-mode-styles";
  if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = injectFocusModeStyles(); // Get CSS string
      document.head.appendChild(style);
      console.log("Focus Mode: Styles injected on activation.");
  } else {
       console.log("Focus Mode: Styles already injected.");
  }

  // 2. Set state and apply base class (hides original UI)
  isFocusModeActive = true;
  if (focusModeButton) focusModeButton.active = true;
  console.log("Focus Mode: Adding FM_CLASS_NAME to body...");
  document.body.classList.add(FM_CLASS_NAME);

  // 3. Fetch initial data
  updateStoredTrackData();
  
  // 4. Ensure React root exists
  if (!reactRootElement) {
      reactRootElement = document.createElement("div");
      reactRootElement.id = FM_REACT_ROOT_ID;
      document.body.appendChild(reactRootElement);
      console.log("Focus Mode: Created React root element.");
  } else {
       console.warn("Focus Mode: React root element already exists on activation?");
  }

  // 5. Render the UI
  controlsVisible = false; // Start with controls hidden
  document.body.classList.remove(FM_CONTROLS_VISIBLE_CLASS);
  renderFocusModeUI(); 
  
  // 6. Add event listeners
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("click", handleClick);
  
  // 7. Trigger initial mouse move to show controls briefly
  handleMouseMove();
  console.log("Focus Mode: Activated successfully.");
}

function deactivateFocusMode() {
   if (!isFocusModeActive) {
       // If deactivate is called when not active (e.g., during init), do nothing to the UI.
       console.log("Focus Mode: deactivateFocusMode called while inactive. No UI changes needed.");
       // We might still want to ensure state variables are reset, but avoid DOM manipulation.
       controlsVisible = false;
       // Keep focusModeButton state consistent if it exists
       if (focusModeButton) focusModeButton.active = false;
       return; 
   }
   console.log("Focus Mode: Deactivating...");

  // Exit fullscreen if we entered it when activating focus mode
  if (!wasFullscreenBefore && document.fullscreenElement && document.exitFullscreen) {
    try {
      document.exitFullscreen();
      console.log("Focus Mode: Exited fullscreen mode");
    } catch (err) {
      console.warn("Focus Mode: Unable to exit fullscreen mode:", err);
    }
  }

  // 1. Remove listeners first
  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("keydown", handleKeyDown);
  document.removeEventListener("click", handleClick);
  if (visibilityTimeout) {
      clearTimeout(visibilityTimeout);
      visibilityTimeout = null;
  }

  // 2. Unmount React component
  unmountFocusModeUI();

  // 3. Remove classes from body
  console.log("Focus Mode: Body classList BEFORE removal:", document.body.classList.toString());
  document.body.classList.remove(FM_CLASS_NAME);
  document.body.classList.remove(FM_CONTROLS_VISIBLE_CLASS);
  console.log("Focus Mode: Body classList AFTER removal:", document.body.classList.toString());
  
  // 4. Explicitly restore visibility of original UI elements
  try {
    document.querySelectorAll(FM_SELECTORS.APP_CONTENT).forEach(el => {
        if (el instanceof HTMLElement) {
            // console.log("Focus Mode: Resetting styles for element:", el.className);
            el.style.opacity = '1';
            el.style.visibility = 'visible';
            el.style.pointerEvents = 'auto';
            // Attempt to restore display, 'flex' is common for these root elements
            el.style.display = ''; 
        }
    });
    console.log("Focus Mode: Explicitly restored original UI element styles.");
  } catch (e) {
      console.error("Focus Mode: Error restoring original UI styles:", e);
  }

  // 5. Reset state
  isFocusModeActive = false;
  controlsVisible = false;
  if (focusModeButton) focusModeButton.active = false;

  // Remove React root element
  if (reactRootElement) {
      reactRootElement.remove();
      reactRootElement = null;
      console.log("Focus Mode: Removed React root element.");
  }

  // Remove Styles
  const styleElement = document.getElementById("focus-mode-styles");
  if (styleElement) {
      styleElement.remove();
      console.log("Focus Mode: Removed styles.");
  }

  // Ensure clean state on init/reload
  latestTrackData = null; // Reset global data state
  latestAlbumArtUrl = null;

  console.log("Focus Mode: Deactivated successfully.");
}

// --- Initialization ---

function addFocusModeButton() {
  console.log("Focus Mode: Attempting to add button...");
  if (!Spicetify?.Playbar?.Button) {
      console.error("Focus Mode Error: Spicetify.Playbar.Button is not available!");
      return;
  }
  console.log("Focus Mode: Spicetify.Playbar.Button found.");

  // Load custom icon SVG content (Paths and shapes from your icon.svg)
  const customIconSvgContent = `
    <!-- Background circle (optional, might be handled by button style) -->
    <!-- <circle cx="64" cy="64" r="60" fill="#1DB954"/> -->
    
    <!-- Album art frame -->
    <rect x="32" y="32" width="64" height="64" rx="4" fill="none" stroke="currentColor" stroke-width="2"/>
    
    <!-- Corner arrows -->
    <!-- Top-left -->
    <path d="M32 48 L32 32 L48 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    
    <!-- Top-right -->
    <path d="M96 48 L96 32 L80 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    
    <!-- Bottom-left -->
    <path d="M32 80 L32 96 L48 96" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    
    <!-- Bottom-right -->
    <path d="M96 80 L96 96 L80 96" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    
    <!-- Center focus dot -->
    <circle cx="64" cy="64" r="12" fill="currentColor"/>
  `;

  // Create the full SVG element string mimicking Spotify's structure
  const finalButtonIcon = `
    <span class="${FM_PLAYBAR_ICON_WRAPPER_CLASS}" aria-hidden="true">
      <svg 
        role="img"
        height="16"
        width="16"
        aria-hidden="true"
        viewBox="0 0 128 128" 
        fill="currentColor"
        class="${FM_PLAYBAR_SVG_CLASSES}"
      >
        ${customIconSvgContent}
      </svg>
    </span>
  `;

  focusModeButton = new Spicetify.Playbar.Button(
    FM_BUTTON_LABEL,
    finalButtonIcon, // Use the wrapped custom icon
    (self) => {
      if (isFocusModeActive) {
        deactivateFocusMode();
      } else {
        activateFocusMode();
      }
      // Active state is now handled within activate/deactivate
    },
    false // Initial state (disabled = false, active = false)
  );
  console.log("Focus Mode: Button object created.");
  
  try {
    focusModeButton.register();
    console.log("Focus Mode: Spicetify button registered successfully.");
  }
  catch (e) {
      console.error("Focus Mode Error: Failed to register button:", e);
  }
}

function main() {
    console.log("Focus Mode: Initializing (main function started)...");
    
    // Wait for ALL required Spicetify APIs
    while (
        !Spicetify?.React ||
        !Spicetify?.ReactDOM ||
        !Spicetify?.Player?.addEventListener || 
        !Spicetify?.Playbar?.Button ||
        !Spicetify?.showNotification
    ) {
        console.log("Focus Mode: Waiting for Spicetify APIs...", {
            hasReact: !!Spicetify?.React,
            hasReactDOM: !!Spicetify?.ReactDOM,
            hasPlayer: !!Spicetify?.Player?.addEventListener,
            hasPlaybar: !!Spicetify?.Playbar?.Button,
            hasNotifier: !!Spicetify?.showNotification
        });
        return setTimeout(main, 100);
    }
    console.log("Focus Mode: Spicetify APIs ready.");

    // Assign React variables now that they are ready
    react = Spicetify.React;
    reactDOM = Spicetify.ReactDOM;

    // Ensure clean state on init/reload
    deactivateFocusMode(); 
    latestTrackData = null; 
    latestAlbumArtUrl = null;

    // Add Spicetify button
    addFocusModeButton();
    
    // Listen for song changes
    Spicetify.Player.addEventListener("songchange", handleSongChange);
      
    // Attempt to capture initial state immediately after a short delay
    setTimeout(handleSongChange, 500); // Give player ample time initially
      
    console.log("Focus Mode: Initialized successfully.");
}

// Run the main function
main(); 