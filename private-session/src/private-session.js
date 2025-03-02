// UI Text constants
const PS_PRIVATE_SESSION_LABEL_TEXT = "Private session";
const PS_PERSISTENT_SESSION_LABEL_TEXT = "Persistent Privacy";

// Configuration constants
const PS_RETRY_LIMIT = 3;
const PS_INDICATOR_RETRIES = 2;  // PS indicator check attempts
const PS_DELAY_MS = 100;
const PS_SPICETIFY_LAST_LOADED_API = "FeedbackAPI"; // This is the last API that Sp[o|ice]tify loads
const MENU_OPERATION_COOLDOWN = 500; 
// CSS/DOM selectors
const PS_CSS_SELECTORS = {
  PRIVATE_SESSION_INDICATOR: "button.main-actionButtons-button",
  MAIN_MENU: "div.main-topBar-topbarContentRight > button.main-userWidget-box",
  MENU_ITEM_LABEL: "span",
  MENU_ITEM_BUTTON: "ul > li > button.main-contextMenu-menuItemButton[role='menuitemcheckbox']",
  MENU_ITEM_CHECKED: "svg"
};

// State variables
let persistentModeEnabled = false;
let focusEventListener = null;
let menuItemAdded = false; // Track if we've added our menu item
let menuOperationInProgress = false;
let lastMenuOperationTime = 0;
let pendingFocusCheck = false; // Track if we have a pending focus check
let cachedPrivateSessionState = false; // Track the last known private session state
let initialCheckComplete = false; // Track if we've done the initial check
let menuCloseTimer = null; // Timer for closing the menu

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
 * Saves the persistent mode setting to localStorage
 */
function savePersistentModeSetting() {
  localStorage.setItem("private-session-persistent-mode", persistentModeEnabled.toString());
  console.debug(`Private-Session: Saved persistent mode setting: ${persistentModeEnabled}`);
}

/**
 * Loads the persistent mode setting from localStorage
 */
function loadPersistentModeSetting() {
  const savedSetting = localStorage.getItem("private-session-persistent-mode");
  // Default to false if no setting is found
  persistentModeEnabled = savedSetting === "true";
  console.debug(`Private-Session: Loaded persistent mode setting: ${persistentModeEnabled}`);
}

/**
 * Checks if private session is active without opening the menu
 * @returns {Promise<boolean>} Whether private session is active
 */
async function isPrivateSessionActive() {
  const indicator = await findPrivateSessionIndicator();
  cachedPrivateSessionState = !!indicator;
  return cachedPrivateSessionState;
}

/**
 * Ensures the menu is closed
 */
function ensureMenuClosed() {
  // Clear any existing timer
  if (menuCloseTimer) {
    clearTimeout(menuCloseTimer);
    menuCloseTimer = null;
  }
  
  const openMenu = document.querySelector("ul.main-contextMenu-menu");
  if (openMenu) {
    console.debug('Private-Session: Closing open menu');
    const menuButton = document.querySelector(PS_CSS_SELECTORS.MAIN_MENU);
    if (menuButton) {
      menuButton.click();
      
      // Double-check after a shorter delay
      menuCloseTimer = setTimeout(() => {
        const menuStillOpen = document.querySelector("ul.main-contextMenu-menu");
        if (menuStillOpen) {
          console.debug('Private-Session: Menu still open, clicking again');
          menuButton.click();
        }
        menuCloseTimer = null;
      }, 150); // Reduced from 300
    }
  }
}

/**
 * Starts a private session if not already active
 * @param {boolean} [forceOpen=true] - Whether to force open the menu if needed
 * @returns {Promise<boolean>} Whether the private session was successfully enabled
 */
