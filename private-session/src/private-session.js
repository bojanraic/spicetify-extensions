const PS_CSS_SELECTORS = {
  PRIVATE_SESSION_INDICATOR: "button.main-noConnection-button",
  MAIN_MENU: "div.main-topBar-topbarContentRight > button.main-userWidget-box",
  MENU_ITEM_LABEL: "span",
  MENU_ITEM_BUTTON: "div.main-userWidget-dropDownMenu > ul > li > button.main-contextMenu-menuItemButton",
  MENU_ITEM_CHECKED: "svg"
};
const PS_PRIVATE_SESSION_LABEL_TEXT = "Private session";
const PS_RETRY_LIMIT = 5;
const PS_DELAY_MS = 100;

async function getElement(selector, multiple) {
  for (let retryCount = 0; retryCount < PS_RETRY_LIMIT; retryCount++) {
    if (multiple) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return elements;
      }
    } else {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    }
    await new Promise(resolve => setTimeout(resolve, PS_DELAY_MS));
  }
  return null;
}

async function clickElementBySelector(selector) {
  const element = await getElement(selector, false);
  element.click();
  return element;
}

async function findMenuItemButton(labelText) {
  const menuItems = await getElement(PS_CSS_SELECTORS.MENU_ITEM_BUTTON, true);
  for (const button of menuItems) {
    const label = button.querySelector(PS_CSS_SELECTORS.MENU_ITEM_LABEL);
    if (label && label.textContent.trim() === labelText) {
      return button;
    }
  }
  return null;
}

async function isMenuItemSelected(button) {
  return !!button.querySelector(PS_CSS_SELECTORS.MENU_ITEM_CHECKED);
}

async function startPrivateSession() {
  // Check for private session indicator
  if (!(await getElement(PS_CSS_SELECTORS.PRIVATE_SESSION_INDICATOR, false))) {
    // Open main menu
    const menu = await clickElementBySelector(PS_CSS_SELECTORS.MAIN_MENU);
    const privateSessionMenuItem = await findMenuItemButton(PS_PRIVATE_SESSION_LABEL_TEXT);
    if (privateSessionMenuItem) {
      if (await isMenuItemSelected(privateSessionMenuItem)) {
        // Already selected, close menu
        await menu.click();
      } else {
        // Click to select private session
        await privateSessionMenuItem.click();
      }
    } else {
      console.error(`${PS_PRIVATE_SESSION_LABEL_TEXT} menu item not found`);
    }
  }
}

const privateSessionMain = async (condition, callback) => {
  while (!condition()) {
    await new Promise(resolve => setTimeout(resolve, PS_DELAY_MS));
  }
  await callback();
};

privateSessionMain(() => Spicetify.Platform, startPrivateSession);
