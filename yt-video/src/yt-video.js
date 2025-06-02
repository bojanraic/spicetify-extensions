// YT-Video Spicetify Extension
// Opens YouTube videos for Spotify songs without ads, cookies, or tracking

// UI Text constants
const YTV_BUTTON_TOOLTIP = "Watch on YouTube (Ad-Free)";
const YTV_CONTEXT_MENU_ITEM = "Play video";

// CSS/DOM constants
const YTV_BUTTON_CLASS = "ytv-button";
const YTV_BUTTON_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
</svg>`;
const YTV_CONTEXT_MENU_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="#FF0000" style="margin-right: 4px; vertical-align: -3px;">
  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
</svg>`;

// Configuration constants
const YTV_RETRY_LIMIT = 5;
const YTV_DELAY_MS = 120;
const YTV_NOCOOKIE_DOMAIN = "www.youtube-nocookie.com";
const YTV_BUTTON_COLOR = "#FF0000"; // YouTube red color
const YTV_SETTINGS_KEY = "yt-video:settings";
const YTV_SPICETIFY_LAST_LOADED_API = "FeedbackAPI"; // This is the last API that Spicetify loads
const YTV_MUSIC_VIDEO_SEARCH_SUFFIX = "music video";

// Cache constants
const YTV_CACHE_KEY_PREFIX = "yt-video:cache:";
const YTV_CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const YTV_SEARCH_CACHE_SIZE = 100; // Maximum number of cached search results

// Default settings
const YTV_DEFAULT_SETTINGS = {
  useApiKey: false,
  apiKey: "",
  showThumbnails: true,
  autoplay: true
};

// Global state
let ytvSettings = { ...YTV_DEFAULT_SETTINGS };

// Declare performSearch, showApiResults, and showEmbedResults globally so they can be accessed by showVideoPlayer
let performSearch;
let showApiResults;
let showEmbedResults;