async function startPrivateSession(forceOpen = true) {
  console.debug(`Private-Session: Starting with forceOpen=${forceOpen}...`);
  
  // Prevent multiple concurrent menu operations
  if (menuOperationInProgress) {
    console.debug('Private-Session: Menu operation already in progress, skipping');
    return false;
  }
  
  // Check if we've recently performed a menu operation
  const now = Date.now();
  if (now - lastMenuOperationTime < MENU_OPERATION_COOLDOWN) {
    console.debug('Private-Session: Menu operation cooldown active, skipping');
    return false;
  }
  
  try {
    // First check if private session is already active without opening menu
    const isActive = await isPrivateSessionActive();
    if (isActive) {
      console.debug('Private-Session: Already in private session');
      return true;
    }
    
    // Only continue if forceOpen is true
    if (!forceOpen) {
      console.debug('Private-Session: Not in private session, but forceOpen is false');
      return false;
    }
    
    // Set operation flag and update timestamp
    menuOperationInProgress = true;
    lastMenuOperationTime = now;
    
    console.debug('Private-Session: Need to enable private session, opening menu once');
    
    // Ensure any existing menu is closed first
    ensureMenuClosed();
    
    // Wait a bit to ensure menu is closed - reduced delay
    await new Promise(resolve => setTimeout(resolve, 150)); // Reduced from 300
    
    // Open the menu
    const menu = await clickElementBySelector(PS_CSS_SELECTORS.MAIN_MENU);
    if (!menu) {
      console.error('Private-Session: Failed to click menu button');
      menuOperationInProgress = false;
      return false;
    }
    
    // Wait for menu to open and render - optimized delay
    await new Promise(resolve => setTimeout(resolve, PS_DELAY_MS * 2)); // Reduced from PS_DELAY_MS * 3
    
    // Find and click the private session menu item
    const privateSessionMenuItem = await findMenuItemButton(PS_PRIVATE_SESSION_LABEL_TEXT);
    if (!privateSessionMenuItem) {
      console.error(`Private-Session: ${PS_PRIVATE_SESSION_LABEL_TEXT} menu item not found`);
      ensureMenuClosed();
      menuOperationInProgress = false;
      return false;
    }
    
    // Toggle private session if needed
    if (await isMenuItemSelected(privateSessionMenuItem)) {
      console.debug('Private-Session: Private session already enabled in menu');
      cachedPrivateSessionState = true;
    } else {
      console.debug('Private-Session: Clicking private session menu item');
      privateSessionMenuItem.click();
      cachedPrivateSessionState = true;
      
      // Wait a bit for the click to take effect - optimized delay
      await new Promise(resolve => setTimeout(resolve, PS_DELAY_MS)); // Reduced from PS_DELAY_MS * 2
    }
    
    // Close the menu
    ensureMenuClosed();
    
    // Reset operation flag
    menuOperationInProgress = false;
    return true;
  } catch (error) {
    console.error('Private-Session: Error in startPrivateSession', error);
    ensureMenuClosed();
    menuOperationInProgress = false;
    return false;
  }
}

/**
 * Enables the persistent private session mode
 */
function enablePersistentMode() {
  persistentModeEnabled = true;
  savePersistentModeSetting();
  
  // Add focus event listener if not already added
  if (!focusEventListener) {
    focusEventListener = () => {
      console.debug('Private-Session: Window focused - scheduling private session check');
      
      // Don't check immediately, schedule it for later to avoid conflicts
      if (!pendingFocusCheck) {
        pendingFocusCheck = true;
        
        // Wait a bit before checking - optimized delay
        setTimeout(async () => {
          console.debug('Private-Session: Performing delayed focus check');
          pendingFocusCheck = false;
          
          // Check if private session is active without opening menu
          const isActive = await isPrivateSessionActive();
          
          if (!isActive && persistentModeEnabled) {
            console.debug('Private-Session: Private session not active after focus, enabling');
            await startPrivateSession(true);
          } else {
            console.debug('Private-Session: Private session already active after focus or persistent mode disabled');
          }
        }, 500); // Reduced from 1000
      } else {
        console.debug('Private-Session: Focus check already pending, skipping');
      }
    };
    window.addEventListener('focus', focusEventListener);
  }
  
  console.debug('Private-Session: Persistent mode enabled');
}

/**
 * Creates a simple green circle checkmark SVG element
 * @returns {Element} The checkmark element
 */
function createCheckmark() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("height", "20");
  svg.setAttribute("width", "20");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.style.marginLeft = "8px";
  svg.style.verticalAlign = "middle";

  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", "10");
  circle.setAttribute("cy", "10");
  circle.setAttribute("r", "9");
  circle.setAttribute("fill", "#1DB954");
  
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M8.5 13.5l-3.5-3.5 1.5-1.5 2 2 4.5-4.5 1.5 1.5z");
  path.setAttribute("fill", "#FFFFFF");
  
  svg.appendChild(circle);
  svg.appendChild(path);
  
  return svg;
}

/**
 * Updates the state of our persistent privacy menu item if it exists in the DOM
 */
