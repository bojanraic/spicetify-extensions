// UI Text constants
const SH_NOW_PLAYING_TEXT = "Now playing view";
const SH_FRIEND_ACTIVITY_FEED_TEXT = "Friend Activity";

// CSS/DOM constants
const SH_RIGHT_SIDEBAR_CLASS = "Root__right-sidebar";
const SH_MAIN_VIEW_CLASS = "Root__main-view";
const SH_NAV_BAR_CLASS = "Root__nav-bar";
const SH_ROOT_CLASS = "Root";
const SH_MAIN_VIEW_CONTAINER_CLASS = "main-view-container";
const SH_SCROLL_NODE_CLASS = "main-view-container__scroll-node";

// CSS Selectors
const SH_SIDEBAR_CSS_SELECTORS = {
  ROOT: `.${SH_ROOT_CLASS}`,
  RIGHT_SIDEBAR: `div.${SH_RIGHT_SIDEBAR_CLASS}`,
  MAIN_VIEW: `div.${SH_MAIN_VIEW_CLASS}`,
  NAV_BAR: `.${SH_NAV_BAR_CLASS}`,
  MAIN_VIEW_CONTAINER: `.${SH_MAIN_VIEW_CONTAINER_CLASS}`,
  SCROLL_NODE: `.${SH_SCROLL_NODE_CLASS}`,
  FRIENDS_ACTIVITY_BUTTON: `button.main-topBar-buddyFeed[aria-label='${SH_FRIEND_ACTIVITY_FEED_TEXT}']`,
  NOW_PLAYING_BUTTON: `button.main-genericButton-button[aria-label='${SH_NOW_PLAYING_TEXT}']`,
};

// Configuration constants
const SH_RETRY_LIMIT = 5;
const SH_DELAY_MS = 120;
const SH_SPICETIFY_LAST_LOADED_API = "FeedbackAPI"; // This is the last API that Sp[o|ice]tify loads
const SH_STYLE_ID = "side-hide-layout-fix";

// CSS rules for fixing sidebar resize and layout issues
const SH_LAYOUT_CSS = `
  /* Fix for sidebar resize issues - prevent content overlap */
  .${SH_MAIN_VIEW_CLASS} {
    margin-left: 0 !important;
    width: auto !important;
    min-width: 0 !important;
    grid-column: 2 / 3 !important;
  }
  
  /* Ensure the content container uses proper sizing */
  .${SH_MAIN_VIEW_CONTAINER_CLASS} {
    margin-left: 0 !important;
    width: 100% !important;
    max-width: none !important;
    box-sizing: border-box !important;
  }
  
  /* Ensure scroll container takes full width */
  .${SH_SCROLL_NODE_CLASS} {
    width: 100% !important;
  }
  
  /* Ensure the Root grid layout respects the nav bar size */
  .${SH_ROOT_CLASS} {
    grid-template-columns: auto 1fr !important;
  }
  
  /* Custom layout for nav bar to ensure it sizes properly */
  .${SH_NAV_BAR_CLASS} {
    position: relative !important;
    z-index: 2 !important;
  }
`;

/**
 * Attempts to find a DOM element using the provided selector
 * @param {string} selector - CSS selector to find the element
 * @param {Element|null} parent - Optional parent element to search within
 * @returns {Promise<Element|null>} The found element or null if not found
 */
async function getElement(selector, parent = null) {
  for (let retryCount = 0; retryCount < SH_RETRY_LIMIT; retryCount++) {
    const element = parent instanceof Element 
      ? parent.querySelector(selector) 
      : document.querySelector(selector);
    
    if (element) {
      console.debug(`Side-Hide: Found element '${selector}' on attempt ${retryCount + 1}`);
      return element;
    }
    await new Promise(resolve => setTimeout(resolve, SH_DELAY_MS));
  }
  console.warn(`Side-Hide: Failed to find element '${selector}' after ${SH_RETRY_LIMIT} attempts`);
  return null;
}

/**
 * Removes an element found by selector
 * @param {string} selector - CSS selector for the element to remove
 */
async function removeElementBySelector(selector) {
  const element = await getElement(selector);
  if (!element) {
    console.warn(`Side-Hide: Cannot remove non-existent element '${selector}'`);
    return;
  }

  console.debug(`Side-Hide: Removing element '${selector}'`);
  element.remove();
}

/**
 * Injects a stylesheet into the document head
 * @param {string} cssContent - CSS content to inject
 * @param {string} styleId - ID for the style element
 * @returns {HTMLStyleElement} The created style element
 */
function injectStylesheet(cssContent, styleId) {
  // Check if the stylesheet already exists
  let styleElement = document.getElementById(styleId);
  
  // If it exists, remove it to ensure we have the latest version
  if (styleElement) {
    styleElement.remove();
  }
  
  // Create and inject the new stylesheet
  styleElement = document.createElement('style');
  styleElement.id = styleId;
  styleElement.innerHTML = cssContent;
  document.head.appendChild(styleElement);
  
  return styleElement;
}

/**
 * Handles left sidebar resize issues to prevent overlap with main content
 */