// Function to show video player
// This function is declared globally to be accessible from different parts of the code.
const showVideoPlayer = (videoId, videoIndex = 0, videoList = []) => {
  console.debug("YT-Video: Showing video player for ID:", videoId);

  // Pause Spotify playback when loading a video
  if (Spicetify.Player && Spicetify.Player.isPlaying()) {
    console.debug("YT-Video: Pausing Spotify playback before loading video");
    Spicetify.Player.pause();
  }

  // Store current video state
  window.ytvCurrentState = {
    videoId,
    videoIndex,
    videoList
  };

  // Hide the search bar
  const searchBar = document.getElementById("ytv-search-bar");
  if (searchBar) {
    searchBar.style.display = "none";
  }

  // Hide the modal title
  const modalHeader = document.querySelector('.main-trackCreditsModal-header');
  if (modalHeader) {
    modalHeader.style.display = "none";
  }

  const contentContainer = document.getElementById("ytv-content");
  // Adjust the content container to take full height
  contentContainer.style.height = "100%";

  // Find the modal container and adjust its content area
  const modalContainer = document.querySelector('.GenericModal');
  if (modalContainer) {
    // Remove any padding or margins
    modalContainer.style.padding = "0";
    modalContainer.style.margin = "0";

    const contentSection = modalContainer.querySelector('.main-trackCreditsModal-mainSection');
    if (contentSection) {
      contentSection.style.height = "100%";
      contentSection.style.maxHeight = "100%";
      contentSection.style.overflow = "hidden";
      contentSection.style.padding = "0";
      contentSection.style.margin = "0";
    }

    // Remove any padding from the inner container
    const innerContainer = modalContainer.querySelector('.main-embedWidgetGenerator-container');
    if (innerContainer) {
      innerContainer.style.padding = "0";
      innerContainer.style.margin = "0";
    }

    // Remove any padding from the credits container
    const creditsContainer = modalContainer.querySelector('.main-trackCreditsModal-originalCredits');
    if (creditsContainer) {
      creditsContainer.style.padding = "0";
      creditsContainer.style.margin = "0";
    }

    // Adjust the modal overlay to ensure it's full screen
    const modalOverlay = document.querySelector('.GenericModal__overlay');
    if (modalOverlay) {
      modalOverlay.style.padding = "0";
    }
  }

  // Clear the content container
  contentContainer.innerHTML = '';

  // Create the video player
  const playerContainer = document.createElement('div');
  playerContainer.id = 'ytv-player-container';
  playerContainer.style.width = '100%';
  playerContainer.style.height = '100%';
  playerContainer.style.position = 'relative';
  playerContainer.style.overflow = 'hidden';
  playerContainer.style.padding = "0";
  playerContainer.style.margin = "0";
  playerContainer.style.backgroundColor = "#000";

  // Create the iframe with proper attributes
  const iframe = document.createElement('iframe');
  iframe.id = 'ytv-player-iframe';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.padding = "0";
  iframe.style.margin = "0";
  iframe.style.display = "block"; // Ensure it's a block element
  iframe.style.position = "absolute"; // Position absolutely to fill container
  iframe.style.top = "0";
  iframe.style.left = "0";
  iframe.style.right = "0";
  iframe.style.bottom = "0";

  // Add loading attribute to improve performance
  iframe.loading = "lazy";

  // Set src with parameters to avoid preloading issues
  iframe.src = `https://${YTV_NOCOOKIE_DOMAIN}/embed/${videoId}?autoplay=${ytvSettings.autoplay ? '1' : '0'}&rel=0&controls=1&enablejsapi=1&iv_load_policy=3`;

  // Set permissions
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;

  // YouTube embeds need to run without sandbox restrictions to function properly
  // We're using youtube-nocookie.com which is already a privacy-enhanced version

  // Create back button
  const backButton = document.createElement('button');
  backButton.id = 'ytv-back-button';
  backButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12l-4.58 4.59z"/>
    </svg>
  `;
  backButton.style.position = 'absolute';
  backButton.style.top = '50%';
  backButton.style.left = '16px';
  backButton.style.transform = 'translateY(-50%)';
  backButton.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  backButton.style.color = '#ffffff';
  backButton.style.border = '2px solid rgba(255, 255, 255, 0.3)';
  backButton.style.borderRadius = '50%';
  backButton.style.width = '48px';
  backButton.style.height = '48px';
  backButton.style.cursor = 'pointer';
  backButton.style.zIndex = '1000';
  backButton.style.display = 'flex';
  backButton.style.alignItems = 'center';
  backButton.style.justifyContent = 'center';
  backButton.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.5)';
  backButton.style.transition = 'all 0.2s ease';
  backButton.setAttribute('aria-label', 'Previous video');
  backButton.setAttribute('title', 'Previous video');

  // Create forward button
  const forwardButton = document.createElement('button');
  forwardButton.id = 'ytv-forward-button';
  forwardButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
      <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12l-4.58 4.59z"/>
    </svg>
  `;
  forwardButton.style.position = 'absolute';
  forwardButton.style.top = '50%';
  forwardButton.style.right = '16px';
  forwardButton.style.transform = 'translateY(-50%)';
  forwardButton.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  forwardButton.style.color = '#ffffff';
  forwardButton.style.border = '2px solid rgba(255, 255, 255, 0.3)';
  forwardButton.style.borderRadius = '50%';
  forwardButton.style.width = '48px';
  forwardButton.style.height = '48px';
  forwardButton.style.cursor = 'pointer';
  forwardButton.style.zIndex = '1000';
  forwardButton.style.display = 'flex';
  forwardButton.style.alignItems = 'center';
  forwardButton.style.justifyContent = 'center';
  forwardButton.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.5)';
  forwardButton.style.transition = 'all 0.2s ease';
  forwardButton.setAttribute('aria-label', 'Next video');
  forwardButton.setAttribute('title', 'Next video');

  // Add hover effects
  const addButtonHoverEffects = (button) => {
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

  // Add back button event listener
  backButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // If we have a video list and we're not at the beginning
    if (window.ytvCurrentState && window.ytvCurrentState.videoList && window.ytvCurrentState.videoList.length > 0) {
      const { videoIndex, videoList } = window.ytvCurrentState;

      if (videoIndex > 0) {
        // Go to previous video
        const prevIndex = videoIndex - 1;
        const prevVideo = videoList[prevIndex];
        showVideoPlayer(prevVideo.id.videoId, prevIndex, videoList);
      } else {
        // We're at the first video, go back to search
        console.debug("YT-Video: At first video, going back to search");

        // Show the search bar again
        if (searchBar) {
          searchBar.style.display = "flex";
        }

        // Show the modal title again
        if (modalHeader) {
          modalHeader.style.display = "flex";
        }

        // Reset content container height
        contentContainer.style.height = "calc(100% - 56px)";

        // Reset modal content section
        if (modalContainer) {
          // Restore padding
          modalContainer.style.padding = "";

          const contentSection = modalContainer.querySelector('.main-trackCreditsModal-mainSection');
          if (contentSection) {
            contentSection.style.height = "calc(80vh - 60px)";
            contentSection.style.maxHeight = "calc(80vh - 60px)";
            contentSection.style.padding = "";
            contentSection.style.margin = "";
          }

          // Restore padding for inner containers
          const innerContainer = modalContainer.querySelector('.main-embedWidgetGenerator-container');
          if (innerContainer) {
            innerContainer.style.padding = "";
            innerContainer.style.margin = "";
          }

          const creditsContainer = modalContainer.querySelector('.main-trackCreditsModal-originalCredits');
          if (creditsContainer) {
            creditsContainer.style.padding = "";
            creditsContainer.style.margin = "";
          }

          // Restore modal overlay padding
          const modalOverlay = document.querySelector('.GenericModal__overlay');
          if (modalOverlay) {
            modalOverlay.style.padding = "";
          }
        }

        performSearch(); // This might cause an error if performSearch is not defined globally
      }
    } else {
      // No video list, just go back to search
      console.debug("YT-Video: Back button clicked, returning to search");

      // Show the search bar again
      if (searchBar) {
        searchBar.style.display = "flex";
      }

      // Show the modal title again
      if (modalHeader) {
        modalHeader.style.display = "flex";
      }

      // Reset content container height
        contentContainer.style.height = "calc(100% - 56px)";

        // Reset modal content section
        if (modalContainer) {
          // Restore padding
          modalContainer.style.padding = "";

          const contentSection = modalContainer.querySelector('.main-trackCreditsModal-mainSection');
          if (contentSection) {
            contentSection.style.height = "calc(80vh - 60px)";
            contentSection.style.maxHeight = "calc(80vh - 60px)";
            contentSection.style.padding = "";
            contentSection.style.margin = "";
          }

          // Restore padding for inner containers
          const innerContainer = modalContainer.querySelector('.main-embedWidgetGenerator-container');
          if (innerContainer) {
            innerContainer.style.padding = "";
            innerContainer.style.margin = "";
          }

          const creditsContainer = modalContainer.querySelector('.main-trackCreditsModal-originalCredits');
          if (creditsContainer) {
            creditsContainer.style.padding = "";
            creditsContainer.style.margin = "";
          }

          // Restore modal overlay padding
          const modalOverlay = document.querySelector('.GenericModal__overlay');
          if (modalOverlay) {
            modalOverlay.style.padding = "";
          }
        }

        performSearch(); // This might cause an error if performSearch is not defined globally
    }

    return false;
  });

  // Add forward button event listener
  forwardButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // If we have a video list and we're not at the end
    if (window.ytvCurrentState && window.ytvCurrentState.videoList && window.ytvCurrentState.videoList.length > 0) {
      const { videoIndex, videoList } = window.ytvCurrentState;

      if (videoIndex < videoList.length - 1) {
        // Go to next video
        const nextIndex = videoIndex + 1;
        const nextVideo = videoList[nextIndex];
        showVideoPlayer(nextVideo.id.videoId, nextIndex, videoList);
      } else {
        // We're at the last video, go back to search
        console.debug("YT-Video: At last video, going back to search");

        // Show the search bar again
        if (searchBar) {
          searchBar.style.display = "flex";
        }

        // Show the modal title again
        if (modalHeader) {
          modalHeader.style.display = "flex";
        }

        // Reset content container height
        contentContainer.style.height = "calc(100% - 56px)";

        // Reset modal content section
        if (modalContainer) {
          // Restore padding
          modalContainer.style.padding = "";

          const contentSection = modalContainer.querySelector('.main-trackCreditsModal-mainSection');
          if (contentSection) {
            contentSection.style.height = "calc(80vh - 60px)";
            contentSection.style.maxHeight = "calc(80vh - 60px)";
            contentSection.style.padding = "";
            contentSection.style.margin = "";
          }

          // Restore padding for inner containers
          const innerContainer = modalContainer.querySelector('.main-embedWidgetGenerator-container');
          if (innerContainer) {
            innerContainer.style.padding = "";
            innerContainer.style.margin = "";
          }

          const creditsContainer = modalContainer.querySelector('.main-trackCreditsModal-originalCredits');
          if (creditsContainer) {
            creditsContainer.style.padding = "";
            creditsContainer.style.margin = "";
          }

          // Restore modal overlay padding
          const modalOverlay = document.querySelector('.GenericModal__overlay');
          if (modalOverlay) {
            modalOverlay.style.padding = "";
          }
        }

        performSearch(); // This might cause an error if performSearch is not defined globally
      }
    } else {
      // No video list, just go back to search
      console.debug("YT-Video: Forward button clicked, returning to search");

      // Show the search bar again
      if (searchBar) {
        searchBar.style.display = "flex";
      }

      // Show the modal title again
      if (modalHeader) {
        modalHeader.style.display = "flex";
      }

      // Reset content container height
      contentContainer.style.height = "calc(100% - 56px)";

      // Reset modal content section
      if (modalContainer) {
        // Restore padding
        modalContainer.style.padding = "";

        const contentSection = modalContainer.querySelector('.main-trackCreditsModal-mainSection');
        if (contentSection) {
          contentSection.style.height = "calc(80vh - 60px)";
          contentSection.style.maxHeight = "calc(80vh - 60px)";
          contentSection.style.padding = "";
          contentSection.style.margin = "";
        }

        // Restore padding for inner containers
        const innerContainer = modalContainer.querySelector('.main-embedWidgetGenerator-container');
        if (innerContainer) {
          innerContainer.style.padding = "";
          innerContainer.style.margin = "";
        }

        const creditsContainer = modalContainer.querySelector('.main-trackCreditsModal-originalCredits');
        if (creditsContainer) {
          creditsContainer.style.padding = "";
          creditsContainer.style.margin = "";
        }

        // Restore modal overlay padding
        const modalOverlay = document.querySelector('.GenericModal__overlay');
        if (modalOverlay) {
          modalOverlay.style.padding = "";
        }
      }

      performSearch(); // This might cause an error if performSearch is not defined globally
    }

    return false;
  });

  // Add elements to the container
  playerContainer.appendChild(iframe);
  playerContainer.appendChild(backButton);
  playerContainer.appendChild(forwardButton);
  contentContainer.appendChild(playerContainer);

  // Prevent clicks on player from closing modal
  playerContainer.addEventListener('click', (e) => {
    e.stopPropagation();
  });
};

