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
  MENU_ITEM_CHECKED: "svg",
  PROFILE_DROPDOWN_MENU: "ul.main-contextMenu-menu" // Added for observer
};
const PS_PERSISTENT_ITEM_ID = "ps-persistent-item"; // Unique ID for our item

// State variables
let persistentModeEnabled = false;
let focusEventListener = null;
let menuItemAdded = false; // Track if we've added our menu item to the CURRENTLY open menu
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
  console.log(`Private-Session: Saved persistent mode setting to localStorage: ${persistentModeEnabled}`);
  console.log(`Private-Session: Current localStorage value: ${localStorage.getItem("private-session-persistent-mode")}`);
}

/**
 * Loads the persistent mode setting from localStorage
 */
function loadPersistentModeSetting() {
  const savedSetting = localStorage.getItem("private-session-persistent-mode");
  // Default to false if no setting is found
  persistentModeEnabled = savedSetting === "true";
  console.log(`Private-Session: Loaded persistent mode setting from localStorage: ${persistentModeEnabled}`);
  console.log(`Private-Session: Raw localStorage value: ${savedSetting}`);
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
 * Creates a mobile-style toggle switch HTML
 * @param {boolean} isEnabled - Whether the toggle is enabled
 * @returns {string} The toggle switch HTML
 */
function createToggleSwitch(isEnabled) {
  return `
    <div class="toggle-switch" style="
      position: relative;
      width: 40px;
      height: 20px;
      background-color: ${isEnabled ? '#1DB954' : '#535353'};
      border-radius: 10px;
      transition: background-color 0.3s;
    ">
      <div class="toggle-slider" style="
        position: absolute;
        top: 2px;
        left: ${isEnabled ? '22px' : '2px'};
        width: 16px;
        height: 16px;
        background-color: white;
        border-radius: 50%;
        transition: left 0.3s;
      "></div>
    </div>
  `;
}

/**
 * Updates the state of our persistent privacy menu item if it exists in the DOM
 * @param {Element} [menuItemElement] - Optional: The specific menu item element to update.
 */
function updatePersistentMenuItemState(menuItemElement) {
  let targetItem = menuItemElement;

  // If no specific element provided, try to find it by ID (fallback)
  if (!targetItem) {
    const menuList = document.querySelector(PS_CSS_SELECTORS.PROFILE_DROPDOWN_MENU);
    if (menuList) {
        targetItem = menuList.querySelector(`#${PS_PERSISTENT_ITEM_ID}`);
    }
  }

  if (targetItem) {
    const button = targetItem.querySelector("button");
    if (button) {
        console.debug("Private-Session: Updating persistent privacy item state");
        
        // Create a container for the toggle switch
        let toggleContainer = button.querySelector('.sidebar-checkbox');
        if (!toggleContainer) {
            toggleContainer = document.createElement('span');
            toggleContainer.className = 'sidebar-checkbox';
            toggleContainer.style.cssText = "width:40px;height:20px;display:flex;align-items:center;justify-content:center;";
            button.appendChild(toggleContainer);
        }
        
        // Update the toggle switch
        toggleContainer.innerHTML = createToggleSwitch(persistentModeEnabled);
        toggleContainer.title = persistentModeEnabled ? "Click to disable persistent privacy mode" : "Click to enable persistent privacy mode";
        console.debug("Private-Session: Updated toggle switch to ", persistentModeEnabled ? "enabled" : "disabled");
    }
  } else {
      // console.warn("Private-Session: Could not find persistent menu item to update state.");
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
  console.log(`Private-Session: Toggle triggered - changing from ${persistentModeEnabled} to ${!persistentModeEnabled}`);
  persistentModeEnabled = !persistentModeEnabled;
  savePersistentModeSetting();
  
  // Log the value after toggling
  console.log(`Private-Session: After toggle - persistentModeEnabled = ${persistentModeEnabled}`);
  console.log(`Private-Session: After toggle - localStorage value = ${localStorage.getItem("private-session-persistent-mode")}`);
  
  if (persistentModeEnabled) {
    enablePersistentMode();
  } else {
    disablePersistentMode();
  }
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
  // Find the Private session item to get its position
  const privateSessionSpan = Array.from(menuList.querySelectorAll("span"))
    .find(span => span.textContent === PS_PRIVATE_SESSION_LABEL_TEXT);
  
  if (!privateSessionSpan) {
    console.warn("Private-Session: Could not find Private session item");
    return null;
  }
  
  const privateSessionItem = privateSessionSpan.closest("li");
  if (!privateSessionItem) {
    console.warn("Private-Session: Could not find Private session list item");
    return null;
  }
  
  // Create our own menu item as an <li> to match Spotify's structure
  const menuItem = document.createElement("li");
  menuItem.id = PS_PERSISTENT_ITEM_ID;
  menuItem.className = privateSessionItem.className; // Copy the class for styling

  // Create a button similar to Spotify's menu items but with a custom role
  const button = document.createElement("div");
  button.className = "main-contextMenu-menuItemButton";
  button.style.cssText = "display:flex;align-items:center;padding:8px 12px;cursor:pointer;justify-content:space-between;";
  // Use menuitem role instead of menuitemcheckbox to prevent Spotify's automatic behavior
  button.setAttribute("role", "menuitem");
  
  // Create the label
  const label = document.createElement("span");
  label.textContent = PS_PERSISTENT_SESSION_LABEL_TEXT;
  
  // Create the toggle container
  const toggle = document.createElement("span");
  toggle.className = "sidebar-checkbox";
  toggle.style.cssText = "width:40px;height:20px;display:flex;align-items:center;justify-content:center;";
  toggle.innerHTML = createToggleSwitch(persistentModeEnabled);
  toggle.title = persistentModeEnabled ? "Click to disable persistent privacy mode" : "Click to enable persistent privacy mode";
  
  // Add elements to the button
  button.appendChild(label);
  button.appendChild(toggle);
  
  // Add hover effects
  button.addEventListener("mouseover", () => button.style.backgroundColor = "rgba(255,255,255,0.1)");
  button.addEventListener("mouseout", () => button.style.backgroundColor = "transparent");
  
  // Add click handler
  button.addEventListener("click", () => {
    togglePersistentMode();
    toggle.innerHTML = createToggleSwitch(persistentModeEnabled);
    toggle.title = persistentModeEnabled ? "Click to disable persistent privacy mode" : "Click to enable persistent privacy mode";
  });
  
  // Add the button to the menu item
  menuItem.appendChild(button);

  // Insert after the Private session item
  privateSessionItem.after(menuItem);

  return menuItem;
}

/**
 * Ensures the persistent menu item exists and is up-to-date.
 * Adds the item if it doesn't exist.
 * @param {Element} menuList - The menu list element (ul.main-contextMenu-menu).
 */
function ensurePersistentMenuItem(menuList) {
    if (!menuList) return;

    let persistentItem = menuList.querySelector(`#${PS_PERSISTENT_ITEM_ID}`);
    
    if (persistentItem) {
        // Item exists, just update its state
        updatePersistentMenuItemState(persistentItem);
    } else {
        // Item doesn't exist, add it
        persistentItem = addPersistentPrivacyItem(menuList);
    }
    
    // If persistent mode is enabled, ensure private session is active
    // Only do this check when the menu is interacted with to add/update our item
    if (persistentModeEnabled && persistentItem) { // Check persistentItem exists
        findPrivateSessionIndicator().then(indicator => {
            if (!indicator) {
                console.debug("Private-Session: Private session not active, enabling via current menu");
                const privateSessionButton = findItemByText(menuList, PS_PRIVATE_SESSION_LABEL_TEXT);
                // Check if the private session is active by checking for the indicator directly
                // rather than looking for SVG elements in the menu
                if (privateSessionButton && !indicator) {
                    privateSessionButton.click();
                }
            }
        });
    }
}

/**
 * Updates all menu items to reflect current state - DEPRECATED for primary use
 * Primarily used now for fallback or explicit refresh.
 */
function updateMenuItems() {
  const menuList = document.querySelector(PS_CSS_SELECTORS.PROFILE_DROPDOWN_MENU);
  if (!menuList) {
    console.warn("Private-Session: Menu not found when updating items");
    return;
  }
  
  // Find our persistent privacy item by ID and update it
  const persistentItem = menuList.querySelector(`#${PS_PERSISTENT_ITEM_ID}`);
  if (persistentItem) {
      updatePersistentMenuItemState(persistentItem);
  } else {
      // Optional: Could add it here as a fallback, but observer should handle it
      console.warn("Private-Session: updateMenuItems called but item not found (should be added by observer).");
      //addPersistentPrivacyItem(menuList); 
  }
}

/**
 * Sets up a mutation observer to watch for menu opening/closing
 */
function setupMenuObserver() {
  console.debug("Private-Session: Setting up menu observer");
  
  const observer = new MutationObserver((mutations) => {
    let menuAppeared = false;
    let menuDisappeared = false;
    let detectedMenuList = null;

    for (const mutation of mutations) {
        // Check for added nodes (Menu Appearance)
        if (!menuItemAdded && mutation.addedNodes) {
            for (const node of mutation.addedNodes) {
                // Check if the node itself is the menu or contains it
                if (node.nodeType === 1) {
                     const menuList = node.matches?.(PS_CSS_SELECTORS.PROFILE_DROPDOWN_MENU) 
                                     ? node 
                                     : node.querySelector?.(PS_CSS_SELECTORS.PROFILE_DROPDOWN_MENU);
                    if (menuList) {
                        // console.debug("Private-Session Observer: Detected menu appearance.");
                        menuAppeared = true;
                        detectedMenuList = menuList;
                        break; 
                    }
                }
            }
        }

        // Check for removed nodes (Menu Disappearance)
        if (menuItemAdded && mutation.removedNodes) {
            for (const node of mutation.removedNodes) {
                 if (node.nodeType === 1) {
                    // Check if the removed node *is* the menu or *contains* our item
                    const isMenu = node.matches?.(PS_CSS_SELECTORS.PROFILE_DROPDOWN_MENU);
                    const containsItem = node.querySelector?.(`#${PS_PERSISTENT_ITEM_ID}`); 
                    if (isMenu || containsItem) {
                         // console.debug("Private-Session Observer: Detected menu removal.");
                        menuDisappeared = true;
                        break;
                    }
                 }
            }
        }
        if (menuAppeared || menuDisappeared) break; // Optimization
    }

    // Handle Menu Removal
    if (menuDisappeared) {
        // console.debug("Private-Session Observer: Resetting menuItemAdded flag.");
        menuItemAdded = false;
    }

    // Handle Menu Appearance
    if (menuAppeared && detectedMenuList && !menuItemAdded) {
        // console.debug("Private-Session Observer: Ensuring persistent menu item.");
        ensurePersistentMenuItem(detectedMenuList);
        menuItemAdded = true; 
        
        // Update timestamp to prevent conflicting operations immediately after adding
        lastMenuOperationTime = Date.now(); 
    }
  });
  
  // Start observing the body for added/removed nodes
  observer.observe(document.body, { childList: true, subtree: true });
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
  
  // Set up DOM-based menu handling
  setupMenuObserver();
  
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
