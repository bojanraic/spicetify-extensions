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
      pointer-events: none; /* Let mouse events pass through */
      opacity: 0; 
      transition: opacity ${FM_FADE_DURATION_MS}ms ease !important;
      background: rgba(0, 0, 0, 0.7); 
      padding: 16px; 
      color: white; 
    }
    body.${FM_CLASS_NAME}.${FM_CONTROLS_VISIBLE_CLASS} #${FM_TRACK_INFO_ID} {
      opacity: 1 !important;
    }
    #${FM_TRACK_INFO_ID} .track-title {
      font-size: 1.2em; font-weight: bold;
    }
    #${FM_TRACK_INFO_ID} .track-artist {
      font-size: 1em; opacity: 0.8;
    }
    
    /* Ensure cloned controls inherit necessary styles */
    #${FM_PLAYER_CONTROLS_ID} .main-nowPlayingBar-center {
        /* Add specific overrides if needed */
    }
  `;
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
        return;
    }

    // console.log("Focus Mode: Player.data.item on update check:", JSON.stringify(currentItem, null, 2));

    const metadata = currentItem.metadata;
    if (!metadata) {
        console.warn("Focus Mode: Metadata missing in Player data item.");
        latestTrackData = { uri: currentItem.uri }; // Keep URI at least
        latestAlbumArtUrl = null;
    } else {
        // console.log("Focus Mode: Raw metadata on update check:", JSON.stringify(metadata, null, 2));
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

const FocusPlayerControls = () => {
    const [isPlaying, setIsPlaying] = react.useState(Spicetify.Player.isPlaying());
    const [volume, setVolume] = react.useState(Spicetify.Player.getVolume());
    const [sliderValue, setSliderValue] = react.useState(volume); // New state for slider visual
    const [dimOpacity, setDimOpacity] = react.useState(0.25); // Default: 25% opaque

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

    console.log(`Focus Controls: Rendering - isPlaying: ${isPlaying}, volume: ${volume}, dimOpacity: ${dimOpacity}`);

    // --- Render ---
    // The main container will now be a single row for controls
    return react.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', width: '100%', padding: '0 20px' } },
        
        // Dim Slider (Far Left)
        react.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '5px', flexBasis: '150px' /* Give it a base width */ } },
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
        react.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '5px', flexBasis: '150px' /* Give it a base width */ } },
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
        
        // Removed the separate Playback Buttons container
        // Removed the separate Sliders container
    );
};

const FocusModeUI = ({ trackData, albumArtUrl, controlsVisible }) => {
    console.log("Focus Mode UI Component: Rendering with props:", { trackData, albumArtUrl, controlsVisible });
    const usableAlbumArtUrl = convertSpotifyImageUri(albumArtUrl);
    console.log("Focus Mode UI Component: Converted album art URL:", usableAlbumArtUrl);
    const title = trackData?.title || "Loading...";
    const artist = trackData?.artist_name || "";

    return react.createElement("div", { id: FM_ELEMENT_ID_PREFIX + "content" },
        // Album Art (Opacity is now controlled by the Dim Slider via direct DOM manipulation)
        usableAlbumArtUrl && react.createElement("img", { 
            id: FM_ALBUM_ART_ID, 
            src: usableAlbumArtUrl, 
            alt: "Album Art" 
        }),
        
        // Track Info (Always rendered, opacity controlled by CSS)
        react.createElement("div", { id: FM_TRACK_INFO_ID },
            react.createElement("div", { className: "track-title" }, title),
            react.createElement("div", { className: "track-artist" }, artist)
        ),

        // Player Controls Container (Always rendered, opacity controlled by CSS)
        react.createElement("div", { id: FM_PLAYER_CONTROLS_ID }, 
            react.createElement(FocusPlayerControls, null) // Render our React controls
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
  console.log(`Focus Mode: handleKeyDown received key: ${event.key}`);
  if (event.key === "Escape" && isFocusModeActive) {
    console.log("Focus Mode: Escape key pressed, deactivating...");
    deactivateFocusMode();
  }
}

function handleClick(event) {
  console.log("Focus Mode: handleClick detected on target:", event.target);
  // Check if click is outside the controls container and not on the activation button
  if (isFocusModeActive && 
      !event.target.closest(`#${FM_PLAYER_CONTROLS_ID}`) &&
      focusModeButton && !focusModeButton.element.contains(event.target)) 
  {
    console.log("Focus Mode: Background click detected, deactivating...");
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