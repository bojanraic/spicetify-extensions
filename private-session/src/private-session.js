// UI Text constants
const PS_PRIVATE_SESSION_LABEL_TEXT = "Private session";

// Configuration constants
const PS_RETRY_LIMIT = 5;
const PS_INDICATOR_RETRIES = 2;  // PS indicator check attempts
const PS_DELAY_MS = 100;
const PS_SPICETIFY_LAST_LOADED_API = "FeedbackAPI"; // This is the last API that Sp[o|ice]tify loads

// CSS/DOM selectors
const PS_CSS_SELECTORS = {
  PRIVATE_SESSION_INDICATOR: "button.main-actionButtons-button",
  MAIN_MENU: "div.main-topBar-topbarContentRight > button.main-userWidget-box",
  MENU_ITEM_LABEL: "span",
  MENU_ITEM_BUTTON: "ul > li > button.main-contextMenu-menuItemButton[role='menuitemcheckbox']",
  MENU_ITEM_CHECKED: "svg"
};

/**
 * Attempts to find DOM element(s) using the provided selector
 * @param {string} selector - CSS selector to find the element(s)
 * @param {boolean} multiple - Whether to return multiple elements
 * @returns {Promise<Element|Element[]|null>} The found element(s) or null if not found
 */
async function getElement(selector, multiple) {
  for (let retryCount = 0; retryCount < PS_RETRY_LIMIT; retryCount++) {
    console.debug(`Private-Session: Searching for "${selector}" - attempt ${retryCount + 1}`);
    
    if (multiple) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return elements;
      }
    } else {
      const element = document.querySelector(selector);
      if (element) {
        console.debug(`Private-Session: Found element "${selector}" on attempt ${retryCount + 1}`);
        return element;
      }
    }
    await new Promise(resolve => setTimeout(resolve, PS_DELAY_MS));
  }
  console.warn(`Private-Session: Failed to find "${selector}" after ${PS_RETRY_LIMIT} attempts`);
  return null;
}

/**
 * Clicks an element found by selector and returns the element
 * @param {string} selector - CSS selector for the element to click
 * @returns {Promise<Element|null>} The clicked element or null if not found
 */
async function clickElementBySelector(selector) {
  const element = await getElement(selector, false);
  if (!element) {
    console.warn(`Private-Session: Cannot click non-existent element "${selector}"`);
    return null;
  }
  element.click();
  return element;
}

/**
 * Checks if a menu item button is currently selected
 * @param {Element} button - The menu item button element to check
 * @returns {Promise<boolean>} Whether the button is selected
 */
async function isMenuItemSelected(button) {
  return !!button.querySelector(PS_CSS_SELECTORS.MENU_ITEM_CHECKED);
}

/**
 * Finds a menu item button by its label text
 * @param {string} labelText - The text to search for in menu items
 * @returns {Promise<Element|null>} The found menu item button or null
 */
async function findMenuItemButton(labelText) {
  for (let retryCount = 0; retryCount < PS_RETRY_LIMIT; retryCount++) {
    console.debug(`Private-Session: Looking for menu item "${labelText}" - attempt ${retryCount + 1}`);
    
    const menuItems = document.querySelectorAll(PS_CSS_SELECTORS.MENU_ITEM_BUTTON);
    if (menuItems.length > 0) {
      for (const button of menuItems) {
        const label = button.querySelector(PS_CSS_SELECTORS.MENU_ITEM_LABEL);
        if (label && label.textContent.trim() === labelText) {
          console.debug(`Private-Session: Found menu item "${labelText}"`);
          return button;
        }
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, PS_DELAY_MS));
  }
  
  console.warn(`Private-Session: Menu item "${labelText}" not found after ${PS_RETRY_LIMIT} attempts`);
  return null;
}

/**
 * Finds the private session indicator if it exists
 * @returns {Promise<Element|null>} The indicator element or null
 */
async function findPrivateSessionIndicator() {
  for (let retryCount = 0; retryCount < PS_INDICATOR_RETRIES; retryCount++) {
    console.debug(`Private-Session: Looking for private session indicator - attempt ${retryCount + 1}`);
    
    const buttons = document.querySelectorAll(PS_CSS_SELECTORS.PRIVATE_SESSION_INDICATOR);
    for (const button of buttons) {
      if (button.textContent.includes(PS_PRIVATE_SESSION_LABEL_TEXT)) {
        console.debug('Private-Session: Found private session indicator');
        return button;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, PS_DELAY_MS));
  }
  
  console.debug('Private-Session: No private session indicator found');
  return null;
}

/**
 * Starts a private session if not already active
 */
async function startPrivateSession() {
  console.debug('Private-Session: Starting...');
  // Check if already in private session
  const indicator = await findPrivateSessionIndicator();
  if (indicator) {
    console.debug('Private-Session: Already in private session');
    return;
  }

  // Only continue to open menu if we're not in private session
  const menu = await clickElementBySelector(PS_CSS_SELECTORS.MAIN_MENU);
  if (!menu) return;

  // Wait for menu to open and render
  await new Promise(resolve => setTimeout(resolve, PS_DELAY_MS));

  const privateSessionMenuItem = await findMenuItemButton(PS_PRIVATE_SESSION_LABEL_TEXT);
  if (!privateSessionMenuItem) {
    console.error(`Private-Session: ${PS_PRIVATE_SESSION_LABEL_TEXT} menu item not found`);
    // Close menu if we couldn't find the option
    await menu.click();
    return;
  }

  // Toggle private session if needed
  if (await isMenuItemSelected(privateSessionMenuItem)) {
    await menu.click(); // Close menu if already in private session
  } else {
    await privateSessionMenuItem.click(); // Enable private session
    console.debug('Private-Session: Enabled private session');
  }
}

/**
 * Waits for a condition to be true before executing a callback
 * @param {function(): boolean} condition - Function that returns true when ready
 * @param {function(): Promise<void>} callback - Async function to execute when ready
 */
const privateSessionMain = async (condition, callback) => {
  while (!condition()) {
    await new Promise(resolve => setTimeout(resolve, PS_DELAY_MS));
  }
  await callback();
};

// Add focus event listener to trigger private session on window focus
window.addEventListener('focus', () => {
  console.debug('Private-Session: Window focused - checking private session state');
  startPrivateSession();
});

// Invoke startPrivateSession once: 
// - Spicetify.Platform has loaded the last API 
// - the document is ready
privateSessionMain(() => Spicetify.Platform && Spicetify.Platform[PS_SPICETIFY_LAST_LOADED_API] && document.readyState === 'complete', startPrivateSession);