function addLeftSidebarResizeHandling() {
  // Inject our layout fixes stylesheet
  injectStylesheet(SH_LAYOUT_CSS, SH_STYLE_ID);
  
  // Find the left sidebar and main content elements
  const leftSidebar = document.querySelector(SH_SIDEBAR_CSS_SELECTORS.NAV_BAR);
  const mainContent = document.querySelector(SH_SIDEBAR_CSS_SELECTORS.MAIN_VIEW);
  
  if (!leftSidebar || !mainContent) {
    console.warn('Side-Hide: Could not find left sidebar or main content elements');
    return;
  }
  
  // Create a ResizeObserver to actively monitor the nav bar width
  const resizeObserver = new ResizeObserver(() => {
    // This just ensures the observer stays active
    console.debug('Side-Hide: Detected sidebar resize');
  });
  
  // Start observing the left sidebar
  resizeObserver.observe(leftSidebar);
  
  // Add a MutationObserver to track class/style changes on root element
  // This helps catch any attempts by Spotify to override our layout
  const rootObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.attributeName === 'style' || mutation.attributeName === 'class') {
        // Re-apply our stylesheet by removing and re-adding it
        injectStylesheet(SH_LAYOUT_CSS, SH_STYLE_ID);
      }
    });
  });
  
  // Get the root element and observe it
  const rootElement = document.querySelector(SH_SIDEBAR_CSS_SELECTORS.ROOT);
  if (rootElement) {
    rootObserver.observe(rootElement, {
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }
  
  /**
   * Applies fixes for the left sidebar width
   */
  function applyLayoutFixes() {
    const navBarWidth = leftSidebar.offsetWidth;
    if (rootElement) {
      // Apply the width to the grid template columns
      rootElement.style.setProperty('--left-sidebar-width', `${navBarWidth}px`);
    }
  }
  
  // Run the initial fix
  applyLayoutFixes();
  
  // Add resize event listener to catch window resize events
  window.addEventListener('resize', () => {
    applyLayoutFixes();
  });
}

/**
 * Removes all sidebar elements
 */
async function hideSide() {
  // Find and remove the right sidebar container
  const rightSidebar = await getElement(SH_SIDEBAR_CSS_SELECTORS.RIGHT_SIDEBAR);
  if (rightSidebar) {
    console.debug(`Side-Hide: Found right sidebar, removing it from DOM`);
    
    // Find the parent container that holds both main content and sidebar
    const rootContainer = rightSidebar.parentElement;
    if (rootContainer) {
      // Find the main content area before removing the sidebar
      const mainContent = await getElement(SH_SIDEBAR_CSS_SELECTORS.MAIN_VIEW);
      
      // Remove the sidebar from the DOM completely
      rootContainer.removeChild(rightSidebar);
      
      // Add data attribute to indicate sidebar is hidden
      rootContainer.setAttribute('data-right-sidebar-hidden', 'true');
      
      // Apply CSS to fix grid layout and prevent overlap
      if (mainContent) {
        // Adjust the main content area width and grid properties
        mainContent.style.width = '100%';
        mainContent.style.maxWidth = '100%';
        
        // Adjust grid column to span full width
        mainContent.style.gridColumn = '1 / -1';
        
        // Add a resize event listener to ensure layout remains fixed if window is resized
        window.addEventListener('resize', function() {
          requestAnimationFrame(() => {
            mainContent.style.width = '100%';
            mainContent.style.maxWidth = '100%';
            mainContent.style.gridColumn = '1 / -1';
          });
        });
        
        // Add a MutationObserver to maintain our adjustments if Spotify tries to change them
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && 
                (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
              requestAnimationFrame(() => {
                mainContent.style.width = '100%';
                mainContent.style.maxWidth = '100%';
                mainContent.style.gridColumn = '1 / -1';
              });
            }
          });
        });
        
        observer.observe(mainContent, { attributes: true });
      }
    } else {
      console.warn(`Side-Hide: Could not find parent container of right sidebar`);
      // Fallback to just hiding it if we can't remove it properly
      rightSidebar.style.display = 'none';
    }
  } else {
    console.warn(`Side-Hide: Could not find right sidebar to remove`);
  }
  
  // Handle left sidebar resize issues by adding listeners to fix content overflow
  addLeftSidebarResizeHandling();
  
  // Hide the Friend Activity button in the top bar
  await removeElementBySelector(SH_SIDEBAR_CSS_SELECTORS.FRIENDS_ACTIVITY_BUTTON);
  
  // Hide the Now Playing button in the bottom bar
  await removeElementBySelector(SH_SIDEBAR_CSS_SELECTORS.NOW_PLAYING_BUTTON);
}

/**
 * Waits for a condition to be true before executing a callback
 * @param {function(): boolean} condition - Function that returns true when ready
 * @param {function(): Promise<void>} callback - Async function to execute when ready
 */
const sh_main = async (condition, callback) => {
  while (!condition()) {
    await new Promise(resolve => setTimeout(resolve, SH_DELAY_MS));
  }
  await callback();
};

// Invoke side-hide once: 
// - Spicetify.Platform has loaded the last API 
// - the document is ready
sh_main(() => Spicetify.Platform && Spicetify.Platform[SH_SPICETIFY_LAST_LOADED_API] && document.readyState === 'complete', hideSide);

