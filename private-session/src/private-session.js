// UI Text constants
const PS_PRIVATE_SESSION_LABEL_TEXT = "Private session";
const PS_PERSISTENT_SESSION_LABEL_TEXT = "Persistent Privacy";

// Configuration constants
const PS_RETRY_LIMIT = 3;
const PS_INDICATOR_RETRIES = 2;  // PS indicator check attempts
const PS_DELAY_MS = 100;
const MENU_OPERATION_COOLDOWN = 500;
// CSS/DOM selectors
const PS_CSS_SELECTORS = {
  // Look for private session indicator container and search within it
  PRIVATE_SESSION_INDICATOR_CONTAINER: ".Root__globalNav > div:last-child",
  MAIN_MENU: ".main-topBar-topbarContentRight button[aria-expanded]",
  MENU_ITEM_LABEL: "span",
  // Updated to be more flexible with menu item detection
  MENU_ITEM_BUTTON: "button[role='menuitemcheckbox'], button[role='menuitem']",
  // Try multiple possible menu container selectors
  PROFILE_DROPDOWN_MENU: "ul.main-contextMenu-menu, [role='menu'], ul[role='menu']"
};
const PS_PERSISTENT_ITEM_ID = "ps-persistent-item"; // Unique ID for our item

// State variables
let persistentModeEnabled = false;
let focusEventListener = null;
let menuItemAdded = false; // Track if we've added our menu item to the CURRENTLY open menu
let menuOperationInProgress = false;
let lastMenuOperationTime = 0;
let pendingFocusCheck = false; // Track if we have a pending focus check
let menuCloseTimer = null; // Timer for closing the menu

/**
 * Attempts to find DOM element(s) using the provided selector(s)
 * @param {string} selector - CSS selector(s) to find the element(s), comma-separated for multiple
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
 * Checks if a menu item button is currently selected
 * @param {Element} button - The menu item button element to check
 * @returns {boolean} Whether the button is selected
 */
function isMenuItemSelected(button) {
  return button.getAttribute('aria-checked') === 'true';
}

/**
 * Finds a menu item button by its label text
 * @param {string} labelText - The text to search for in menu items
 * @returns {Promise<Element|null>} The found menu item button or null
 */
async function findMenuItemButton(labelText) {
  for (let retryCount = 0; retryCount < PS_RETRY_LIMIT; retryCount++) {
    console.debug(`Private-Session: Looking for menu item "${labelText}" - attempt ${retryCount + 1}`);

    const button = searchForMenuItemButton(labelText);
    if (button) return button;

    await new Promise(resolve => setTimeout(resolve, PS_DELAY_MS));
  }

  console.warn(`Private-Session: Menu item "${labelText}" not found after ${PS_RETRY_LIMIT} attempts`);
  return null;
}

function searchForMenuItemButton(labelText) {
  const menuItems = document.querySelectorAll(PS_CSS_SELECTORS.MENU_ITEM_BUTTON);
  if (menuItems.length === 0) return null;

  for (const button of menuItems) {
    if (isMenuItemWithLabel(button, labelText)) {
      console.debug(`Private-Session: Found menu item "${labelText}"`);
      return button;
    }
  }
  return null;
}

function isMenuItemWithLabel(button, labelText) {
  const label = button.querySelector(PS_CSS_SELECTORS.MENU_ITEM_LABEL);
  return label && label.textContent.trim() === labelText;
}

/**
 * Finds the private session indicator if it exists
 * @returns {Promise<Element|null>} The indicator element or null
 */
async function findPrivateSessionIndicator() {
  for (let retryCount = 0; retryCount < PS_INDICATOR_RETRIES; retryCount++) {
    console.debug(`Private-Session: Looking for private session indicator - attempt ${retryCount + 1}`);

    const indicator = searchForPrivateSessionIndicator();
    if (indicator) return indicator;

    await new Promise(resolve => setTimeout(resolve, PS_DELAY_MS));
  }

  console.log('Private-Session: ❌ NO PRIVATE SESSION INDICATOR FOUND after all attempts');
  return null;
}

function searchForPrivateSessionIndicator() {
  const container = document.querySelector(PS_CSS_SELECTORS.PRIVATE_SESSION_INDICATOR_CONTAINER);
  if (!container) {
    console.debug(`Private-Session: Container not found`);
    return null;
  }

  console.debug(`Private-Session: Found container, searching for buttons within it`);
  return findPrivateSessionButtonInContainer(container);
}

