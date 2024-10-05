const SH_NOW_PLAYING_TEXT = "Now playing view";
const SH_NOW_PLAYING_CLOSE_ID = "PanelHeader_CloseButton";
const SH_FRIEND_ACTIVITY_FEED_TEXT = "Friend Activity";

const SH_SIDEBAR_CSS_SELECTORS = {
  FRIENDS_ACTIVITY_BUTTON: `button.main-topBar-buddyFeed[aria-label='${SH_FRIEND_ACTIVITY_FEED_TEXT}']`,
  NOW_PLAYING_BUTTON: `button.main-genericButton-button[aria-label='${SH_NOW_PLAYING_TEXT}']`,
};

const SH_NOW_PLAYING_ASIDE = `aside[aria-label="${SH_NOW_PLAYING_TEXT}"]`;

const SH_NOW_PLAYING_ASIDE_CLOSE_BTN = `div[data-testid='${SH_NOW_PLAYING_CLOSE_ID}'] > button`

const SH_RETRY_LIMIT = 20;
const SH_DELAY_MS = 350;

async function getElement(selector, parent = null) {
  for (let retryCount = 0; retryCount < SH_RETRY_LIMIT; retryCount++) {
    console.log(`Side-Hide: In getElement for "${selector}" - retry: ${retryCount + 1}`);
    const element = parent != null ? parent.querySelector(selector) : document.querySelector(selector);
    if (element) {
      return element;
    }
    else {
      await new Promise(resolve => setTimeout(resolve, SH_DELAY_MS));
    }
  }
}

async function hideElementBySelector(selector) {
  const element = await getElement(selector);
  console.log(`Side-Hide: Hiding element with selector: "${selector}"`);
  element.style.setProperty('width', '0', 'important');
  element.style.setProperty('display', 'none', 'important');
}


async function hideSide() {
  const nowPlayingAside = await getElement(SH_NOW_PLAYING_ASIDE);
  if (nowPlayingAside != null) {
    const closeBtn = await getElement(SH_NOW_PLAYING_ASIDE_CLOSE_BTN, nowPlayingAside);
    if (closeBtn != null) {
      closeBtn.click();
    }
    else {
      console.error(`Side-Hide: did not find a button with selector: "${SH_NOW_PLAYING_ASIDE_CLOSE_BTN}"`);
    }
  }
  else {
    console.error(`Side-Hide: did not find an aside with selector: "${SH_NOW_PLAYING_ASIDE}"`);
  }
  for (const key in SH_SIDEBAR_CSS_SELECTORS) {
    await hideElementBySelector(SH_SIDEBAR_CSS_SELECTORS[key]);
  }
}

const sh_main = async (condition, callback) => {
  while (!condition()) {
    await new Promise(resolve => setTimeout(resolve, SH_DELAY_MS));
  }
  await callback();
};

sh_main(() => Spicetify.Platform, hideSide);
