// UI text — resolved from Translations at init, fallback to English
let PS_PRIVATE_SESSION_LABEL_TEXT = "Private session";

const PS_LOCK_ICON = `<svg role="img" height="16" width="16" aria-hidden="true" viewBox="0 0 16 16" fill="currentColor" style="margin-right:8px;vertical-align:middle;flex-shrink:0"><path d="M11 6V5a3 3 0 0 0-6 0v1H3v8h10V6h-2zm-4-1a1 1 0 0 1 2 0v1H7V5zm1 6.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>`;
const PS_PERSISTENT_ITEM_ID = "ps-persistent-item";

const PS_CSS_SELECTORS = {
  PROFILE_DROPDOWN_MENU: "ul.main-contextMenu-menu, [role='menu'], ul[role='menu']",
};

let persistentModeEnabled = false;

// --- Private Session API ---

function setPrivateSession(enabled) {
  Spicetify.Platform.PrivateSessionAPI.setPrivateSession(enabled);
}

// --- Persistent Mode ---

function loadPersistentModeSetting() {
  persistentModeEnabled = localStorage.getItem("private-session-persistent-mode") === "true";
}

function savePersistentModeSetting() {
  localStorage.setItem("private-session-persistent-mode", persistentModeEnabled.toString());
}

function onFocus() {
  setPrivateSession(true);
}

function onVisibilityChange() {
  if (!document.hidden) setPrivateSession(true);
}

function enablePersistentMode() {
  persistentModeEnabled = true;
  savePersistentModeSetting();
  setPrivateSession(true);
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVisibilityChange);
}

function disablePersistentMode() {
  persistentModeEnabled = false;
  savePersistentModeSetting();
  window.removeEventListener('focus', onFocus);
  document.removeEventListener('visibilitychange', onVisibilityChange);
}

function togglePersistentMode() {
  if (persistentModeEnabled) disablePersistentMode();
  else enablePersistentMode();
}

// --- Toggle UI ---

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

// --- Menu Item ---

function createMenuButton() {
  const button = document.createElement("div");
  button.className = "main-contextMenu-menuItemButton";
  button.style.cssText = "display:flex;align-items:center;padding:8px 12px;cursor:pointer;justify-content:space-between;";
  button.setAttribute("role", "menuitem");

  const label = document.createElement("span");
  label.style.cssText = "display:flex;align-items:center;";
  label.innerHTML = PS_LOCK_ICON + (Spicetify?.Platform?.Translations?.["user.private-session"] ?? PS_PRIVATE_SESSION_LABEL_TEXT);

  const toggle = document.createElement("span");
  toggle.className = "sidebar-checkbox";
  toggle.style.cssText = "width:40px;height:20px;display:flex;align-items:center;justify-content:center;";
  toggle.innerHTML = createToggleSwitch(persistentModeEnabled);
  toggle.title = persistentModeEnabled ? "Click to disable persistent privacy" : "Click to enable persistent privacy";

  button.appendChild(label);
  button.appendChild(toggle);

  button.addEventListener("mouseover", (e) => { e.stopPropagation(); button.style.backgroundColor = "rgba(255,255,255,0.1)"; });
  button.addEventListener("mouseout", (e) => { e.stopPropagation(); button.style.backgroundColor = "transparent"; });
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePersistentMode();
    toggle.innerHTML = createToggleSwitch(persistentModeEnabled);
    toggle.title = persistentModeEnabled ? "Click to disable persistent privacy" : "Click to enable persistent privacy";
  });

  return button;
}

function addPersistentPrivacyItem(menuList) {
  // Find the Private Session list item via role (language-independent)
  const checkboxItem = menuList.querySelector('[role="menuitemcheckbox"]');
  const privateSessionItem = checkboxItem?.closest("li");
  if (!privateSessionItem) return null;

  const menuItem = document.createElement("li");
  menuItem.id = PS_PERSISTENT_ITEM_ID;
  menuItem.className = privateSessionItem.className;
  menuItem.appendChild(createMenuButton());
  privateSessionItem.after(menuItem);
  return menuItem;
}

function updatePersistentMenuItemToggle(menuList) {
  const item = menuList.querySelector(`#${PS_PERSISTENT_ITEM_ID}`);
  if (!item) return;
  const toggle = item.querySelector('.sidebar-checkbox');
  if (!toggle) return;
  toggle.innerHTML = createToggleSwitch(persistentModeEnabled);
}

function ensurePersistentMenuItem(menuList) {
  const existing = menuList.querySelector(`#${PS_PERSISTENT_ITEM_ID}`);
  if (existing) {
    updatePersistentMenuItemToggle(menuList);
  } else {
    addPersistentPrivacyItem(menuList);
  }
}

// --- Menu Observer ---

function isProfileMenu(menuList) {
  return !!menuList.querySelector('[role="menuitemcheckbox"]');
}

function findMenuInNode(node) {
  const selectors = PS_CSS_SELECTORS.PROFILE_DROPDOWN_MENU.split(', ');
  for (const selector of selectors) {
    const found = (node.matches?.(selector.trim())) ? node : node.querySelector?.(selector.trim());
    if (found) return found;
  }
  return null;
}

function setupMenuObserver() {
  let menuItemAdded = false;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (!menuItemAdded && mutation.addedNodes) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          const menuList = findMenuInNode(node);
          if (menuList && isProfileMenu(menuList)) {
            ensurePersistentMenuItem(menuList);
            menuItemAdded = true;
            break;
          }
        }
      }

      if (menuItemAdded && mutation.removedNodes) {
        for (const node of mutation.removedNodes) {
          if (node.nodeType !== 1) continue;
          if (findMenuInNode(node) || node.querySelector?.(`#${PS_PERSISTENT_ITEM_ID}`)) {
            menuItemAdded = false;
            break;
          }
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// --- Init ---

async function initializePrivateSession() {
  const tr = Spicetify?.Platform?.Translations;
  if (tr) {
    PS_PRIVATE_SESSION_LABEL_TEXT = tr["user.private-session"] ?? PS_PRIVATE_SESSION_LABEL_TEXT;
  }

  loadPersistentModeSetting();
  setupMenuObserver();

  // Always start private session on init
  setPrivateSession(true);

  // Restore persistent mode listeners if it was enabled
  if (persistentModeEnabled) {
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
}

// Wait for Spicetify + PrivateSessionAPI to be ready
(async () => {
  while (!(Spicetify?.Platform?.PrivateSessionAPI && document.readyState === 'complete')) {
    await new Promise(r => setTimeout(r, 100));
  }
  await initializePrivateSession();
})();