function findPrivateSessionButtonInContainer(container) {
  const buttons = container.querySelectorAll('button, * button, * * button, * * * button');
  console.log(`Private-Session: Found ${buttons.length} buttons in container`);

  for (const button of buttons) {
    if (button.textContent.includes(PS_PRIVATE_SESSION_LABEL_TEXT)) {
      console.debug('Private-Session: ✅ Found private session indicator');
      return button;
    }
  }
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
  persistentModeEnabled = savedSetting === "true";
  console.debug(`Private-Session: Loaded persistent mode setting: ${persistentModeEnabled}`);
}

/**
 * Checks if private session is active without opening the menu
 * @returns {Promise<boolean>} Whether private session is active
 */
async function isPrivateSessionActive() {
  const indicator = await findPrivateSessionIndicator();
  const isActive = !!indicator;
  console.debug(`Private-Session: isPrivateSessionActive - found indicator: ${isActive}`);
  return isActive;
}

/**
 * Ensures the menu is closed
 */
function isMenuOpen() {
  const menuButton = document.querySelector(PS_CSS_SELECTORS.MAIN_MENU);
  return menuButton && menuButton.getAttribute('aria-expanded') === 'true';
}

function ensureMenuClosed() {
  // Clear any existing timer
  if (menuCloseTimer) {
    clearTimeout(menuCloseTimer);
    menuCloseTimer = null;
  }

  if (isMenuOpen()) {
    console.debug('Private-Session: Closing open menu');
    const menuButton = document.querySelector(PS_CSS_SELECTORS.MAIN_MENU);
    if (menuButton) {
      menuButton.click();

      menuCloseTimer = setTimeout(() => {
        if (isMenuOpen()) {
          console.debug('Private-Session: Menu still open, clicking again');
          menuButton.click();
        }
        menuCloseTimer = null;
      }, 150);
    }
  }
}

/**
 * Validates if a menu operation can proceed
 */
function canPerformMenuOperation() {
  if (menuOperationInProgress) {
    console.debug('Private-Session: Menu operation already in progress, skipping');
    return false;
  }

  const now = Date.now();
  if (now - lastMenuOperationTime < MENU_OPERATION_COOLDOWN) {
    console.debug('Private-Session: Menu operation cooldown active, skipping');
    return false;
  }

  return true;
}

/**
 * Opens the main menu and waits for it to render
 */
async function openMainMenu() {
  ensureMenuClosed();
  await new Promise(resolve => setTimeout(resolve, 150));

  const menu = await getElement(PS_CSS_SELECTORS.MAIN_MENU, false);
  if (!menu) {
    throw new Error('Failed to find menu button');
  }

  menu.click();
  await new Promise(resolve => setTimeout(resolve, PS_DELAY_MS * 2));
  return menu;
}

/**
 * Finds and activates the private session menu item
 */
async function activatePrivateSessionMenuItem() {
  const privateSessionMenuItem = await findMenuItemButton(PS_PRIVATE_SESSION_LABEL_TEXT);
  if (!privateSessionMenuItem) {
    throw new Error(`${PS_PRIVATE_SESSION_LABEL_TEXT} menu item not found`);
  }

  if (!isMenuItemSelected(privateSessionMenuItem)) {
    console.debug('Private-Session: Clicking private session menu item');
    privateSessionMenuItem.click();
    await new Promise(resolve => setTimeout(resolve, PS_DELAY_MS));
  } else {
    console.debug('Private-Session: Private session already enabled in menu');
  }

  return true;
}

/**
 * Cleanup function for menu operations
 */
function cleanupMenuOperation() {
  ensureMenuClosed();
  menuOperationInProgress = false;
}

/**
 * Starts a private session if not already active
 * @param {boolean} [forceOpen=true] - Whether to force open the menu if needed
 * @returns {Promise<boolean>} Whether the private session was successfully enabled
 */
async function startPrivateSession(forceOpen = true) {
  console.debug(`Private-Session: Starting with forceOpen=${forceOpen}...`);

  if (!canPerformMenuOperation()) {
    return false;
  }

  try {
    const isActive = await isPrivateSessionActive();
    if (isActive) {
      console.debug('Private-Session: Already in private session');
      return true;
    }

    return await handlePrivateSessionActivation(forceOpen);

  } catch (error) {
    console.error('Private-Session: Error in startPrivateSession', error);
    cleanupMenuOperation();
    return false;
  }
}