// Add cache utility functions
const cacheUtils = {
  /**
   * Gets a value from cache
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if not found/expired
   */
  get(key) {
    try {
      const item = localStorage.getItem(YTV_CACHE_KEY_PREFIX + key);
      if (!item) return null;
      
      const { value, timestamp } = JSON.parse(item);
      if (Date.now() - timestamp > YTV_CACHE_DURATION_MS) {
        localStorage.removeItem(YTV_CACHE_KEY_PREFIX + key);
        return null;
      }
      
      return value;
    } catch (error) {
      console.warn("YT-Video: Error reading from cache:", error);
      return null;
    }
  },

  /**
   * Sets a value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   */
  set(key, value) {
    try {
      const item = {
        value,
        timestamp: Date.now()
      };
      localStorage.setItem(YTV_CACHE_KEY_PREFIX + key, JSON.stringify(item));
    } catch (error) {
      console.warn("YT-Video: Error writing to cache:", error);
      // If quota exceeded, clear old entries
      if (error.name === 'QuotaExceededError') {
        this.cleanup();
      }
    }
  },

  /**
   * Cleans up old cache entries
   */
  cleanup() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(YTV_CACHE_KEY_PREFIX)) {
          keys.push(key);
        }
      }

      // Sort by timestamp and remove oldest entries
      keys.sort((a, b) => {
        const aTime = JSON.parse(localStorage.getItem(a)).timestamp;
        const bTime = JSON.parse(localStorage.getItem(b)).timestamp;
        return bTime - aTime;
      });

      // Keep only the newest entries up to YTV_SEARCH_CACHE_SIZE
      keys.slice(YTV_SEARCH_CACHE_SIZE).forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.warn("YT-Video: Error cleaning up cache:", error);
    }
  },

  /**
   * Creates a cache key for search results
   * @param {string} query - Search query
   * @returns {string} Cache key
   */
  getSearchKey(query) {
    return `search:${query.toLowerCase().trim()}`;
  },

  /**
   * Creates a cache key for track-to-video mapping
   * @param {Object} trackInfo - Track information
   * @returns {string} Cache key
   */
  getTrackKey(trackInfo) {
    return `track:${trackInfo.artist}:${trackInfo.name}`.toLowerCase().trim();
  }
};

/**
 * Loads settings from localStorage
 */
function loadSettings() {
  try {
    const savedSettings = JSON.parse(localStorage.getItem(YTV_SETTINGS_KEY));
    if (savedSettings) {
      ytvSettings = { ...YTV_DEFAULT_SETTINGS, ...savedSettings };
      console.debug("YT-Video: Loaded settings:", ytvSettings);
    } else {
      console.debug("YT-Video: No saved settings found, using defaults");
    }
  } catch (error) {
    console.error("YT-Video: Error loading settings:", error);
    ytvSettings = { ...YTV_DEFAULT_SETTINGS };
  }
}

/**
 * Saves settings to localStorage
 */
function saveSettings() {
  try {
    localStorage.setItem(YTV_SETTINGS_KEY, JSON.stringify(ytvSettings));
    console.debug("YT-Video: Saved settings:", ytvSettings);
  } catch (error) {
    console.error("YT-Video: Error saving settings:", error);
  }
}

/**
 * Shows the settings UI
 */
function showSettings() {
  // Create a simple modal for settings
  Spicetify.PopupModal.display({
    title: "YT Video Settings",
    content: `
      <div style="display: flex; flex-direction: column; gap: 20px; padding: 24px; max-width: 600px; margin: 0 auto;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <input type="checkbox" id="ytv-use-api-key" ${ytvSettings.useApiKey ? 'checked' : ''} style="width: 18px; height: 18px;">
          <label for="ytv-use-api-key" style="font-size: 16px;">Use YouTube API Key (for better search results)</label>
        </div>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <label for="ytv-api-key" style="font-size: 16px;">YouTube API Key:</label>
          <input type="text" id="ytv-api-key" value="${ytvSettings.apiKey}" style="padding: 12px; border-radius: 4px; border: 1px solid #ccc; background: #282828; color: white; font-size: 14px;">
          <a href="https://developers.google.com/youtube/v3/getting-started" target="_blank" style="color: #1DB954; font-size: 14px;">How to get a YouTube API Key</a>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <input type="checkbox" id="ytv-show-thumbnails" ${ytvSettings.showThumbnails ? 'checked' : ''} style="width: 18px; height: 18px;">
          <label for="ytv-show-thumbnails" style="font-size: 16px;">Show video thumbnails in search results</label>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <input type="checkbox" id="ytv-autoplay" ${ytvSettings.autoplay ? 'checked' : ''} style="width: 18px; height: 18px;">
          <label for="ytv-autoplay" style="font-size: 16px;">Autoplay videos</label>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 16px; margin-top: 16px;">
          <button id="ytv-settings-cancel" style="background: #282828; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; font-size: 14px;">Cancel</button>
          <button id="ytv-settings-save" style="background: #1DB954; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; font-size: 14px;">Save Settings</button>
        </div>
      </div>
    `,
    isLarge: true,
  });

  // Add event listeners
  setTimeout(() => {
    const useApiKeyCheckbox = document.getElementById("ytv-use-api-key");
    const apiKeyInput = document.getElementById("ytv-api-key");
    const showThumbnailsCheckbox = document.getElementById("ytv-show-thumbnails");
    const autoplayCheckbox = document.getElementById("ytv-autoplay");
    const cancelButton = document.getElementById("ytv-settings-cancel");
    const saveButton = document.getElementById("ytv-settings-save");

    if (cancelButton) {
      cancelButton.addEventListener("click", () => {
        Spicetify.PopupModal.hide();
      });
    }

    if (saveButton) {
      saveButton.addEventListener("click", () => {
        ytvSettings.useApiKey = useApiKeyCheckbox?.checked || false;
        ytvSettings.apiKey = apiKeyInput?.value || "";
        ytvSettings.showThumbnails = showThumbnailsCheckbox?.checked || false;
        ytvSettings.autoplay = autoplayCheckbox?.checked || false;
        
        saveSettings();
        Spicetify.PopupModal.hide();
        
        Spicetify.showNotification("Settings saved");
      });
    }
  }, 0);
}

