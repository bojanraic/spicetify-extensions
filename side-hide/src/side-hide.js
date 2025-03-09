// UI Text constants
const SH_NOW_PLAYING_TEXT = "Now playing view";
const SH_FRIEND_ACTIVITY_FEED_TEXT = "Friend Activity";

// CSS/DOM constants
const SH_RIGHT_SIDEBAR_CLASS = "Root__right-sidebar";
const SH_MAIN_VIEW_CLASS = "Root__main-view";
const SH_SIDEBAR_CSS_SELECTORS = {
  RIGHT_SIDEBAR: `div.${SH_RIGHT_SIDEBAR_CLASS}`,
  MAIN_VIEW: `div.${SH_MAIN_VIEW_CLASS}`,
  FRIENDS_ACTIVITY_BUTTON: `button.main-topBar-buddyFeed[aria-label='${SH_FRIEND_ACTIVITY_FEED_TEXT}']`,
  NOW_PLAYING_BUTTON: `button.main-genericButton-button[aria-label='${SH_NOW_PLAYING_TEXT}']`,
};

// Configuration constants
const SH_RETRY_LIMIT = 5;
const SH_DELAY_MS = 120;
const SH_SPICETIFY_LAST_LOADED_API = "FeedbackAPI"; // This is the last API that Sp[o|ice]tify loads

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
      // Remove the sidebar from the DOM completely
      rootContainer.removeChild(rightSidebar);
      
      // Find the main content area and adjust its width
      const mainContent = await getElement(SH_SIDEBAR_CSS_SELECTORS.MAIN_VIEW);
      if (mainContent) {
        mainContent.style.width = '100%';
        mainContent.style.maxWidth = '100%';
        mainContent.style.gridColumn = '1 / -1'; // Span all grid columns if using grid
      }
    } else {
      console.warn(`Side-Hide: Could not find parent container of right sidebar`);
      // Fallback to just hiding it if we can't remove it properly
      rightSidebar.style.display = 'none';
    }
  } else {
    console.warn(`Side-Hide: Could not find right sidebar to remove`);
  }
  
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