function updatePersistentMenuItemState() {
  // Find our menu item if it exists
  const menuItems = document.querySelectorAll("button.main-contextMenu-menuItemButton");
  for (const button of menuItems) {
    const span = button.querySelector("span");
    if (span && span.textContent === PS_PERSISTENT_SESSION_LABEL_TEXT) {
      console.debug("Private-Session: Found persistent privacy menu item, updating state");
      
      // Update aria-checked attribute
      button.setAttribute("aria-checked", persistentModeEnabled ? "true" : "false");
      
      // Update checkmark
      const existingCheckmark = button.querySelector("svg");
      if (persistentModeEnabled && !existingCheckmark) {
        // Add our custom green checkmark
        button.appendChild(createCheckmark());
        console.debug("Private-Session: Added green checkmark");
      } else if (!persistentModeEnabled && existingCheckmark) {
        // Remove checkmark
        existingCheckmark.remove();
        console.debug("Private-Session: Removed checkmark");
      }
      
      break;
    }
  }
}

/**
 * Disables the persistent private session mode
 */
function disablePersistentMode() {
  persistentModeEnabled = false;
  savePersistentModeSetting();
  
  // Remove focus event listener if it exists
  if (focusEventListener) {
    window.removeEventListener('focus', focusEventListener);
    focusEventListener = null;
  }
  
  console.debug('Private-Session: Persistent mode disabled');
}

/**
 * Toggles the persistent private session mode
 */
function togglePersistentMode() {
  if (persistentModeEnabled) {
    disablePersistentMode();
  } else {
    enablePersistentMode();
  }
}

/**
 * A simpler approach to add our menu item using Spicetify's API
 */
function registerMenuItem() {
  try {
    // Try to use Spicetify's registerContextMenu if available
    if (Spicetify && Spicetify.ContextMenu && Spicetify.ContextMenu.registerItem) {
      console.debug("Private-Session: Attempting to register context menu item");
      
      const menuItem = new Spicetify.ContextMenu.Item(
        PS_PERSISTENT_SESSION_LABEL_TEXT,
        () => {
          togglePersistentMode();
          menuItem.isEnabled = persistentModeEnabled;
        },
        persistentModeEnabled
      );
      
      Spicetify.ContextMenu.registerItem(menuItem);
      console.debug("Private-Session: Successfully registered context menu item");
      return true;
    }
    
    // Try to use Spicetify's Menu API if available
    if (Spicetify && Spicetify.Menu) {
      console.debug("Private-Session: Attempting to use Spicetify.Menu");
      
      // Try different ways to create a menu item
      if (typeof Spicetify.Menu.addItem === 'function') {
        console.debug("Private-Session: Using Spicetify.Menu.addItem");
        Spicetify.Menu.addItem(
          PS_PERSISTENT_SESSION_LABEL_TEXT, 
          () => {
            togglePersistentMode();
            // Update the item somehow
          },
          persistentModeEnabled
        );
        console.debug("Private-Session: Successfully added menu item");
        return true;
      }
      
      // Try the Item constructor
      if (Spicetify.Menu.Item) {
        console.debug("Private-Session: Using Spicetify.Menu.Item constructor");
        try {
          const menuItem = new Spicetify.Menu.Item(
            PS_PERSISTENT_SESSION_LABEL_TEXT,
            persistentModeEnabled,
            () => {
              togglePersistentMode();
              menuItem.setState(persistentModeEnabled);
            }
          );
          menuItem.register();
          console.debug("Private-Session: Successfully registered menu item");
          return true;
        } catch (e) {
          console.error("Private-Session: Error creating menu item", e);
        }
      }
    }
    
    console.debug("Private-Session: No suitable Spicetify menu API found");
    return false;
  } catch (error) {
    console.error("Private-Session: Error registering menu item", error);
    return false;
  }
}

/**
 * Adds our menu item using DOM manipulation
 */