/**
 * Attempts to find a DOM element using the provided selector
 * @param {string} selector - CSS selector to find the element
 * @param {Element|null} parent - Optional parent element to search within
 * @returns {Promise<Element|null>} The found element or null if not found
 */
async function getElement(selector, parent = null) {
  for (let retryCount = 0; retryCount < YTV_RETRY_LIMIT; retryCount++) {
    const element = parent instanceof Element 
      ? parent.querySelector(selector) 
      : document.querySelector(selector);
    
    if (element) {
      console.debug(`YT-Video: Found element '${selector}' on attempt ${retryCount + 1}`);
      return element;
    }
    await new Promise(resolve => setTimeout(resolve, YTV_DELAY_MS));
  }
  console.warn(`YT-Video: Failed to find element '${selector}' after ${YTV_RETRY_LIMIT} attempts`);
  return null;
}

/**
 * Creates a YouTube button element
 * @returns {HTMLElement} The created button
 */
function createYouTubeButton() {
  const button = document.createElement("button");
  button.classList.add(YTV_BUTTON_CLASS);
  button.setAttribute("title", YTV_BUTTON_TOOLTIP);
  button.setAttribute("aria-label", YTV_BUTTON_TOOLTIP);
  button.innerHTML = YTV_BUTTON_ICON;
  button.style.backgroundColor = "transparent";
  button.style.border = "none";
  button.style.color = YTV_BUTTON_COLOR;
  button.style.cursor = "pointer";
  button.style.padding = "0";
  button.style.width = "32px";
  button.style.height = "32px";
  button.style.display = "flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.opacity = "0.7";
  button.style.transition = "opacity 0.2s ease-in-out";

  // Add hover effect
  button.addEventListener("mouseover", () => {
    button.style.opacity = "1";
  });
  button.addEventListener("mouseout", () => {
    button.style.opacity = "0.7";
  });

  // Add click handler
  button.addEventListener("click", openYouTubeVideo);

  return button;
}

/**
 * Gets information about the currently playing track
 * @returns {Object|null} The track information or null if not found
 */
function getCurrentTrackInfo() {
  console.debug("YT-Video: Getting current track info");
  
  try {
    // Method 1: Use Spicetify.Player.data
    if (Spicetify.Player && Spicetify.Player.data) {
      const data = Spicetify.Player.data;
      if (data.track && data.track.metadata) {
        const metadata = data.track.metadata;
        console.debug("YT-Video: Found track info using Player.data");
        return {
          name: metadata.title,
          artist: metadata.artist_name,
          album: metadata.album_title
        };
      }
    }
    
    // Method 2: Use Spicetify.Player.getTrackInfo()
    try {
      if (Spicetify.Player && typeof Spicetify.Player.getTrackInfo === 'function') {
        const trackInfo = Spicetify.Player.getTrackInfo();
        if (trackInfo) {
          console.debug("YT-Video: Found track info using Player.getTrackInfo()");
          return {
            name: trackInfo.track,
            artist: trackInfo.artist,
            album: trackInfo.album
          };
        }
      }
    } catch (e) {
      console.debug("YT-Video: Error getting track info from Player.getTrackInfo():", e);
    }
    
    // Method 3: Use DOM elements
    // Try to get track name and artist from the now playing bar
    const trackNameElement = document.querySelector(".main-nowPlayingWidget-nowPlaying .main-trackInfo-name");
    const artistNameElement = document.querySelector(".main-nowPlayingWidget-nowPlaying .main-trackInfo-artists");
    
    if (trackNameElement && artistNameElement) {
      console.debug("YT-Video: Found track info using DOM elements");
      return {
        name: trackNameElement.textContent,
        artist: artistNameElement.textContent,
        album: ""
      };
    }
    
    // Method 4: Try alternative DOM selectors
    const trackNameAlt = document.querySelector("[data-testid='now-playing-widget'] .main-trackInfo-name");
    const artistNameAlt = document.querySelector("[data-testid='now-playing-widget'] .main-trackInfo-artists");
    
    if (trackNameAlt && artistNameAlt) {
      console.debug("YT-Video: Found track info using alternative DOM selectors");
      return {
        name: trackNameAlt.textContent,
        artist: artistNameAlt.textContent,
        album: ""
      };
    }
    
    // Method 5: Use document title as last resort
    const title = document.title;
    if (title && title.includes(" - ") && !title.startsWith("Spotify")) {
      const parts = title.split(" - ");
      if (parts.length >= 2) {
        console.debug("YT-Video: Found track info using document title");
        return {
          name: parts[0],
          artist: parts[1].replace(" • Spotify", ""),
          album: ""
        };
      }
    }
    
    console.error("YT-Video: Could not find track info using any method");
    return null;
  } catch (error) {
    console.error("YT-Video: Error getting current track info:", error);
    return null;
  }
}

/**
 * Gets track information from a Spotify URI
 * @param {string} uri - The Spotify URI
 * @returns {Promise<Object|null>} The track information or null if not found
 */
