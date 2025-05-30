(function SidebarCustomizer() {
    // --- Configuration --- 
    const CONFIG = {
        PREF_KEY: 'sidebar-customizer-prefs',
        STYLE_TAG_ID: 'sidebar-customizer-styles',
        HIDDEN_NPV_CLASS: 'sidebar-customizer-hidden-npv',
        RETRY: {
            DELAY: 333,
            MAX_ATTEMPTS: 30
        },
        DEFAULT_PREFS: {
            friendActivity: false,
            queue: false,
            connect: false,
            nowPlaying: false,
        }
    };
    
    // Unified selectors object
    const SELECTORS = {
        FRIEND_ACTIVITY: {
            LABEL: "Friend Activity",
            get SELECTOR() { return `[aria-label="${this.LABEL}"]`; }
        },
        QUEUE: {
            LABEL: "Queue",
            get SELECTOR() { return `button[aria-label="${this.LABEL}"]`; }
        },
        CONNECT: {
            LABEL: "Connect to a device",
            get SELECTOR() { return `button[aria-label="${this.LABEL}"]`; }
        },
        NPV: {
            TEXT_LABEL: "Now playing view",
            TEXT_LABEL_ALT: "Now Playing view",
            CLOSE_ID: "PanelHeader_CloseButton",
            get ASIDE_SELECTOR() { return `aside[aria-label="${this.TEXT_LABEL}"]`; },
            get ASIDE_SELECTOR_ALT() { return `aside[aria-label="${this.TEXT_LABEL_ALT}"]`; },
            WIDGET_SELECTOR: 'aside.main-nowPlayingView-nowPlayingWidget',
            CONTAINER_SELECTOR: '.now-playing-view-container',
            get CLOSE_BTN_SELECTOR() { return `div[data-testid='${this.CLOSE_ID}'] > button`; },
            HIDE_BTN_SELECTOR: `button[aria-label="Hide Now Playing view"]`,
            BTN_SELECTOR: `button[data-testid="control-button-npv"]`,
            get BTN_SELECTOR_ALT() { return `button[aria-label="${this.TEXT_LABEL}"]`; },
            BTN_RESTORE_FOCUS_SELECTOR: 'button[data-restore-focus-key="now_playing_view"]',
        },
        LAYOUT: {
            RIGHT_SIDEBAR: '.Root__right-sidebar',
            MAIN_VIEW: '.Root__main-view',
        },
        PROFILE: {
            BUTTON: ".main-userWidget-box",
            DROPDOWN_MENU: ".main-contextMenu-menu",
            SUBMENU_ID: "sidebar-submenu",
            SUBMENU_ITEM_CLASS: "main-contextMenu-menuItem",
            SUBMENU_BUTTON_CLASS: "main-contextMenu-menuItemButton",
            SUBMENU_CHECKBOX_CLASS: "sidebar-checkbox",
        },
        PLAYBAR: {
            NOW_PLAYING_WIDGET: '[data-testid="now-playing-widget"]',
            COVER_ART_CONTAINER: '[data-testid="CoverSlotCollapsed__container"]',
            COVER_ART_BUTTON: '[data-testid="cover-art-button"]',
            EXPAND_BUTTON: '.main-coverSlotCollapsed-expandButton',
            WIDGET_CLASS: '.main-nowPlayingWidget-nowPlaying',
            CONTAINER_CLASS: '.main-coverSlotCollapsed-container',
            COVER_ART_CLASS: '.main-nowPlayingWidget-coverArt',
            TRACK_INFO_CLASS: '.main-trackInfo-container'
        }
    };

    // --- Utility Functions ---
    const utils = {
        // Consolidated storage functions
        prefs: {
            load() {
                try {
                    const raw = localStorage.getItem(CONFIG.PREF_KEY);
                    return raw ? {...CONFIG.DEFAULT_PREFS, ...JSON.parse(raw)} : {...CONFIG.DEFAULT_PREFS};
                } catch {
                    return {...CONFIG.DEFAULT_PREFS};
                }
            },
            save(prefs) {
                localStorage.setItem(CONFIG.PREF_KEY, JSON.stringify(prefs));
            }
        },
        
        // Consolidated DOM functions
        dom: {
            getElement(selector, timeoutMs = 10000) {
                const maxAttempts = timeoutMs / CONFIG.RETRY.DELAY;
                let attempts = 0;
                return new Promise(resolve => {
                    const check = () => {
                        const element = document.querySelector(selector);
                        if (element) {
                            resolve(element);
                        } else if (attempts < maxAttempts) {
                            attempts++;
                            setTimeout(check, CONFIG.RETRY.DELAY);
                        }
                    };
                    check();
                });
            },
            
            getIconSvg(isVisible) {
                return isVisible ?
                    `<svg role="img" height="20" width="20" aria-hidden="true" viewBox="0 0 20 20" style="vertical-align: middle;"><circle cx="10" cy="10" r="9" fill="#1DB954"></circle><path d="M8.5 13.5l-3.5-3.5 1.5-1.5 2 2 4.5-4.5 1.5 1.5z" fill="#FFFFFF"></path></svg>` : 
                    `<svg viewBox="0 0 16 16" width="20" height="20" fill="#E22134"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zm3.5 10.2l-1.3 1.3L8 9.3l-2.2 2.2-1.3-1.3L6.7 8 4.5 5.8l1.3-1.3L8 6.7l2.2-2.2 1.3 1.3L9.3 8l2.2 2.2z"></path></svg>`;
            },
            
            createToggleSwitch(isEnabled) {
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
            },
            
            // Unified style manager
            createOrUpdateStyle() {
                let styleTag = document.getElementById(CONFIG.STYLE_TAG_ID);
                if (!styleTag) {
                    styleTag = document.createElement('style');
                    styleTag.id = CONFIG.STYLE_TAG_ID;
                    document.head.appendChild(styleTag);
                }
                
                const prefs = utils.prefs.load();
                let cssContent = '';
                
                // Base hidden class
                cssContent += `.${CONFIG.HIDDEN_NPV_CLASS} {
                    visibility: hidden !important;
                    width: 0 !important;
                    min-width: 0 !important; 
                    display: none !important;
                }`;
                
                // NPV hiding styles
                if (!prefs.nowPlaying) {
                    // Only target VERY SPECIFIC elements rather than general classes that might affect album art
                    cssContent += `
                        /* Target only the actual NPV panel/aside */
                        ${SELECTORS.NPV.ASIDE_SELECTOR}:not(${SELECTORS.PLAYBAR.NOW_PLAYING_WIDGET}), 
                        ${SELECTORS.NPV.ASIDE_SELECTOR_ALT}:not(${SELECTORS.PLAYBAR.NOW_PLAYING_WIDGET}) {
                            width: 0 !important;
                            height: 0 !important;
                            display: none !important;
                            visibility: hidden !important;
                            overflow: hidden !important;
                        }
                        
                        /* Hide only the NPV buttons but not the widget itself */
                        ${SELECTORS.NPV.BTN_SELECTOR}:not(${SELECTORS.PLAYBAR.COVER_ART_BUTTON}), 
                        ${SELECTORS.NPV.BTN_SELECTOR_ALT}:not(${SELECTORS.PLAYBAR.COVER_ART_BUTTON}), 
                        ${SELECTORS.NPV.BTN_RESTORE_FOCUS_SELECTOR}:not(${SELECTORS.PLAYBAR.COVER_ART_BUTTON}) {
                            display: none !important;
                        }

                        /* Hide the cover art expand button */
                        ${SELECTORS.PLAYBAR.EXPAND_BUTTON} {
                            display: none !important;
                        }

                        /* Disable click events on cover art elements */
                        ${SELECTORS.PLAYBAR.COVER_ART_CONTAINER},
                        ${SELECTORS.PLAYBAR.COVER_ART_BUTTON},
                        ${SELECTORS.PLAYBAR.COVER_ART_CLASS},
                        ${SELECTORS.PLAYBAR.CONTAINER_CLASS} {
                            pointer-events: none !important;
                            cursor: default !important;
                        }
                    `;
                } else {
                    // Ensure the expand button is visible and working when NPV is on
                    cssContent += `
                        /* Ensure the expand/collapse button is visible */
                        ${SELECTORS.PLAYBAR.EXPAND_BUTTON} {
                            display: flex !important;
                            visibility: visible !important;
                            opacity: 1 !important;
                            cursor: pointer !important;
                        }

                        /* Re-enable click events on cover art elements */
                        ${SELECTORS.PLAYBAR.COVER_ART_CONTAINER},
                        ${SELECTORS.PLAYBAR.COVER_ART_BUTTON},
                        ${SELECTORS.PLAYBAR.COVER_ART_CLASS},
                        ${SELECTORS.PLAYBAR.CONTAINER_CLASS} {
                            pointer-events: auto !important;
                            cursor: pointer !important;
                        }
                    `;
                }
                
                // Sidebar visibility
                const shouldHideSidebar = !prefs.nowPlaying && !prefs.queue && !prefs.connect && !prefs.friendActivity;
                if (shouldHideSidebar) {
                    cssContent += `
                        ${SELECTORS.LAYOUT.RIGHT_SIDEBAR} {
                            width: 0 !important;
                            min-width: 0 !important;
                            max-width: 0 !important;
                            overflow: hidden !important;
                            visibility: hidden !important;
                            display: none !important;
                        }
                        ${SELECTORS.LAYOUT.MAIN_VIEW} {
                            margin-right: 0 !important;
                        }`;
                } else {
                    cssContent += `
                        ${SELECTORS.LAYOUT.MAIN_VIEW} {
                            margin-right: 0 !important;
                        }
                        ${SELECTORS.LAYOUT.RIGHT_SIDEBAR}, 
                        ${SELECTORS.LAYOUT.RIGHT_SIDEBAR} > * {
                            padding: 0 !important;
                            margin: 0 !important;
                        }`;
                }
                
                if (styleTag.textContent !== cssContent) {
                    styleTag.textContent = cssContent;
                }
                
                // Update sidebar visibility
                const rightSidebar = document.querySelector(SELECTORS.LAYOUT.RIGHT_SIDEBAR);
                if (rightSidebar && rightSidebar.style.display === 'none' && !shouldHideSidebar) {
                    rightSidebar.style.display = '';
                    rightSidebar.style.visibility = '';
                    rightSidebar.style.width = '';
                    rightSidebar.style.minWidth = '';
                    rightSidebar.style.maxWidth = '';
                }
            }
        }
    };

    // --- Element Control Functions ---
    function applyPreferences(prefs = null) {
        const currentPrefs = prefs || utils.prefs.load();
        
        // Friend Activity
        const friendActivity = document.querySelector(SELECTORS.FRIEND_ACTIVITY.SELECTOR);
        if (friendActivity) friendActivity.style.display = currentPrefs.friendActivity ? '' : 'none';
        
        // Queue
        const queue = document.querySelector(SELECTORS.QUEUE.SELECTOR);
        if (queue) queue.style.display = currentPrefs.queue ? '' : 'none';
        
        // Connect
        const connect = document.querySelector(SELECTORS.CONNECT.SELECTOR);
        if (connect) connect.style.display = currentPrefs.connect ? '' : 'none';
        
        // Now Playing
        const npvSelectors = [
            SELECTORS.NPV.ASIDE_SELECTOR,
            SELECTORS.NPV.ASIDE_SELECTOR_ALT,
            SELECTORS.NPV.WIDGET_SELECTOR
        ];
        
        for (const selector of npvSelectors) {
            const el = document.querySelector(selector);
            if (!el) continue;
            
            if (!currentPrefs.nowPlaying) {
                // Try to click hide/close buttons first
                const hideBtn = el.querySelector(SELECTORS.NPV.HIDE_BTN_SELECTOR);
                if (hideBtn) {
                    hideBtn.click();
                } else {
                    const closeBtn = el.querySelector(SELECTORS.NPV.CLOSE_BTN_SELECTOR);
                    if (closeBtn) closeBtn.click();
                }
                
                // Force hide with styles
                el.style.visibility = 'hidden';
                el.style.width = '0';
                el.style.minWidth = '0';
                el.style.display = 'none';
                el.classList.add(CONFIG.HIDDEN_NPV_CLASS);
            } else {
                el.classList.remove(CONFIG.HIDDEN_NPV_CLASS);
                el.style.visibility = '';
                el.style.width = '';
                el.style.minWidth = '';
                el.style.display = 'block';
            }
        }
        
        // Handle NPV button visibility
        const npvButtonSelectors = [
            SELECTORS.NPV.BTN_SELECTOR,
            SELECTORS.NPV.BTN_SELECTOR_ALT,
            SELECTORS.NPV.BTN_RESTORE_FOCUS_SELECTOR
        ];
        
        let npvButton = null;
        for (const selector of npvButtonSelectors) {
            npvButton = document.querySelector(selector);
            if (npvButton) {
                npvButton.style.display = currentPrefs.nowPlaying ? '' : 'none';
                break;
            }
        }
        
        // Update styles
        utils.dom.createOrUpdateStyle();
        
        // Auto-show NPV if enabled and music is playing
        if (currentPrefs.nowPlaying && Spicetify?.Player?.data?.isPaused === false && npvButton) {
            setTimeout(() => {
                const npvVisible = document.querySelector(SELECTORS.NPV.ASIDE_SELECTOR) || 
                                  document.querySelector(SELECTORS.NPV.ASIDE_SELECTOR_ALT);
                if (!npvVisible && npvButton.style.display !== 'none') {
                    npvButton.click();
                }
            }, 200);
        }
    }

    // --- UI Components ---
    function createMenuItem(item, prefs) {
        const menuItem = document.createElement("div");
        menuItem.className = SELECTORS.PROFILE.SUBMENU_BUTTON_CLASS;
        menuItem.dataset.pref = item.pref;
        menuItem.role = "menuitemcheckbox";
        menuItem.style.cssText = "display:flex;align-items:center;padding:8px 12px;cursor:pointer;justify-content:space-between;";
        
        const label = document.createElement("span");
        label.textContent = item.name;
        
        const checkbox = document.createElement("span");
        checkbox.className = SELECTORS.PROFILE.SUBMENU_CHECKBOX_CLASS;
        checkbox.style.cssText = "width:40px;height:20px;display:flex;align-items:center;justify-content:center;";
        checkbox.innerHTML = utils.dom.createToggleSwitch(prefs[item.pref]);
        checkbox.title = prefs[item.pref] ? `Click to hide ${item.name}` : `Click to show ${item.name}`;
        
        menuItem.appendChild(label);
        menuItem.appendChild(checkbox);
        
        menuItem.addEventListener("mouseover", () => menuItem.style.backgroundColor = "rgba(255,255,255,0.1)");
        menuItem.addEventListener("mouseout", () => menuItem.style.backgroundColor = "transparent");
        
        menuItem.addEventListener("click", () => {
            const currentPrefs = utils.prefs.load();
            currentPrefs[item.pref] = !currentPrefs[item.pref];
            utils.prefs.save(currentPrefs);
            applyPreferences(currentPrefs);
            checkbox.innerHTML = utils.dom.createToggleSwitch(currentPrefs[item.pref]);
            checkbox.title = currentPrefs[item.pref] ? `Click to hide ${item.name}` : `Click to show ${item.name}`;
        });
        
        return menuItem;
    }
    
    function addCustomSubMenu(dropdownMenu, prefs) {
        try {
            const existingMenu = dropdownMenu.querySelector(`#${SELECTORS.PROFILE.SUBMENU_ID}`);
            if (existingMenu) {
                // Update checkboxes if menu already exists
                existingMenu.querySelectorAll(`.${SELECTORS.PROFILE.SUBMENU_CHECKBOX_CLASS}`).forEach(checkbox => {
                    const menuItem = checkbox.closest("[data-pref]");
                    if (menuItem) {
                        checkbox.innerHTML = utils.dom.createToggleSwitch(prefs[menuItem.dataset.pref]);
                    }
                });
                return;
            }
            
            const submenuContainer = document.createElement("div");
            submenuContainer.id = SELECTORS.PROFILE.SUBMENU_ID;
            submenuContainer.style.cssText = "padding:8px 0;border-top:1px solid var(--essential-subdued,rgba(255,255,255,0.1));border-bottom:1px solid var(--essential-subdued,rgba(255,255,255,0.1));margin:8px 0;";
            
            const submenuHeader = document.createElement("div");
            submenuHeader.className = SELECTORS.PROFILE.SUBMENU_BUTTON_CLASS;
            submenuHeader.style.cssText = "padding:0 8px 4px 8px;font-weight:bold;border-bottom:1px solid var(--essential-subdued,rgba(255,255,255,0.1));margin-bottom:4px;";
            submenuHeader.textContent = "Sidebar Customizer";
            submenuContainer.appendChild(submenuHeader);
            
            const items = [
                { name: SELECTORS.FRIEND_ACTIVITY.LABEL, pref: "friendActivity" },
                { name: SELECTORS.QUEUE.LABEL, pref: "queue" },
                { name: SELECTORS.CONNECT.LABEL, pref: "connect" },
                { name: SELECTORS.NPV.TEXT_LABEL_ALT, pref: "nowPlaying" }
            ];
            
            items.forEach(item => submenuContainer.appendChild(createMenuItem(item, prefs)));
            
            // Find position to insert (before Settings)
            let settingsItem = Array.from(dropdownMenu.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]'))
                .find(item => item.textContent?.trim() === 'Settings');
                
            let referenceNode = null;
            if (settingsItem) {
                while (settingsItem && settingsItem.parentNode !== dropdownMenu) {
                    settingsItem = settingsItem.parentNode;
                }
                if (settingsItem && settingsItem.parentNode === dropdownMenu) {
                    referenceNode = settingsItem;
                }
            }
            
            dropdownMenu.insertBefore(submenuContainer, referenceNode || null);
        } catch (error) {
            console.error("SidebarCustomizer: Menu creation error:", error);
        }
    }

    // --- Event Handlers & Observers ---
    function setupEventListeners() {
        // Single observer for NPV and menu
        console.log('[SidebarCustomizer] Setting up mutation observer');
        const observer = new MutationObserver(mutations => {
            console.log('[SidebarCustomizer] Mutation observer callback fired', mutations);
            const prefs = utils.prefs.load();
            
            // Check if NPV appeared and should be hidden
            if (!prefs.nowPlaying) {
                const nowPlayingView = document.querySelector(SELECTORS.NPV.ASIDE_SELECTOR) || 
                                      document.querySelector(SELECTORS.NPV.ASIDE_SELECTOR_ALT) || 
                                      document.querySelector(SELECTORS.NPV.WIDGET_SELECTOR);
                                      
                if (nowPlayingView && !nowPlayingView.classList.contains(CONFIG.HIDDEN_NPV_CLASS)) {
                    setTimeout(() => {
                        const closeBtn = nowPlayingView.querySelector(SELECTORS.NPV.CLOSE_BTN_SELECTOR) || 
                                        nowPlayingView.querySelector(SELECTORS.NPV.HIDE_BTN_SELECTOR);
                        if (closeBtn) closeBtn.click();
                        
                        nowPlayingView.style.cssText = "visibility:hidden;width:0;min-width:0;display:none;";
                        nowPlayingView.classList.add(CONFIG.HIDDEN_NPV_CLASS);
                        
                        const npvButton = document.querySelector(SELECTORS.NPV.BTN_SELECTOR) || 
                                         document.querySelector(SELECTORS.NPV.BTN_SELECTOR_ALT);
                        if (npvButton) npvButton.style.display = 'none';
                        
                        utils.dom.createOrUpdateStyle();
                    }, 50);
                }
            }
            
            // Check for profile menu opening
            const profileMenu = document.querySelector(SELECTORS.PROFILE.DROPDOWN_MENU);
            if (profileMenu) {
                console.log('[SidebarCustomizer] Found a menu:', profileMenu);
                // Only add submenu if this is the profile menu (check for 'Settings' item)
                const menuItems = Array.from(profileMenu.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]'));
                console.log('[SidebarCustomizer] Menu items:', menuItems.map(item => item.textContent?.trim()));
                const hasSettings = menuItems.some(item => item.textContent?.trim() === 'Settings');
                console.log('[SidebarCustomizer] Has Settings:', hasSettings);
                if (hasSettings) {
                    const hasCustomMenu = profileMenu.querySelector(`#${SELECTORS.PROFILE.SUBMENU_ID}`);
                    if (!hasCustomMenu) {
                        console.log('[SidebarCustomizer] Injecting custom submenu');
                        addCustomSubMenu(profileMenu, prefs);
                    } else {
                        console.log('[SidebarCustomizer] Custom submenu already present');
                    }
                }
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class', 'aria-label']
        });
        console.log('[SidebarCustomizer] Mutation observer is now observing');
        
        // Setup profile menu button listener
        utils.dom.getElement(SELECTORS.PROFILE.BUTTON).then(button => {
            button.addEventListener('click', () => {
                setTimeout(() => {
                    const menu = document.querySelector(SELECTORS.PROFILE.DROPDOWN_MENU);
                    if (menu && !menu.querySelector(`#${SELECTORS.PROFILE.SUBMENU_ID}`)) {
                        addCustomSubMenu(menu, utils.prefs.load());
                    }
                }, 150);
            });
        });
        
        // Player events
        if (Spicetify?.Player) {
            Spicetify.Player.addEventListener("onplaypause", () => {
                setTimeout(() => {
                    const prefs = utils.prefs.load();
                    if (prefs.nowPlaying && Spicetify.Player?.data?.isPaused === false) {
                        const npvButton = document.querySelector(SELECTORS.NPV.BTN_SELECTOR) || 
                                         document.querySelector(SELECTORS.NPV.BTN_SELECTOR_ALT);
                        const npvVisible = document.querySelector(SELECTORS.NPV.ASIDE_SELECTOR) || 
                                          document.querySelector(SELECTORS.NPV.ASIDE_SELECTOR_ALT);
                                          
                        if (npvButton && !npvVisible && npvButton.style.display !== 'none') {
                            npvButton.click();
                        }
                    }
                }, 200);
            });
        }
        
        return observer;
    }

    // --- Initialization ---
    async function init() {
        try {
            console.log('[SidebarCustomizer] init() called');
            // Wait for Spicetify
            let attempts = 0;
            while (!(window.Spicetify && Spicetify.Platform && Spicetify.Platform.History) && 
                   attempts < CONFIG.RETRY.MAX_ATTEMPTS) {
                await new Promise(r => setTimeout(r, CONFIG.RETRY.DELAY));
                attempts++;
            }
            
            // Initialize
            utils.dom.createOrUpdateStyle();
            applyPreferences();
            setupEventListeners();
            
            console.log("SidebarCustomizer: Initialized");
        } catch (error) {
            console.error("SidebarCustomizer: Init error:", error);
        }
    }
    
    init();
})();