async function handlePrivateSessionActivation(forceOpen) {
  if (!forceOpen) {
    console.debug('Private-Session: Not in private session, but forceOpen is false');
    return false;
  }

  prepareMenuOperation();
  console.debug('Private-Session: Need to enable private session, opening menu');

  await openMainMenu();
  await activatePrivateSessionMenuItem();

  cleanupMenuOperation();
  return true;
}

function prepareMenuOperation() {
  menuOperationInProgress = true;
  lastMenuOperationTime = Date.now();
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

          // Skip check if conditions not met
          if (!persistentModeEnabled || menuOperationInProgress || isMenuOpen()) {
            console.debug('Private-Session: Skipping focus check - conditions not met');
            return;
          }

          // Check if private session is active without opening menu
          const isActive = await isPrivateSessionActive();
          console.debug(`Private-Session: Focus check - Private session active: ${isActive}, Persistent mode enabled: ${persistentModeEnabled}`);

          // Only act if private session is NOT active and persistent mode is enabled
          if (!isActive && persistentModeEnabled) {
            console.debug('Private-Session: Private session not active after focus, enabling via menu');
            await startPrivateSession(true);
          } else {
            console.debug('Private-Session: Private session already active, no action needed');
          }
        }, 500); // Reduced delay for faster response when needed
      } else {
        console.debug('Private-Session: Focus check already pending, skipping');
      }
    };
    window.addEventListener('focus', focusEventListener);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && persistentModeEnabled && !menuOperationInProgress) {
        focusEventListener();
      }
    });
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
  const targetItem = findTargetMenuItem(menuItemElement);
  if (!targetItem) return;

  const button = targetItem.querySelector("button");
  if (!button) return;

  console.debug("Private-Session: Updating persistent privacy item state");
  updateToggleContainer(button);
}

function findTargetMenuItem(menuItemElement) {
  if (menuItemElement) return menuItemElement;

  const menuList = document.querySelector(PS_CSS_SELECTORS.PROFILE_DROPDOWN_MENU);
  return menuList ? menuList.querySelector(`#${PS_PERSISTENT_ITEM_ID}`) : null;
}

function updateToggleContainer(button) {
  const toggleContainer = ensureToggleContainer(button);
  toggleContainer.innerHTML = createToggleSwitch(persistentModeEnabled);
  toggleContainer.title = persistentModeEnabled ? "Click to disable persistent privacy mode" : "Click to enable persistent privacy mode";
  console.debug("Private-Session: Updated toggle switch to ", persistentModeEnabled ? "enabled" : "disabled");
}