async function getTrackInfoFromURI(uri) {
  console.debug("YT-Video: Getting track info from URI:", uri);
  
  try {
    if (uri.includes("spotify:track:")) {
      // It's a track URI
      const trackId = uri.split("spotify:track:")[1];
      const trackInfo = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/tracks/${trackId}`);
      
      if (trackInfo && trackInfo.name) {
        console.debug("YT-Video: Found track info from track URI");
        return {
          name: trackInfo.name,
          artist: trackInfo.artists?.[0]?.name || "",
          album: trackInfo.album?.name || ""
        };
      }
    } else if (uri.includes("spotify:album:")) {
      // It's an album URI
      const albumId = uri.split("spotify:album:")[1];
      const albumInfo = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/albums/${albumId}`);
      
      if (albumInfo && albumInfo.name) {
        console.debug("YT-Video: Found album info from album URI");
        return {
          name: albumInfo.name,
          artist: albumInfo.artists?.[0]?.name || "",
          album: albumInfo.name
        };
      }
    } else if (uri.includes("spotify:artist:")) {
      // It's an artist URI
      const artistId = uri.split("spotify:artist:")[1];
      const artistInfo = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/artists/${artistId}`);
      
      if (artistInfo && artistInfo.name) {
        console.debug("YT-Video: Found artist info from artist URI");
        return {
          name: "",
          artist: artistInfo.name,
          album: ""
        };
      }
    }
    
    console.error("YT-Video: Could not get track info from URI:", uri);
    return null;
  } catch (error) {
    console.error("YT-Video: Error getting track info from URI:", error);
    return null;
  }
}

/**
 * Opens the YouTube video for the given track info
 * @param {Object} trackInfo - The track information
 */
function openYouTubeVideoForTrack(trackInfo) {
  if (!trackInfo) {
    Spicetify.showNotification("No track information available");
    return;
  }
  
  // If API key is not set but API search is enabled, show settings
  if (ytvSettings.useApiKey && !ytvSettings.apiKey) {
    Spicetify.showNotification("Please set your YouTube API key in settings");
    showSettings();
    return;
  }
  
  let searchQuery;
  let headerTitle = "YT Video Search";
  
  // Continue with normal search if no cache hit
  if (trackInfo.name && trackInfo.artist) {
    searchQuery = `${trackInfo.artist} - ${trackInfo.name} ${YTV_MUSIC_VIDEO_SEARCH_SUFFIX}`;
  } else if (!trackInfo.name && trackInfo.artist) {
    searchQuery = `${trackInfo.artist} ${YTV_MUSIC_VIDEO_SEARCH_SUFFIX}`;
  } else if (trackInfo.name && !trackInfo.artist) {
    searchQuery = `${trackInfo.name} full album`;
  } else {
    Spicetify.showNotification("Insufficient track information");
    return;
  }
  
  const encodedQuery = encodeURIComponent(searchQuery);
  
  // Show notification
  Spicetify.showNotification(`Searching for "${searchQuery}" on YouTube...`);
  
  // Create a simple modal with just the search bar and results
  Spicetify.PopupModal.display({
    title: headerTitle,
    content: `
      <div id="ytv-container" style="width: 100%; height: 80vh;">
        <div id="ytv-search-bar" style="padding: 8px; display: flex; gap: 8px; align-items: center;">
          <input type="text" id="ytv-search-input" value="${searchQuery}" style="flex: 1; padding: 8px; border-radius: 4px; border: 1px solid #ccc; background: #282828; color: white;">
          <button id="ytv-search-button" style="background-color: #FF0000; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Search</button>
          <button id="ytv-youtube-button" style="background: #282828; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Open on YouTube</button>
          <button id="ytv-settings-button" style="background: #282828; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Settings</button>
          <button id="ytv-help-button" title="Show keyboard shortcuts" style="background: #282828; color: white; border: none; padding: 0; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold;">?</button>
        </div>
        <div id="ytv-content" style="height: calc(100% - 56px); position: relative;">
          <div id="ytv-loading" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; background: #121212;">
            <div class="main-loadingSpinner-spinner"></div>
          </div>
        </div>
      </div>
    `,
    isLarge: true,
  });
  
  
  // Apply custom styling to make the modal larger
  setTimeout(() => {
    // Find the modal container
    const modalContainer = document.querySelector('.GenericModal');
    if (modalContainer) {
      // Set the modal to 80% of window width and height
      modalContainer.style.width = '80vw';
      modalContainer.style.height = '80vh';
      modalContainer.style.maxWidth = '80vw';
      modalContainer.style.maxHeight = '80vh';
      
      // Center the modal
      modalContainer.style.position = 'fixed';
      modalContainer.style.left = '50%';
      modalContainer.style.top = '50%';
      modalContainer.style.transform = 'translate(-50%, -50%)';
      modalContainer.style.zIndex = '9999';
      
      // Adjust inner content
      const contentSection = modalContainer.querySelector('.main-trackCreditsModal-mainSection');
      if (contentSection) {
        contentSection.style.height = 'calc(80vh - 40px)'; // Reduced from 60px to 40px
        contentSection.style.maxHeight = 'calc(80vh - 40px)'; // Reduced from 60px to 40px
        contentSection.style.overflow = 'hidden';
      }
      
      // Make sure the container is visible
      const container = modalContainer.querySelector('.main-embedWidgetGenerator-container');
      if (container) {
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.overflow = 'hidden';
      }
      
      // Modify the header to take up less space
      const header = modalContainer.querySelector('.main-trackCreditsModal-header');
      if (header) {
        header.style.padding = '8px 16px'; // Reduced padding
        header.style.minHeight = '40px'; // Reduced height
        header.style.height = '40px'; // Fixed height
        
        // Adjust the title font size
        const title = header.querySelector('.main-type-alto');
        if (title) {
          title.style.fontSize = '16px'; // Smaller font size
          title.style.overflow = 'hidden';
          title.style.textOverflow = 'ellipsis';
          title.style.whiteSpace = 'nowrap';
          title.style.maxWidth = 'calc(100% - 40px)'; // Leave space for close button
        }
      }
      
      // Prevent modal from closing when clicking inside
      const modalOverlay = document.querySelector('.GenericModal__overlay');
      if (modalOverlay) {
        // Store the original click handler
        const originalClickHandler = modalOverlay.onclick;
        
        // Replace with our handler that checks if click is on overlay
        modalOverlay.onclick = (e) => {
          // Only close if clicking directly on the overlay (not its children)
          if (e.target === modalOverlay) {
            // Clean up video state when modal closes
            console.debug("YT-Video: Modal closing, cleaning up video state");
            window.ytvCurrentState = null;
            if (originalClickHandler) originalClickHandler(e);
          } else {
            // Prevent event from bubbling up to overlay
            e.stopPropagation();
          }
        };
      }
      
      // Add cleanup for close button
      const closeButton = modalContainer.querySelector('[aria-label="Close"]');
      if (closeButton) {
        const originalCloseHandler = closeButton.onclick;
        closeButton.onclick = (e) => {
          console.debug("YT-Video: Modal close button clicked, cleaning up video state");
          window.ytvCurrentState = null;
          if (originalCloseHandler) originalCloseHandler(e);
        };
      }
      
      // Add click handler to the container to prevent event bubbling
      const ytvContainer = document.getElementById('ytv-container');
      if (ytvContainer) {
        ytvContainer.addEventListener('click', (e) => {
          e.stopPropagation();
        });
      }
    }
  }, 100);
  
  // Add event listeners
  setTimeout(() => {
    const searchInput = document.getElementById("ytv-search-input");
    const searchButton = document.getElementById("ytv-search-button");
    const youtubeButton = document.getElementById("ytv-youtube-button");
    const settingsButton = document.getElementById("ytv-settings-button");
    const helpButton = document.getElementById("ytv-help-button");
    const contentContainer = document.getElementById("ytv-content");
    
    // Function to show search results using API
    showApiResults = async (query) => {
      console.debug("YT-Video: Showing API results for:", query);
      const currentContentContainer = document.getElementById("ytv-content"); // Get fresh reference
      
      // Show loading spinner
      currentContentContainer.innerHTML = `
        <div style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; background: #121212;">
          <div class="main-loadingSpinner-spinner"></div>
        </div>
      `;
      
      try {
        // Check cache first
        const searchCacheKey = cacheUtils.getSearchKey(query); // Renamed to avoid conflict
        const cachedResults = cacheUtils.get(searchCacheKey);
        
        let data;
        if (cachedResults) {
          console.debug("YT-Video: Using cached results for:", query);
          data = cachedResults;
        } else {
          // Fetch from API if not in cache
          const encodedApiQuery = encodeURIComponent(query); // Renamed to avoid conflict
          const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodedApiQuery}&type=video&maxResults=15&key=${ytvSettings.apiKey}`);
          data = await response.json();
          
          if (data.error) {
            throw new Error(data.error.message || "API Error");
          }
          
          // Cache the results
          if (data.items && data.items.length > 0) {
            cacheUtils.set(searchCacheKey, data);
          }
        }

        if (!data.items || data.items.length === 0) {
          currentContentContainer.innerHTML = `
            <div style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; background: #121212; color: white; text-align: center; padding: 20px;">
              <p>No results found for "${query}"</p>
              <button onclick="window.open('https://www.youtube.com/results?search_query=${encodeURIComponent(query)}', '_blank')" 
                      style="background-color: #282828; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 16px;">
                Open Search on YouTube
              </button>
            </div>
          `;
          return;
        }
        
        // Store the search results for navigation
        window.ytvSearchResults = data.items;
        
        // Create results container
        const resultsContainer = document.createElement('div');
        resultsContainer.id = 'ytv-results-container';
        resultsContainer.style.width = '100%';
        resultsContainer.style.height = '100%';
        resultsContainer.style.overflow = 'auto';
        resultsContainer.style.padding = '16px';
        resultsContainer.style.background = '#121212';
        
        // Create results grid
        const resultsGrid = document.createElement('div');
        resultsGrid.style.display = 'grid';
        resultsGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
        resultsGrid.style.gap = '16px';
        
        // Add results to grid
        data.items.forEach((item, index) => {
          const resultItem = document.createElement('div');
          resultItem.className = 'ytv-result';
          resultItem.dataset.videoId = item.id.videoId;
          resultItem.dataset.videoIndex = index;
          resultItem.style.cursor = 'pointer';
          resultItem.style.transition = 'transform 0.2s';
          resultItem.style.background = '#333';
          resultItem.style.borderRadius = '4px';
          resultItem.style.overflow = 'hidden';
          
          // Add thumbnail
          if (ytvSettings.showThumbnails) {
            const thumbnail = document.createElement('img');
            thumbnail.src = item.snippet.thumbnails.medium.url;
            thumbnail.style.width = '100%';
            thumbnail.style.height = '180px';
            thumbnail.style.objectFit = 'cover';
            resultItem.appendChild(thumbnail);
          } else {
            const placeholderDiv = document.createElement('div');
            placeholderDiv.style.width = '100%';
            placeholderDiv.style.height = '180px';
            placeholderDiv.style.background = '#222';
            placeholderDiv.style.display = 'flex';
            placeholderDiv.style.justifyContent = 'center';
            placeholderDiv.style.alignItems = 'center';
            placeholderDiv.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#FF0000">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
              </svg>
            `;
            resultItem.appendChild(placeholderDiv);
          }
          
          // Add info
          const infoDiv = document.createElement('div');
          infoDiv.style.padding = '12px';
          
          const titleDiv = document.createElement('div');
          titleDiv.style.fontWeight = 'bold';
          titleDiv.style.marginBottom = '4px';
          titleDiv.textContent = item.snippet.title;
          infoDiv.appendChild(titleDiv);
          
          const channelDiv = document.createElement('div');
          channelDiv.style.color = '#b3b3b3';
          channelDiv.style.fontSize = '14px';
          channelDiv.textContent = item.snippet.channelTitle;
          infoDiv.appendChild(channelDiv);
          
          const dateDiv = document.createElement('div');
          dateDiv.style.color = '#b3b3b3';
          dateDiv.style.fontSize = '12px';
          dateDiv.style.marginTop = '4px';
          dateDiv.textContent = new Date(item.snippet.publishedAt).toLocaleDateString();
          infoDiv.appendChild(dateDiv);
          
          resultItem.appendChild(infoDiv);
          
          // Add hover effects
          resultItem.addEventListener('mouseover', () => {
            resultItem.style.transform = 'scale(1.02)';
            resultItem.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
          });
          
          resultItem.addEventListener('mouseout', () => {
            resultItem.style.transform = 'scale(1)';
            resultItem.style.boxShadow = 'none';
          });
          
          // Add click handler
          resultItem.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const videoId = resultItem.dataset.videoId;
            const videoIndex = parseInt(resultItem.dataset.videoIndex, 10);
            console.debug("YT-Video: Result clicked, video ID:", videoId, "index:", videoIndex);
            showVideoPlayer(videoId, videoIndex, data.items);
            return false;
          });
          
          resultsGrid.appendChild(resultItem);
        });
        
        // Add grid to container
        resultsContainer.appendChild(resultsGrid);
        
        // Clear content and add results
        currentContentContainer.innerHTML = '';
        currentContentContainer.appendChild(resultsContainer);
        
        // Prevent clicks on results from closing modal
        resultsContainer.addEventListener('click', (e) => {
          e.stopPropagation();
        });
        
      } catch (error) {
        console.error("YT-Video: Error fetching search results:", error);
        currentContentContainer.innerHTML = `
          <div style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; background: #121212; color: white; text-align: center; padding: 20px;">
            <p>Error: ${error.message || "Failed to fetch search results"}</p>
            <p style="margin-top: 8px; color: #b3b3b3;">Please check your API key in settings or try again later.</p>
            <button onclick="window.open('https://www.youtube.com/results?search_query=${encodeURIComponent(query)}', '_blank')" 
                    style="background-color: #282828; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 16px;">
              Open Search on YouTube
            </button>
          </div>
        `;
      }
    };
    
    showEmbedResults = (query) => {
      console.debug("YT-Video: Showing embed results for:", query);
      const currentContentContainer = document.getElementById("ytv-content"); // Get fresh reference
      
      const encodedEmbedQuery = encodeURIComponent(query); // Renamed to avoid conflict
      
      // Create a container for the iframe
      const iframeContainer = document.createElement('div');
      iframeContainer.style.width = '100%';
      iframeContainer.style.height = '100%';
      iframeContainer.style.position = 'relative';
      
      // Create iframe for embed search with proper attributes
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      
      // Add loading attribute to improve performance
      iframe.loading = "lazy";
      
      // Set src with parameters to avoid preloading issues
      iframe.src = `https://${YTV_NOCOOKIE_DOMAIN}/embed/videoseries?autoplay=0&rel=0&iv_load_policy=3&fs=1&color=red&hl=en&list=search&playlist=${encodedEmbedQuery}&enablejsapi=1`;
      
      // Set permissions
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      
      // YouTube embeds need to run without sandbox restrictions to function properly
      // We're using youtube-nocookie.com which is already a privacy-enhanced version
      
      // Add the iframe to the container
      iframeContainer.appendChild(iframe);
      
      // Clear content and add the iframe container
      currentContentContainer.innerHTML = '';
      currentContentContainer.appendChild(iframeContainer);
      
      // Add click handler to prevent modal from closing
      iframeContainer.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    };
    
    performSearch = () => {
      const query = searchInput.value.trim();
      console.debug("YT-Video: Performing search for:", query);
      
      if (ytvSettings.useApiKey && ytvSettings.apiKey) {
        showApiResults(query);
      } else {
        showEmbedResults(query);
      }
    };
    
    // MOVED CACHE CHECK LOGIC HERE
    const trackCacheKey = cacheUtils.getTrackKey(trackInfo); // Renamed to avoid conflict
    const cachedVideo = cacheUtils.get(trackCacheKey);
  
    // Always perform search to show results, don't auto-play cached videos
    performSearch(); // Always show search results first
    
    // if (cachedVideo) {
    //   console.debug("YT-Video: Using cached video for track:", trackInfo);
    //   showVideoPlayer(cachedVideo.id.videoId, 0, [cachedVideo]);
    // } else {
    //   performSearch(); // Perform initial search if not cached
    // }
    
    // Add event listeners
    if (searchButton) {
      searchButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        performSearch();
        return false;
      });
    }
    
    if (searchInput) {
      searchInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          performSearch();
          return false;
        }
      });
      
      // Prevent input from closing modal
      searchInput.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
    
    if (youtubeButton) {
      youtubeButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const query = searchInput.value.trim();
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
        return false;
      });
    }
    
    if (settingsButton) {
      settingsButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setTimeout(() => {
          showSettings();
        }, 100);
        return false;
      });
    }
    
    if (helpButton) {
      helpButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Remove any existing help overlay
        const existingHelpOverlay = document.getElementById('ytv-shortcuts-overlay');
        if (existingHelpOverlay) {
          existingHelpOverlay.remove();
        }

        // Create a custom overlay for shortcuts
        const shortcutsOverlay = document.createElement('div');
        shortcutsOverlay.id = 'ytv-shortcuts-overlay';
        shortcutsOverlay.style.position = 'fixed';
        shortcutsOverlay.style.top = '0';
        shortcutsOverlay.style.left = '0';
        shortcutsOverlay.style.width = '100%';
        shortcutsOverlay.style.height = '100%';
        shortcutsOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'; // Semi-transparent background
        shortcutsOverlay.style.zIndex = '10000'; // Ensure it's on top of the modal
        shortcutsOverlay.style.display = 'flex';
        shortcutsOverlay.style.justifyContent = 'center';
        shortcutsOverlay.style.alignItems = 'center';

        const shortcutsContent = document.createElement('div');
        shortcutsContent.style.position = 'relative'; // For positioning the close button
        shortcutsContent.style.backgroundColor = '#282828'; // Dark background for the content box
        shortcutsContent.style.color = 'white';
        shortcutsContent.style.padding = '24px';
        shortcutsContent.style.borderRadius = '8px';
        shortcutsContent.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        shortcutsContent.style.maxWidth = '480px'; // Increased from 400px
        shortcutsContent.style.textAlign = 'left';

        // Add Close (X) button to the help content
        const closeHelpButton = document.createElement('button');
        closeHelpButton.innerHTML = '&times;'; // HTML entity for X
        closeHelpButton.style.position = 'absolute';
        closeHelpButton.style.top = '8px';
        closeHelpButton.style.right = '12px';
        closeHelpButton.style.background = 'none';
        closeHelpButton.style.border = 'none';
        closeHelpButton.style.color = '#aaa';
        closeHelpButton.style.fontSize = '28px';
        closeHelpButton.style.lineHeight = '1';
        closeHelpButton.style.padding = '0';
        closeHelpButton.style.cursor = 'pointer';
        closeHelpButton.setAttribute('aria-label', 'Close help');
        closeHelpButton.setAttribute('title', 'Close help');
        
        closeHelpButton.addEventListener('mouseover', () => { closeHelpButton.style.color = 'white'; });
        closeHelpButton.addEventListener('mouseout', () => { closeHelpButton.style.color = '#aaa'; });

        closeHelpButton.addEventListener('click', () => {
          shortcutsOverlay.remove();
        });
        shortcutsContent.appendChild(closeHelpButton);

        const shortcutsTitle = document.createElement('h3');
        shortcutsTitle.textContent = 'Keyboard Shortcuts';
        shortcutsTitle.style.marginTop = '0';
        shortcutsTitle.style.marginBottom = '16px';
        shortcutsTitle.style.borderBottom = '1px solid #444';
        shortcutsTitle.style.paddingBottom = '8px';
        shortcutsContent.appendChild(shortcutsTitle);

        const shortcutsList = document.createElement('ul');
        shortcutsList.style.listStyleType = 'none';
        shortcutsList.style.paddingLeft = '0';
        shortcutsList.style.margin = '0';

        const shortcuts = [
          { key: "Ctrl/Cmd + Y", desc: "Open Search Panel" },
          { key: "Alt/Opt + Left Arrow", desc: "Previous Video (in player)" },
          { key: "Alt/Opt + Right Arrow", desc: "Next Video (in player)" },
          { key: "ESC", desc: "Close Help / Search / Player" }
        ];

        shortcuts.forEach(shortcut => {
          const listItem = document.createElement('li');
          listItem.style.marginBottom = '8px';
          listItem.innerHTML = `<strong style="color: #1DB954; min-width: 180px; display: inline-block;">${shortcut.key}:</strong> ${shortcut.desc}`;
          shortcutsList.appendChild(listItem);
        });

        shortcutsContent.appendChild(shortcutsList);
        shortcutsOverlay.appendChild(shortcutsContent);
        document.body.appendChild(shortcutsOverlay);

        // Click anywhere on the overlay background to close it
        shortcutsOverlay.addEventListener('click', (event) => {
          if (event.target === shortcutsOverlay) {
            shortcutsOverlay.remove();
          }
        });
        
        return false;
      });
    }
    
    // Prevent content container from closing modal
    if (contentContainer) {
      contentContainer.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
    
    // Perform initial search // THIS LINE IS NOW REDUNDANT due to the if/else block above
    // performSearch(); 
    
  }, 150); // Increased delay slightly for modal readiness
}

