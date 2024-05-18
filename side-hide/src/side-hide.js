const CSS_SELECTORS = {
  FRIENDS_ACTIVITY_BUTTON: "button.main-topBar-buddyFeed[aria-label='Friend Activity']",
  NOW_PLAYING_BUTTON: "button.main-genericButton-button[aria-label='Now playing view']",
  SIDEBAR_DIV: ".Root__right-sidebar",
  SIDEBAR_RESIZE_BAR: ".Root__right-sidebar .LayoutResizer__resize-bar"
};

const RETRY_LIMIT = 5;
const DELAY_MS = 100;

async function getElement(selector) {
  for (let retryCount = 0; retryCount < RETRY_LIMIT; retryCount++) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
    else {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }
}

async function hideElement(selector) {
  const element = await getElement(selector);
  element.style.setProperty('width', '0', 'important');
  element.style.setProperty('display', 'none', 'important');
}


async function hideSide() {
  for (const key in CSS_SELECTORS) {
    hideElement(CSS_SELECTORS[key]);
  }
}

const main = async (condition, callback) => {
  while (!condition()) {
    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  }
  await callback();
};

main(() => Spicetify.Platform, hideSide);