function addMenuItemWithDOM() {
  console.debug("Private-Session: Setting up DOM-based menu listener");
  
  // Find the main menu button
  const mainMenuButton = document.querySelector(PS_CSS_SELECTORS.MAIN_MENU);
  if (!mainMenuButton) {
    console.warn("Private-Session: Could not find main menu button");
    return;
  }
  
  // Add click listener to the main menu button
  mainMenuButton.addEventListener("click", () => {
    console.debug("Private-Session: Main menu clicked, waiting for menu to open");
    
    // Wait a bit for the menu to open
    setTimeout(() => {
      // Find the menu list
      const menuList = document.querySelector("ul.main-contextMenu-menu");
      if (!menuList) {
        console.warn("Private-Session: Menu not found after click");
        return;
      }
      
      // If we're in persistent mode, check if private session is active
      // but don't force open another menu
      if (persistentModeEnabled) {
        findPrivateSessionIndicator().then(indicator => {
          if (!indicator) {
            console.debug("Private-Session: Private session not active, enabling via menu");
            // Find and click the private session menu item in the current menu
            const privateSessionButton = findItemByText(menuList, PS_PRIVATE_SESSION_LABEL_TEXT);
            if (privateSessionButton && !privateSessionButton.querySelector("svg")) {
              privateSessionButton.click();
            }
          }
        });
      }
      
      // Update all menu items
      updateMenuItems();
    }, 100);
  });
}

/**
 * Sets up a mutation observer to watch for menu opening
 */
function setupMenuObserver() {
  console.debug("Private-Session: Setting up menu observer");
  
  // Create a mutation observer to watch for menu opening
  const observer = new MutationObserver((mutations) => {
    // Skip if we're in a cooldown period
    const now = Date.now();
    if (now - lastMenuOperationTime < MENU_OPERATION_COOLDOWN) {
      return;
    }
    
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeName === 'DIV' && node.querySelector && node.querySelector("ul.main-contextMenu-menu")) {
            console.debug("Private-Session: Menu opened via DOM mutation");
            
            // Update timestamp to prevent other operations
            lastMenuOperationTime = now;
            
            // Update our menu item with a slight delay
            setTimeout(() => {
              // If persistent mode is enabled, ensure private session is active
              // But don't force open another menu, just update the current one
              if (persistentModeEnabled) {
                findPrivateSessionIndicator().then(indicator => {
                  if (!indicator) {
                    console.debug("Private-Session: Private session not active, enabling via current menu");
                    const menuList = document.querySelector("ul.main-contextMenu-menu");
                    if (menuList) {
                      const privateSessionButton = findItemByText(menuList, PS_PRIVATE_SESSION_LABEL_TEXT);
                      if (privateSessionButton && !privateSessionButton.querySelector("svg")) {
                        privateSessionButton.click();
                      }
                    }
                  }
                  
                  // Update menu items after checking private session
                  updateMenuItems();
                });
              } else {
                // Just update menu items if persistent mode is disabled
                updateMenuItems();
              }
            }, 150);
            
            return;
          }
        }
      }
    }
  });
  
  // Start observing the body for added nodes
  observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * Updates all menu items to reflect current state
 */
function updateMenuItems() {
  const menuList = document.querySelector("ul.main-contextMenu-menu");
  if (!menuList) {
    console.warn("Private-Session: Menu not found when updating items");
    return;
  }
  
  // Find our persistent privacy item
  const menuItems = Array.from(menuList.querySelectorAll("span"));
  for (const item of menuItems) {
    if (item.textContent === PS_PERSISTENT_SESSION_LABEL_TEXT) {
      const button = item.closest("button");
      if (button) {
        console.debug(`Private-Session: Updating persistent privacy item, state: ${persistentModeEnabled}`);
        
        // Set the aria-checked attribute
        button.setAttribute("aria-checked", persistentModeEnabled ? "true" : "false");
        
        // Handle checkmark
        const existingCheckmark = button.querySelector("svg");
        
        if (persistentModeEnabled) {
          // We want a checkmark - if none exists, add one
          if (!existingCheckmark) {
            button.appendChild(createCheckmark());
            console.debug("Private-Session: Added checkmark");
          }
        } else if (!persistentModeEnabled && existingCheckmark) {
          // Remove checkmark if not needed
          existingCheckmark.remove();
          console.debug("Private-Session: Removed checkmark");
        }
      }
      return;
    }
  }
  
  // If we get here, our item doesn't exist yet - add it
  addPersistentPrivacyItem(menuList);
}

/**
 * Finds a menu item by its text content
 * @param {Element} menuList - The menu list element
 * @param {string} text - The text to search for
 * @returns {Element|null} - The found button element or null
 */
function findItemByText(menuList, text) {
  const items = Array.from(menuList.querySelectorAll("span"));
  for (const item of items) {
    if (item.textContent === text) {
      return item.closest("button");
    }
  }
  return null;
}

/**
 * Adds the persistent privacy item to the menu
 * @param {Element} menuList - The menu list element
 */