/**
 * Opens the YouTube video for the current track
 */
function openYouTubeVideo() {
  const trackInfo = getCurrentTrackInfo();
  if (trackInfo) {
    openYouTubeVideoForTrack(trackInfo);
  } else {
    Spicetify.showNotification("No track information available");
  }
}

/**
 * Handles keyboard shortcuts
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleKeyboardShortcut(event) {
  console.debug("YT-Video: handleKeyboardShortcut triggered by key:", event.key, "code:", event.code); // Log key and code

  // Debug logging to see what keys are being pressed
  if (event.altKey || event.ctrlKey || event.metaKey) {
    console.debug("YT-Video: Key event detected:", {
      key: event.key,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      code: event.code
    });
  }
  
  // Handle ESC key
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();

    // First, try to close the help overlay if it's visible
    const helpOverlay = document.getElementById('ytv-shortcuts-overlay');
    if (helpOverlay) {
      console.debug("YT-Video: ESC key pressed, closing help overlay");
      helpOverlay.remove();
      return false;
    }

    // If help overlay is not visible, try to close the main modal/player
    const modal = document.querySelector('.GenericModal');
    if (modal && document.getElementById('ytv-container')) {
      console.debug("YT-Video: ESC key pressed, closing main modal/player");
      
      // Clean up video state
      window.ytvCurrentState = null;
      
      // Close the modal by calling Spicetify's hide method
      Spicetify.PopupModal.hide();
      
      return false;
    }
  }
  
  // Check for Ctrl+Y (Windows/Linux) or Cmd+Y (Mac)
  // Use event.code to check for the physical key 'Y'
  if ((event.ctrlKey || event.metaKey) && event.code === 'KeyY') { 
    // Prevent default browser behavior
    event.preventDefault();
    event.stopPropagation();
    
    console.debug("YT-Video: Keyboard shortcut triggered (Ctrl/Cmd+Y with event.code)");
    openYouTubeVideo();
    
    return false;
  }
  
  // Handle video navigation shortcuts when video player is active
  // Use Alt/Option + Arrow keys to avoid conflicts with Spotify player controls
  if (event.altKey && window.ytvCurrentState && window.ytvCurrentState.videoList && window.ytvCurrentState.videoList.length > 0) {
    const { videoIndex, videoList } = window.ytvCurrentState;
    
    if (event.code === 'ArrowLeft') { // Changed to event.code for consistency
      // Go to previous video
      event.preventDefault();
      event.stopPropagation();
      
      console.debug("YT-Video: Keyboard shortcut triggered (Alt/Option+Left Arrow)");
      
      if (videoIndex > 0) {
        const prevIndex = videoIndex - 1;
        const prevVideo = videoList[prevIndex];
        showVideoPlayer(prevVideo.id.videoId, prevIndex, videoList);
      } else {
        // At first video, show notification
        Spicetify.showNotification("Already at the first video");
      }
      
      return false;
    }
    
    if (event.code === 'ArrowRight') { // Changed to event.code for consistency
      // Go to next video
      event.preventDefault();
      event.stopPropagation();
      
      console.debug("YT-Video: Keyboard shortcut triggered (Alt/Option+Right Arrow)");
      
      if (videoIndex < videoList.length - 1) {
        const nextIndex = videoIndex + 1;
        const nextVideo = videoList[nextIndex];
        showVideoPlayer(nextVideo.id.videoId, nextIndex, videoList);
      } else {
        // At last video, show notification
        Spicetify.showNotification("Already at the last video");
      }
      
      return false;
    }
  }
}

/**
 * Adds the YouTube button to the player controls
 * @returns {Promise<boolean>} Whether the button was added successfully
 */