function ensureToggleContainer(button) {
  let toggleContainer = button.querySelector('.sidebar-checkbox');
  if (!toggleContainer) {
    toggleContainer = document.createElement('span');
    toggleContainer.className = 'sidebar-checkbox';
    toggleContainer.style.cssText = "width:40px;height:20px;display:flex;align-items:center;justify-content:center;";
    button.appendChild(toggleContainer);
  }
  return toggleContainer;
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
  persistentModeEnabled = !persistentModeEnabled;
  console.debug(`Private-Session: Toggled persistent mode to: ${persistentModeEnabled}`);
  savePersistentModeSetting();

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
function addPersistentPrivacyItem(menuList, retryCount = 0) {
  const privateSessionItem = findPrivateSessionItem(menuList, retryCount);
  if (!privateSessionItem) return null;

  const menuItem = createPersistentMenuItem(privateSessionItem);
  privateSessionItem.after(menuItem);

  console.log("[Private-Session] Added persistent privacy item after Private session");
  return menuItem;
}

function findPrivateSessionItem(menuList, retryCount) {
  const MAX_RETRIES = 10;
  const RETRY_DELAY = 100;

  const privateSessionSpan = Array.from(menuList.querySelectorAll("span"))
    .find(span => span.textContent === PS_PRIVATE_SESSION_LABEL_TEXT);

  if (!privateSessionSpan) {
    if (retryCount < MAX_RETRIES) {
      setTimeout(() => addPersistentPrivacyItem(menuList, retryCount + 1), RETRY_DELAY);
      console.log(`[Private-Session] Private session item not found, retrying (${retryCount + 1})`);
    } else {
      console.warn("[Private-Session] Could not find Private session item after retries");
    }
    return null;
  }

  const privateSessionItem = privateSessionSpan.closest("li");
  if (!privateSessionItem) {
    console.warn("[Private-Session] Could not find Private session list item");
    return null;
  }

  return privateSessionItem;
}

function createPersistentMenuItem(privateSessionItem) {
  const menuItem = document.createElement("li");
  menuItem.id = PS_PERSISTENT_ITEM_ID;
  menuItem.className = privateSessionItem.className;

  const button = createMenuButton();
  menuItem.appendChild(button);

  return menuItem;
}

function createMenuButton() {
  const button = document.createElement("div");
  button.className = "main-contextMenu-menuItemButton";
  button.style.cssText = "display:flex;align-items:center;padding:8px 12px;cursor:pointer;justify-content:space-between;";
  button.setAttribute("role", "menuitem");

  const label = document.createElement("span");
  label.textContent = PS_PERSISTENT_SESSION_LABEL_TEXT;

  const toggle = createToggleElement();

  button.appendChild(label);
  button.appendChild(toggle);

  addButtonEventListeners(button, toggle);

  return button;
}

function createToggleElement() {
  const toggle = document.createElement("span");
  toggle.className = "sidebar-checkbox";
  toggle.style.cssText = "width:40px;height:20px;display:flex;align-items:center;justify-content:center;";
  toggle.innerHTML = createToggleSwitch(persistentModeEnabled);
  toggle.title = persistentModeEnabled ? "Click to disable persistent privacy mode" : "Click to enable persistent privacy mode";
  return toggle;
}

function addButtonEventListeners(button, toggle) {
  button.addEventListener("mouseover", (event) => {
    event.stopPropagation();
    button.style.backgroundColor = "rgba(255,255,255,0.1)";
  });

  button.addEventListener("mouseout", (event) => {
    event.stopPropagation();
    button.style.backgroundColor = "transparent";
  });

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePersistentMode();
    toggle.innerHTML = createToggleSwitch(persistentModeEnabled);
    toggle.title = persistentModeEnabled ? "Click to disable persistent privacy mode" : "Click to enable persistent privacy mode";
  });
}

/**
 * Ensures the persistent menu item exists and is up-to-date.
 * Adds the item if it doesn't exist.
 * @param {Element} menuList - The menu list element (ul.main-contextMenu-menu).
 */
function ensurePersistentMenuItem(menuList) {
  if (!menuList) return;

  // First check if this is a profile menu by looking for Private session item
  const privateSessionButton = findItemByText(menuList, PS_PRIVATE_SESSION_LABEL_TEXT);
  if (!privateSessionButton) {
    console.log("[Private-Session] This is not a profile menu (no Private session item)");
    return;
  }

  let persistentItem = menuList.querySelector(`#${PS_PERSISTENT_ITEM_ID}`);

  if (persistentItem) {
    // Item exists, just update its state
    updatePersistentMenuItemState(persistentItem);
  } else {
    // Item doesn't exist, add it
    persistentItem = addPersistentPrivacyItem(menuList);
  }
}


/**
 * Helper function to find menu list in a node using multiple selectors
 */
function findMenuInNode(node) {
  const selectors = PS_CSS_SELECTORS.PROFILE_DROPDOWN_MENU.split(', ');
  for (const selector of selectors) {
    const menuList = (node.matches && node.matches(selector.trim()))
      ? node
      : (node.querySelector && node.querySelector(selector.trim()));
    if (menuList) return menuList;
  }
  return null;
}

/**
 * Helper function to check if a node is a menu using multiple selectors
 */
function isMenuNode(node) {
  const selectors = PS_CSS_SELECTORS.PROFILE_DROPDOWN_MENU.split(', ');
  return selectors.some(selector => node.matches && node.matches(selector.trim()));
}

/**
 * Processes added nodes to detect menu appearance
 */
function processAddedNodes(addedNodes) {
  for (const node of addedNodes) {
    if (node.nodeType === 1) {
      const menuList = findMenuInNode(node);
      if (menuList) {
        console.log("[Private-Session] Detected menu appearance");
        return { appeared: true, menuList };
      }
    }
  }
  return { appeared: false, menuList: null };
}

/**
 * Processes removed nodes to detect menu disappearance
 */