function addPersistentPrivacyItem(menuList) {
  // Find the Private session item to clone
  const privateSessionSpan = Array.from(menuList.querySelectorAll("span"))
    .find(span => span.textContent === PS_PRIVATE_SESSION_LABEL_TEXT);
  
  if (!privateSessionSpan) {
    console.warn("Private-Session: Could not find Private session item to clone");
    return;
  }
  
  const privateSessionItem = privateSessionSpan.closest("li");
  if (!privateSessionItem) {
    console.warn("Private-Session: Could not find Private session list item");
    return;
  }
  
  // Clone the Private session menu item
  const menuItem = privateSessionItem.cloneNode(true);
  
  // Update the text content
  const span = menuItem.querySelector("span");
  if (span) {
    span.textContent = PS_PERSISTENT_SESSION_LABEL_TEXT;
  }
  
  // Get the button element
  const button = menuItem.querySelector("button");
  if (button) {
    // Set the initial state
    button.setAttribute("aria-checked", persistentModeEnabled ? "true" : "false");
    
    // Remove any existing SVGs/checkmarks
    const existingSvgs = button.querySelectorAll("svg");
    existingSvgs.forEach(svg => svg.remove());
    
    // Add our checkmark if needed
    if (persistentModeEnabled) {
      button.appendChild(createCheckmark());
    }
    
    // Replace the click handler
    button.replaceWith(button.cloneNode(true));
    const newButton = menuItem.querySelector("button");
    
    // Add our click handler
    newButton.addEventListener("click", () => {
      togglePersistentMode();
      newButton.setAttribute("aria-checked", persistentModeEnabled ? "true" : "false");
      
      // Update checkmark
      const existingCheckmark = newButton.querySelector("svg");
      if (persistentModeEnabled && !existingCheckmark) {
        newButton.appendChild(createCheckmark());
      } else if (!persistentModeEnabled && existingCheckmark) {
        existingCheckmark.remove();
      }
    });
  }
  
  // Insert our item after the Private session item
  console.debug("Private-Session: Inserting our cloned item after Spotify's Private session item");
  privateSessionItem.after(menuItem);
  
  console.debug("Private-Session: Successfully added our Persistent Privacy menu item");
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

/**
 * Initializes the private session functionality
 */
async function initializePrivateSession() {
  console.debug("Private-Session: Initializing");
  
  // Load saved settings first
  loadPersistentModeSetting();
  
  // Try to use Spicetify's Menu API first
  let apiSuccess = false;
  
  // Wait for Spicetify to be fully loaded
  while (Spicetify && (!Spicetify.Menu || !Spicetify.Platform)) {
    await new Promise(resolve => setTimeout(resolve, PS_DELAY_MS));
  }
  
  if (Spicetify && Spicetify.Menu) {
    try {
      // Create a menu item using Spicetify's API
      const menuItem = new Spicetify.Menu.Item(
        PS_PERSISTENT_SESSION_LABEL_TEXT,
        persistentModeEnabled,
        (self) => {
          togglePersistentMode();
          self.setState(persistentModeEnabled);
        }
      );
      menuItem.register();
      console.debug("Private-Session: Successfully registered menu item using Spicetify API");
      apiSuccess = true;
    } catch (error) {
      console.error("Private-Session: Error registering menu item with Spicetify API", error);
    }
  }
  
  // If Spicetify API failed, fall back to DOM manipulation
  if (!apiSuccess) {
    console.debug("Private-Session: Falling back to DOM manipulation");
    addMenuItemWithDOM();
    setupMenuObserver();
  }
  
  // Check initial private session state without opening menu
  await isPrivateSessionActive();
  initialCheckComplete = true;
  
  // Set up persistent mode if enabled in saved settings
  if (persistentModeEnabled) {
    enablePersistentMode();
  }
  
  // Always start private session on initialization, regardless of persistent mode
  // Wait a bit before starting private session
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Check if private session is active
  if (!cachedPrivateSessionState) {
    console.debug("Private-Session: Initial private session activation needed");
    await startPrivateSession(true);
  } else {
    console.debug("Private-Session: Private session already active on initialization");
  }
  
  console.debug("Private-Session: Initialization complete");
}

// Initialize when Spicetify is ready
privateSessionMain(() => {
  const ready = Spicetify && Spicetify.Platform && Spicetify.Platform[PS_SPICETIFY_LAST_LOADED_API] && document.readyState === 'complete';
  if (ready) {
    console.debug("Private-Session: Spicetify is ready");
  }
  return ready;
}, initializePrivateSession);