async function addYouTubeButton() {
  console.debug("YT-Video: Adding YouTube button");
  
  // Check if button already exists
  const existingButton = document.querySelector(`.${YTV_BUTTON_CLASS}`);
  if (existingButton) {
    console.debug("YT-Video: Button already exists");
    return true;
  }
  
  // Create the button
  const button = createYouTubeButton();
  
  // Try to add the button to different locations
  const buttonLocations = [
    ".main-trackInfo-container", // Track info container
    ".main-nowPlayingBar-extraControls", // Extra controls container
    ".main-nowPlayingBar-right", // Right controls container
    ".main-nowPlayingWidget-nowPlaying" // Now playing widget
  ];
  
  for (const location of buttonLocations) {
    const container = await getElement(location);
    if (container) {
      console.debug(`YT-Video: Adding button to ${location}`);
      container.appendChild(button);
      return true;
    }
  }
  
  // If no suitable container is found, add to body with fixed position
  console.debug("YT-Video: No suitable container found, adding to body");
  button.style.position = "fixed";
  button.style.bottom = "80px";
  button.style.right = "16px";
  button.style.zIndex = "9999";
  document.body.appendChild(button);
  
  return true;
}

/**
 * Adds context menu items for YouTube search
 */
function addContextMenuItems() {
  if (!Spicetify.ContextMenu) {
    console.error("YT-Video: Spicetify.ContextMenu is not available");
    return;
  }
  
  // Add context menu item for tracks, albums, and artists
  const watchOnYouTubeItem = new Spicetify.ContextMenu.Item(
    YTV_CONTEXT_MENU_ITEM,
    async (uris) => {
      if (!uris || !uris.length) {
        console.error("YT-Video: No URIs provided to context menu handler");
        return;
      }
      
      // Pause the song if it's playing
      if (Spicetify.Player.isPlaying()) {
        console.debug("YT-Video: Pausing playback");
        Spicetify.Player.pause();
      }
      
      // Get the first URI (we only handle one at a time)
      const uri = uris[0];
      console.debug("YT-Video: Context menu item clicked for URI:", uri);
      
      // Get track info from URI
      const trackInfo = await getTrackInfoFromURI(uri);
      
      // Open YouTube video for the track
      openYouTubeVideoForTrack(trackInfo);
    },
    (uris) => {
      // Only show for tracks, albums, and artists
      if (!uris || !uris.length) return false;
      
      const uri = uris[0];
      return uri.includes("spotify:track:") || 
             uri.includes("spotify:album:") || 
             uri.includes("spotify:artist:");
    },
    YTV_CONTEXT_MENU_ICON
  );
  
  // Register the context menu item
  watchOnYouTubeItem.register();
  
  console.debug("YT-Video: Added context menu items");
}