function processRemovedNodes(removedNodes) {
  for (const node of removedNodes) {
    if (node.nodeType === 1) {
      const isMenu = isMenuNode(node);
      const containsItem = node.querySelector && node.querySelector(`#${PS_PERSISTENT_ITEM_ID}`);
      if (isMenu || containsItem) {
        console.log("[Private-Session] Detected menu removal");
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks if a menu is the profile menu
 */
function isProfileMenu(menuList) {
  const privateSessionSpan = Array.from(menuList.querySelectorAll("span"))
    .find(span => span.textContent === PS_PRIVATE_SESSION_LABEL_TEXT);

  const hasSettingsItem = Array.from(menuList.querySelectorAll("span"))
    .some(span => span.textContent === "Settings");

  return privateSessionSpan || hasSettingsItem;
}

/**
 * Handles menu appearance events
 */
function handleMenuAppearance(menuList) {
  if (!isProfileMenu(menuList)) {
    console.log("[Private-Session] This appears to be a context menu, not adding our item");
    return;
  }

  console.log("[Private-Session] Profile menu detected");
  const privateSessionSpan = Array.from(menuList.querySelectorAll("span"))
    .find(span => span.textContent === PS_PRIVATE_SESSION_LABEL_TEXT);

  if (privateSessionSpan) {
    console.log("[Private-Session] Ensuring persistent menu item");
    ensurePersistentMenuItem(menuList);
    menuItemAdded = true;
    lastMenuOperationTime = Date.now();
  } else {
    console.log("[Private-Session] Profile menu found but no Private session item");
  }
}

/**
 * Handles menu disappearance events
 */
function handleMenuDisappearance() {
  console.log("[Private-Session] Resetting menuItemAdded flag");
  menuItemAdded = false;
}

/**
 * Handles mutation events for menu detection
 */
function handleMutations(mutations) {
  const menuState = analyzeMutations(mutations);
  handleMenuStateChanges(menuState);
}

function analyzeMutations(mutations) {
  let menuAppeared = false;
  let menuDisappeared = false;
  let detectedMenuList = null;

  for (const mutation of mutations) {
    if (!menuItemAdded && mutation.addedNodes) {
      const result = processAddedNodes(mutation.addedNodes);
      if (result.appeared) {
        menuAppeared = true;
        detectedMenuList = result.menuList;
        break;
      }
    }

    if (menuItemAdded && mutation.removedNodes) {
      if (processRemovedNodes(mutation.removedNodes)) {
        menuDisappeared = true;
        break;
      }
    }
  }

  return { menuAppeared, menuDisappeared, detectedMenuList };
}

function handleMenuStateChanges({ menuAppeared, menuDisappeared, detectedMenuList }) {
  if (menuDisappeared) {
    handleMenuDisappearance();
  }
  if (menuAppeared && detectedMenuList && !menuItemAdded) {
    handleMenuAppearance(detectedMenuList);
  }
}

/**
 * Sets up a mutation observer to watch for menu opening/closing
 */
function setupMenuObserver() {
  console.log("[Private-Session] Setting up menu observer");
  console.log("[Private-Session] Watching for menu selectors:", PS_CSS_SELECTORS.PROFILE_DROPDOWN_MENU);

  const observer = new MutationObserver(handleMutations);

  observer.observe(document.body, { childList: true, subtree: true });
  console.log("[Private-Session] Mutation observer is now observing");
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

  // Set up persistent mode if enabled in saved settings
  console.debug(`Private-Session: Checking persistent mode - enabled: ${persistentModeEnabled}`);
  if (persistentModeEnabled) {
    console.debug('Private-Session: Enabling persistent mode from saved settings');
    enablePersistentMode();
  } else {
    console.debug('Private-Session: Persistent mode not enabled in saved settings');
  }

  // Always start private session on initialization, regardless of persistent mode
  // Wait a bit before starting private session
  await new Promise(resolve => setTimeout(resolve, 800));

  // Check if private session is active and start if needed
  const isActive = await isPrivateSessionActive();
  if (!isActive) {
    console.debug("Private-Session: Initial private session activation needed");
    await startPrivateSession(true);
  } else {
    console.debug("Private-Session: Private session already active on initialization");
  }

  console.debug("Private-Session: Initialization complete");
}

// Initialize when Spicetify is ready
privateSessionMain(() => {
  const ready = Spicetify && Spicetify.Platform && document.readyState === 'complete';
  if (ready) {
    console.debug("Private-Session: Spicetify is ready");
  }
  return ready;
}, initializePrivateSession);
