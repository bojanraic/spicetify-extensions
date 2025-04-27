const SH_NOW_PLAYING_TEXT = "Now playing view";
const SH_NOW_PLAYING_CLOSE_ID = "PanelHeader_CloseButton";
const SH_NOW_PLAYING_ASIDE = `aside[aria-label="${SH_NOW_PLAYING_TEXT}"]`;
const SH_NOW_PLAYING_ASIDE_CLOSE_BTN = `div[data-testid='${SH_NOW_PLAYING_CLOSE_ID}'] > button`;
const SH_NOW_PLAYING_HIDE_BTN = `button[aria-label="Hide Now Playing view"]`;

const SH_FRIEND_ACTIVITY_FEED_TEXT = "Friend Activity";
const SH_SIDEBAR_CSS_SELECTORS = {
  FRIENDS_ACTIVITY_BUTTON: `button.main-topBar-buddyFeed[aria-label='${SH_FRIEND_ACTIVITY_FEED_TEXT}']`,
  NOW_PLAYING_BUTTON: `button.main-genericButton-button[aria-label='${SH_NOW_PLAYING_TEXT}']`,
};

const SH_RETRY_LIMIT = 30;
const SH_DELAY_MS = 300;
const SH_SPICETIFY_LAST_LOADED_API = "FeedbackAPI"; // This is the last API that Spotify/Spicetify loads

async function getElement(selector, parent = null) {
  for (let retryCount = 0; retryCount < SH_RETRY_LIMIT; retryCount++) {
    console.log(`Side-Hide: In getElement for '${selector}' - retry: ${retryCount + 1}`);
    const element = parent != null ? parent.querySelector(selector) : document.querySelector(selector);
    if (element) {
      return element;
    }
    else {
      await new Promise(resolve => setTimeout(resolve, SH_DELAY_MS));
    }
  }
  return null; // Return null if element not found after retries
}

async function hideElementBySelector(selector) {
  const element = await getElement(selector);
  if (!element) {
    console.log(`Side-Hide: Element with selector '${selector}' not found to hide`);
    return;
  }
  console.log(`Side-Hide: Hiding element with selector: '${selector}'`);
  element.style.setProperty('width', '0', 'important');
  element.style.setProperty('height', '0', 'important');
  element.style.setProperty('display', 'none', 'important');
}

async function clickButtonIfExists(selector, parent = null, retryInterval = 50, maxRetries = 10) {
  let button = null;
  let attempts = 0;
  
  // Try to find the button
  while (!button && attempts < maxRetries) {
    button = parent 
      ? parent.querySelector(selector) 
      : document.querySelector(selector);
      
    if (!button) {
      await new Promise(resolve => setTimeout(resolve, retryInterval));
      attempts++;
    }
  }
  
  if (button) {
    console.log(`Side-Hide: Found button with selector: '${selector}', clicking it`);
    button.click();
    return true;
  } else {
    console.log(`Side-Hide: Button with selector '${selector}' not found after ${maxRetries} attempts`);
    return false;
  }
}

async function hideSide() {
  console.log("Side-Hide: Initializing...");
  // Set up MutationObserver to detect and handle Now Playing view when it appears
  const observer = new MutationObserver(async (mutations) => {
    // Check if Now Playing view exists
    const nowPlayingAside = document.querySelector(SH_NOW_PLAYING_ASIDE);
    if (nowPlayingAside) {
      console.log(`Side-Hide: Now Playing view detected by observer`);
      
      // First, try to click the "Hide Now Playing view" button
      const hideButtonClicked = await clickButtonIfExists(SH_NOW_PLAYING_HIDE_BTN, nowPlayingAside);
      
      if (!hideButtonClicked) {
        // If the specific hide button wasn't found/clicked, try the close button
        console.log(`Side-Hide: Trying alternate close button`);
        await clickButtonIfExists(SH_NOW_PLAYING_ASIDE_CLOSE_BTN, nowPlayingAside);
      }
      
      // After a short delay, hide the aside if it's still visible
      setTimeout(async () => {
        const stillVisible = document.querySelector(SH_NOW_PLAYING_ASIDE);
        if (stillVisible) {
          console.log(`Side-Hide: Now Playing view still visible after clicking buttons, forcing hide`);
          stillVisible.style.display = 'none';
        }
      }, 500);
    }
  });
  
  // Start observing the document
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-label', 'class', 'style']
  });
  
  console.log(`Side-Hide: Observer set up for Now Playing view`);
  
  // Handle initial Now Playing view if it's already open
  const nowPlayingAside = await getElement(SH_NOW_PLAYING_ASIDE);
  if (nowPlayingAside) {
    console.log(`Side-Hide: Now Playing aside element visible on initialization.`);
    
    // First try the "Hide Now Playing view" button
    const hideButtonClicked = await clickButtonIfExists(SH_NOW_PLAYING_HIDE_BTN, nowPlayingAside);
    
    if (!hideButtonClicked) {
      // If the specific hide button wasn't found/clicked, try the close button
      console.log(`Side-Hide: Trying alternate close button on initialization`);
      const closeButtonClicked = await clickButtonIfExists(SH_NOW_PLAYING_ASIDE_CLOSE_BTN, nowPlayingAside);
      
      if (!closeButtonClicked) {
        console.log(`Side-Hide: Could not find any close buttons, forcing hide`);
        nowPlayingAside.style.display = 'none !important';
        nowPlayingAside.style.visibility = 'hidden !important';
        console.log("Side-Hide: Now Playing view hidden on initialization");
      }
    }
  }
  
  // Hide the buttons in the UI
  for (const key in SH_SIDEBAR_CSS_SELECTORS) {
    await hideElementBySelector(SH_SIDEBAR_CSS_SELECTORS[key]);
  }
  
  console.log("Side-Hide: Initialization complete");
  return observer;
}

const sh_main = async (condition, callback) => {
  let attempts = 0;
  
  console.log("Side-Hide: Waiting for Spicetify to initialize...");
  
  while (!condition() && attempts < SH_RETRY_LIMIT) {
    attempts++;
    console.log(`Side-Hide: Waiting for Spicetify (attempt ${attempts}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, SH_DELAY_MS));
  }
  
  if (attempts >= SH_RETRY_LIMIT) {
    console.log("Side-Hide: Maximum attempts exceeded. Proceeding anyway...");
  } else {
    console.log("Side-Hide: Spicetify is ready.");
  }
  
  // Store the observer to prevent garbage collection
  window._sideHideObserver = await callback();
};

// Initialize when Spicetify is ready, checking for FeedbackAPI and complete document
console.log("Side-Hide: Extension loaded, waiting for Spicetify to initialize...");
sh_main(() => {
  return Spicetify && 
         Spicetify.Platform && 
         Spicetify.Platform[SH_SPICETIFY_LAST_LOADED_API] && 
         document.readyState === 'complete';
}, hideSide);