/**
 * Initializes the extension
 */
async function init() {
  console.debug("YT-Video: Initializing - attaching event listeners...");
  
  // Load settings
  loadSettings();
  
  // Clean up old cache entries
  cacheUtils.cleanup();
  
  // Add YouTube button
  await addYouTubeButton();
  
  // Add context menu items
  addContextMenuItems();
  
  // Add keyboard shortcut listener
  document.addEventListener('keydown', handleKeyboardShortcut, true);
  console.debug("YT-Video: Added keyboard shortcut listener (Ctrl/Cmd+Y & Alt/Opt+Arrows)");
  
  // Add event listeners for track changes to check if button still exists
  Spicetify.Player.addEventListener("songchange", async () => {
    console.debug("YT-Video: Song changed, checking button");
    // Only re-add the button if it's missing
    const existingButton = document.querySelector(`.${YTV_BUTTON_CLASS}`);
    if (!existingButton) {
      console.debug("YT-Video: Button not found, re-adding");
      await addYouTubeButton();
    }
  });
  
  // Also listen for app changes
  Spicetify.Platform.History.listen(async () => {
    console.debug("YT-Video: App navigation detected, checking button");
    // Only re-add the button if it's missing
    const existingButton = document.querySelector(`.${YTV_BUTTON_CLASS}`);
    if (!existingButton) {
      console.debug("YT-Video: Button not found, re-adding");
      await addYouTubeButton();
    }
  });
  
  console.debug("YT-Video: Initialization complete");
}

/**
 * Waits for a condition to be true before executing a callback
 * @param {function(): boolean} condition - Function that returns true when ready
 * @param {function(): Promise<void>} callback - Async function to execute when ready
 */
const ytv_main = async (condition, callback) => {
  while (!condition()) {
    await new Promise(resolve => setTimeout(resolve, YTV_DELAY_MS));
  }
  await callback();
};

// Initialize when Spicetify is ready
ytv_main(() => {
  const ready = Spicetify && Spicetify.Platform && Spicetify.Platform[YTV_SPICETIFY_LAST_LOADED_API] && document.readyState === 'complete';
  if (ready) {
    console.debug("YT-Video: Spicetify is ready");
  }
  return ready;
}, init); 