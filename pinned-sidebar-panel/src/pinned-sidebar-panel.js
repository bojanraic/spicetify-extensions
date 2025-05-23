(function PinnedSidebarPanel() {
    let autoRestoreTimer = null;
    let isStartupPhase = true; // Flag to prevent timer conflicts during startup

    const CONFIG = {
        PREF_KEY: 'persistent-sidebar-panel-prefs', // Unique key
        RETRY: {
            DELAY: 333,
            MAX_ATTEMPTS: 30
        },
        DEFAULT_PREFS: {
            autoRestoreEnabled: false,
            autoRestorePanel: null, // Default to null, user must select
            autoRestoreTimeout: 20
        }
    };

    const SELECTORS = {
        FRIEND_ACTIVITY: {
            LABEL: "Friend Activity",
            BUTTON_ARIA_LABEL: "Friend Activity",
            get ACTIVATOR_SELECTOR() { return `button[aria-label="${this.BUTTON_ARIA_LABEL}"]`; },
            CONTENT_SELECTOR: `aside[aria-label="Friend Activity"]`
        },
        QUEUE: {
            LABEL: "Queue",
            get ACTIVATOR_SELECTOR() { return `button[aria-label="${this.LABEL}"]`; },
            CONTENT_SELECTOR: `aside[aria-label="Queue"]`
        },
        CONNECT: {
            LABEL: "Connect to a device",
            get ACTIVATOR_SELECTOR() { return `button[aria-label="${this.LABEL}"]`; },
            CONTENT_MODAL_SELECTOR: `aside[aria-label="Connect to a device"], div[aria-label="Connect to a device"][role="dialog"], div[aria-label="Devices Available"][role="dialog"]`
        },
        NPV: {
            LABEL: "Now Playing view",
            ASIDE_ARIA_LABEL_PRIMARY: "Now Playing view",
            ASIDE_ARIA_LABEL_FALLBACK: "Now playing view",
            BUTTON_ARIA_LABEL: "Now Playing view",
            BTN_SELECTOR_LEGACY_TESTID: `button[data-testid="control-button-npv"]`,
            get ACTIVATOR_SELECTOR() { 
              return [
                this.BTN_SELECTOR_LEGACY_TESTID, // 1. data-testid (most reliable)
                `button[aria-label="${this.BUTTON_ARIA_LABEL}"]`, // 2. aria-label "Now Playing view"
                `button[aria-label="${this.ASIDE_ARIA_LABEL_FALLBACK}"]` // 3. aria-label "Now playing view"
              ].join(', ');
            },
            get CONTENT_SELECTOR() { return `aside[aria-label="${this.ASIDE_ARIA_LABEL_PRIMARY}"], aside[aria-label="${this.ASIDE_ARIA_LABEL_FALLBACK}"]`; },
        },
        LAYOUT: {
            RIGHT_SIDEBAR: '.Root__right-sidebar',
            MAIN_VIEW: '.Root__main-view',
        },
        PROFILE: { // Needed for adding the settings menu
            BUTTON: ".main-userWidget-box",
            DROPDOWN_MENU: ".main-contextMenu-menu",
            SUBMENU_ID: "persistent-sidebar-panel-submenu", // Unique ID
            SUBMENU_BUTTON_CLASS: "main-contextMenu-menuItemButton",
            SUBMENU_CHECKBOX_CLASS: "persistent-sidebar-panel-checkbox", // Unique class if needed
        }
    };

    const utils = {
        time: {
            getFormattedTimestamp() {
                const now = new Date();
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const seconds = String(now.getSeconds()).padStart(2, '0');
                const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
                return `${hours}:${minutes}:${seconds}.${milliseconds}`;
            }
        },
        log: (level, ...args) => {
            const timestamp = utils.time.getFormattedTimestamp();
            switch (level) {
                case 'warn':
                    console.warn(`[${timestamp}] [PinnedPanel]`, ...args);
                    break;
                case 'error':
                    console.error(`[${timestamp}] [PinnedPanel]`, ...args);
                    break;
                default:
                    console.log(`[${timestamp}] [PinnedPanel]`, ...args);
                    break;
            }
        },
        prefs: {
            load() {
                try {
                    const raw = localStorage.getItem(CONFIG.PREF_KEY);
                    const loaded = raw ? JSON.parse(raw) : {};
                    return { ...CONFIG.DEFAULT_PREFS, ...loaded };
                } catch {
                    return { ...CONFIG.DEFAULT_PREFS };
                }
            },
            save(prefs) {
                localStorage.setItem(CONFIG.PREF_KEY, JSON.stringify(prefs));
            }
        },
        dom: {
            getElement(selector, timeoutMs = 10000) {
                const maxAttempts = timeoutMs / CONFIG.RETRY.DELAY;
                let attempts = 0;
                return new Promise((resolve) => { // Removed reject, not strictly needed if resolving null
                    const check = () => {
                        const element = document.querySelector(selector);
                        if (element) {
                            resolve(element);
                        } else if (attempts < maxAttempts) {
                            attempts++;
                            setTimeout(check, CONFIG.RETRY.DELAY);
                        } else {
                            resolve(null); // Resolve with null if not found
                        }
                    };
                    check();
                });
            },
            createToggleSwitch(isEnabled) {
                return `
                    <div class="toggle-switch" style="
                        position: relative; width: 40px; height: 20px;
                        background-color: ${isEnabled ? '#1DB954' : '#535353'};
                        border-radius: 10px; transition: background-color 0.3s;">
                        <div class="toggle-slider" style="
                            position: absolute; top: 2px; left: ${isEnabled ? '22px' : '2px'};
                            width: 16px; height: 16px; background-color: white;
                            border-radius: 50%; transition: left 0.3s;"></div>
                    </div>`;
            }
        }
    };

    async function switchToPreferredPanel(panelLabelToOpen) {
        utils.log('log', `[PSP Switch] Called for target: '${panelLabelToOpen}'`);
        if (!panelLabelToOpen) {
            utils.log('warn', "[PSP Switch] No panelLabelToOpen. Bailing.");
            return;
        }

        let initialActivePanelLabel = getActivePanelLabel();
        utils.log('log', `[PSP Switch] Initial active: '${initialActivePanelLabel}', Target: '${panelLabelToOpen}'`);

        if (initialActivePanelLabel === panelLabelToOpen) {
            utils.log('log', `[PSP Switch] Target panel '${panelLabelToOpen}' is ALREADY active. No action needed.`);
            return;
        }

        // --- Attempt to close current active panel if it's not the target ---
        let activePanelAfterCloseAttempt = initialActivePanelLabel;
        if (initialActivePanelLabel && initialActivePanelLabel !== panelLabelToOpen) {
            utils.log('log', `[PSP Switch] Current '${initialActivePanelLabel}' differs. Attempting close.`);
            let currentPanelKeyToClose = null;
            for (const key in SELECTORS) {
                if (SELECTORS[key].LABEL === initialActivePanelLabel) {
                    currentPanelKeyToClose = key;
                    break;
                }
            }

            if (currentPanelKeyToClose && SELECTORS[currentPanelKeyToClose] && SELECTORS[currentPanelKeyToClose].ACTIVATOR_SELECTOR) {
                const currentActivatorSelector = SELECTORS[currentPanelKeyToClose].ACTIVATOR_SELECTOR;
                const currentActivatorButton = await utils.dom.getElement(currentActivatorSelector, 1000);
                
                if (currentActivatorButton && typeof currentActivatorButton.click === 'function') {
                    utils.log('log', `[PSP Switch] Found activator for '${initialActivePanelLabel}'. CLICKING TO CLOSE.`);
                    currentActivatorButton.click();
                    await new Promise(r => setTimeout(r, 250)); // Wait for DOM
                    activePanelAfterCloseAttempt = getActivePanelLabel();
                    utils.log('log', `[PSP Switch] Active after close attempt of '${initialActivePanelLabel}': '${activePanelAfterCloseAttempt}'`);
                } else {
                    utils.log('warn', `[PSP Switch] Could not click activator to close '${initialActivePanelLabel}'`);
                }
            } else {
                utils.log('warn', `[PSP Switch] No activator selector for current panel '${initialActivePanelLabel}' to attempt close.`);
            }
        } else if (initialActivePanelLabel && initialActivePanelLabel === panelLabelToOpen) {
             utils.log('log', `[PSP Switch] Current panel '${initialActivePanelLabel}' is already the target. No close needed.`);
        } else {
            utils.log('log', "[PSP Switch] No initial active panel, or it is already the target. Skipping close phase.");
        }

        // --- Attempt to open the target panel ---
        utils.log('log', `[PSP Switch] Proceeding to OPEN target: '${panelLabelToOpen}'`);
        let panelKeyToOpen = null;
        for (const key in SELECTORS) {
            if (SELECTORS[key].LABEL === panelLabelToOpen) {
                panelKeyToOpen = key;
                break;
            }
        }

        if (!panelKeyToOpen) {
            utils.log('error', `[PSP Switch] Cannot find panel key for target: '${panelLabelToOpen}'. Bailing open.`);
            return;
        }

        const activatorSelectorToOpen = SELECTORS[panelKeyToOpen].ACTIVATOR_SELECTOR;
        if (!activatorSelectorToOpen) {
            utils.log('error', `[PSP Switch] No activator selector for target '${panelLabelToOpen}'. Bailing open.`);
            return;
        }

        let currentActivePanelBeforeOpen = getActivePanelLabel(); 
        utils.log('log', `[PSP Switch] Active before open checks: '${currentActivePanelBeforeOpen}'. Target: '${panelLabelToOpen}'`);

        if (currentActivePanelBeforeOpen === panelLabelToOpen) {
            utils.log('log', `[PSP Switch] Target '${panelLabelToOpen}' became active before explicit open needed.`);
            return;
        }
        
        // Final content visibility checks before clicking activator to OPEN
        if (panelKeyToOpen === "CONNECT") {
            const connectModalSelectorString = SELECTORS.CONNECT.CONTENT_MODAL_SELECTOR;
            const connectModal = document.querySelector(connectModalSelectorString);
            if (connectModal && connectModal.offsetParent !== null && (connectModal.clientHeight > 0 || connectModal.clientWidth > 0)) {
                utils.log('log', `[PSP Switch]   CONNECT modal content ALREADY VISIBLE. Skipping click.`);
                return;
            }
        }
        if (panelKeyToOpen === "NPV") {
             const npvContent = document.querySelector(SELECTORS.NPV.CONTENT_SELECTOR);
             if (npvContent && npvContent.offsetParent !== null && (npvContent.clientHeight > 0 || npvContent.clientWidth > 0)) {
                utils.log('log', `[PSP Switch]   NPV content ALREADY VISIBLE. Skipping click.`);
                return;
             }
        }
        if (panelKeyToOpen === "FRIEND_ACTIVITY") {
            const faContent = document.querySelector(SELECTORS.FRIEND_ACTIVITY.CONTENT_SELECTOR);
            let faVisible = false;
            if (faContent && faContent.offsetParent !== null && (faContent.clientHeight > 0 || faContent.clientWidth > 0)) {
                const faScrollable = faContent.querySelector(".main-buddyFeed-scrollableContainer");
                // Accept if scrollable container exists with height, or if the aside is visible (fallback)
                if ((faScrollable && faScrollable.clientHeight > 0) || faContent) {
                    faVisible = true;
                }
            }
            if (faVisible) {
                utils.log('log', `[PSP Switch]   FRIEND_ACTIVITY content ALREADY VISIBLE. Skipping click.`);
                return;
            }
        }
        if (panelKeyToOpen === "QUEUE") {
            const queueContentSelectorValue = SELECTORS.QUEUE.CONTENT_SELECTOR; 
            let queueVisible = false;
            let queueContent = null;
            if (queueContentSelectorValue) { 
                queueContent = document.querySelector(queueContentSelectorValue);
                if (queueContent && queueContent.offsetParent !== null && (queueContent.clientHeight > 0 || queueContent.clientWidth > 0)) {
                    queueVisible = true;
                }
            }
            if (queueVisible) {
                utils.log('log', `[PSP Switch]   QUEUE content ALREADY VISIBLE. Skipping click.`);
                return;
            }
        }

        const targetElementToOpen = await utils.dom.getElement(activatorSelectorToOpen, 2000);
        if (targetElementToOpen && typeof targetElementToOpen.click === 'function') {
            utils.log('log', `[PSP Switch] Found activator for target '${panelLabelToOpen}'. Button text: '${targetElementToOpen.textContent?.trim()}', aria-label: '${targetElementToOpen.getAttribute('aria-label')}', aria-selected: '${targetElementToOpen.getAttribute('aria-selected')}'. CLICKING TO OPEN.`);
            targetElementToOpen.click();
            await new Promise(r => setTimeout(r, 100)); 
        } else {
            utils.log('error', `[PSP Switch] Could not click activator for target panel: '${panelLabelToOpen}'`);
            const finalPanelState = getActivePanelLabel();
            utils.log('log', `[PSP Switch] Switch failed for '${panelLabelToOpen}'. Final panel: '${finalPanelState}'.`);
            return;
        }

        // --- NPV Cleanup Phase ---
        // After all operations to make panelLabelToOpen active, check if it was successful
        // and if panelLabelToOpen is not NPV itself, then clean up lingering NPV.
        const currentActivePanelAfterOpen = getActivePanelLabel();
        utils.log('log', `[PSP Switch] Panel state after open/activation attempts for '${panelLabelToOpen}': '${currentActivePanelAfterOpen}'`);

        if (currentActivePanelAfterOpen === panelLabelToOpen && panelLabelToOpen !== SELECTORS.NPV.LABEL) {
            // Wait a brief moment for the main panel UI to settle, then check NPV
            await new Promise(r => setTimeout(r, 150)); 
            const npvContentElement = document.querySelector(SELECTORS.NPV.CONTENT_SELECTOR);
            if (npvContentElement && npvContentElement.offsetParent !== null && (npvContentElement.clientHeight > 0 || npvContentElement.clientWidth > 0)) {
                utils.log('log', `[PSP Switch] Target '${panelLabelToOpen}' is active. Lingering NPV detected. Attempting to close NPV.`);
                const npvActivator = await utils.dom.getElement(SELECTORS.NPV.ACTIVATOR_SELECTOR, 500);
                if (npvActivator && typeof npvActivator.click === 'function') {
                    npvActivator.click();
                    await new Promise(r => setTimeout(r, 150)); // Allow NPV to close
                } else {
                    utils.log('warn', `[PSP Switch] Could not find/click NPV activator for cleanup.`);
                }
            }
        }
        const finalEffectivePanel = getActivePanelLabel();
        utils.log('log', `[PSP Switch] Completed for '${panelLabelToOpen}'. Final effective panel: '${finalEffectivePanel}'`);
    }

    function getActivePanelLabel() {
        const panelChecks = [
            { key: "FRIEND_ACTIVITY", label: SELECTORS.FRIEND_ACTIVITY.LABEL, contentSelector: SELECTORS.FRIEND_ACTIVITY.CONTENT_SELECTOR, activatorSelector: SELECTORS.FRIEND_ACTIVITY.ACTIVATOR_SELECTOR },
            { key: "QUEUE", label: SELECTORS.QUEUE.LABEL, contentSelector: SELECTORS.QUEUE.CONTENT_SELECTOR, activatorSelector: SELECTORS.QUEUE.ACTIVATOR_SELECTOR },
            { key: "CONNECT", label: SELECTORS.CONNECT.LABEL, contentSelector: SELECTORS.CONNECT.CONTENT_MODAL_SELECTOR, activatorSelector: SELECTORS.CONNECT.ACTIVATOR_SELECTOR },
            {
                key: "NPV", label: SELECTORS.NPV.LABEL,
                contentSelector: SELECTORS.NPV.CONTENT_SELECTOR,
                activatorSelector: SELECTORS.NPV.ACTIVATOR_SELECTOR
            }
        ];

        for (const check of panelChecks) {
            let contentElement = null;

            if (check.contentSelector) {
                contentElement = document.querySelector(check.contentSelector);
                utils.log('log', `[PSP getActivePanelLabel] Checking ${check.key}: contentSelector='${check.contentSelector}', found=${!!contentElement}`);
            }

            const activatorElement = check.activatorSelector ? document.querySelector(check.activatorSelector.split(',')[0]) : null;

            if (contentElement) {
                const isVisible = contentElement.offsetParent !== null && contentElement.style.display !== 'none' && (contentElement.clientHeight > 0 || contentElement.clientWidth > 0);
                if (isVisible) {
                    if (check.key === "FRIEND_ACTIVITY") {
                        const faScrollable = contentElement.querySelector(".main-buddyFeed-scrollableContainer");
                        const faAlternative = contentElement.querySelector("[class*='scrollable'], [class*='content'], div > div");
                        utils.log('log', `[PSP getActivePanelLabel] FA Debug - Content element found: ${!!contentElement}, isVisible: ${isVisible}, scrollable: ${!!faScrollable}, alternative: ${!!faAlternative}, scrollable height: ${faScrollable ? faScrollable.clientHeight : 'N/A'}`);
                        
                        // Accept if scrollable container exists with height, or if the aside is visible (fallback)
                        if ((faScrollable && faScrollable.clientHeight > 0) || isVisible) {
                            utils.log('log', `[PSP getActivePanelLabel] Detected active panel (FA specific): ${check.label}`);
                            return check.label;
                        }
                    } else {
                        utils.log('log', `[PSP getActivePanelLabel] Detected active panel by content: ${check.label}`);
                        return check.label;
                    }
                }
            }
            
            if (activatorElement && activatorElement.getAttribute('aria-selected') === 'true') {
                if (check.key !== "FRIEND_ACTIVITY") {
                    utils.log('log', `[PSP getActivePanelLabel] Detected active panel by activator: ${check.label}`);
                    return check.label;
                }
            }
        }
        utils.log('log', "[PSP getActivePanelLabel] No active panel detected.");
        return null;
    }

    function handleSidebarPanelChange() {
        if (autoRestoreTimer) {
            clearTimeout(autoRestoreTimer);
            autoRestoreTimer = null;
        }
        const prefs = utils.prefs.load();
        if (!prefs.autoRestoreEnabled || !prefs.autoRestorePanel) return;

        // Skip auto-restore during startup phase to prevent conflicts
        if (isStartupPhase) {
            utils.log('log', "Skipping auto-restore timer during startup phase.");
            return;
        }

        const activePanel = getActivePanelLabel();
        
        const timeoutCallback = () => {
            const currentActiveBeforeSwitch = getActivePanelLabel();
            utils.log('log', `Auto-restore timer fired. Current panel: '${currentActiveBeforeSwitch}'. Preferred panel: '${prefs.autoRestorePanel}'.`);
            if (currentActiveBeforeSwitch !== prefs.autoRestorePanel) {
                utils.log('log', `Conditions met. Attempting to switch to preferred panel: ${prefs.autoRestorePanel}`);
                switchToPreferredPanel(prefs.autoRestorePanel);
            } else {
                utils.log('log', `Preferred panel '${prefs.autoRestorePanel}' is already active. No switch needed by timer.`);
            }
        };

        if (activePanel && activePanel !== prefs.autoRestorePanel) {
            utils.log('log', `Active panel ('${activePanel}') is not preferred ('${prefs.autoRestorePanel}'). Setting timer.`);
            autoRestoreTimer = setTimeout(timeoutCallback, prefs.autoRestoreTimeout * 1000);
        } else if (!activePanel && document.querySelector(SELECTORS.LAYOUT.RIGHT_SIDEBAR)) {
            // If a generic right sidebar is open (e.g. search results) and no specific panel is detected as active.
            utils.log('log', `No specific panel active, but right sidebar is open. Setting timer for preferred panel '${prefs.autoRestorePanel}'.`);
            autoRestoreTimer = setTimeout(timeoutCallback, prefs.autoRestoreTimeout * 1000);
        } else if (activePanel === prefs.autoRestorePanel) {
            utils.log('log', `Preferred panel ('${prefs.autoRestorePanel}') is already active. Timer not set.`);
        } else {
             utils.log('log', `Conditions for setting auto-restore timer not met. Active panel: '${activePanel}', Preferred panel: '${prefs.autoRestorePanel}'. Right sidebar present: ${!!document.querySelector(SELECTORS.LAYOUT.RIGHT_SIDEBAR)}`);
        }
    }

    function handleAutoRestoreSettingsChange(currentPrefs) {
        if (autoRestoreTimer) {
            clearTimeout(autoRestoreTimer);
            autoRestoreTimer = null;
        }
        if (currentPrefs.autoRestoreEnabled && currentPrefs.autoRestorePanel) {
            handleSidebarPanelChange();
        } else if (!currentPrefs.autoRestoreEnabled) {
             utils.log('log', "Auto-restore disabled, timer cleared.");
        }
    }

    let activePanelObserver = null;
    function observeSidebarChanges() {
        if (activePanelObserver) activePanelObserver.disconnect();
        const mainView = document.querySelector(SELECTORS.LAYOUT.MAIN_VIEW);
        const rightSidebar = document.querySelector(SELECTORS.LAYOUT.RIGHT_SIDEBAR);
        if (!mainView || !rightSidebar) {
            setTimeout(observeSidebarChanges, CONFIG.RETRY.DELAY * 3);
            return;
        }
        const observerCallback = () => handleSidebarPanelChange();
        activePanelObserver = new MutationObserver(observerCallback);
        const mainContent = mainView.querySelector('.main-view-container > .os-content');
        if (mainContent) activePanelObserver.observe(mainContent, { childList: true, subtree: true });
        activePanelObserver.observe(rightSidebar, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden', 'aria-selected'] });
        handleSidebarPanelChange(); // Initial check
    }

    function addCustomSubMenu(dropdownMenu) {
        const prefs = utils.prefs.load();
        const existingMenu = dropdownMenu.querySelector(`#${SELECTORS.PROFILE.SUBMENU_ID}`);
        if (existingMenu) {
            const enableCheckboxSpan = existingMenu.querySelector('[data-persistent-enable-checkbox]');
            if (enableCheckboxSpan) enableCheckboxSpan.innerHTML = utils.dom.createToggleSwitch(prefs.autoRestoreEnabled);

            const panelSelect = existingMenu.querySelector('select');
            if (panelSelect) panelSelect.value = prefs.autoRestorePanel || '';

            const timeoutInput = existingMenu.querySelector('input[type="number"]');
            if (timeoutInput) timeoutInput.value = prefs.autoRestoreTimeout;

            const panelSelectItem = existingMenu.querySelector("[data-panel-select-item]");
            const timeoutItem = existingMenu.querySelector("[data-timeout-item]");
            if(panelSelectItem && timeoutItem){
                const displayStyle = prefs.autoRestoreEnabled ? 'flex' : 'none';
                panelSelectItem.style.display = displayStyle;
                timeoutItem.style.display = displayStyle;
            }
            return;
        }

        const submenuContainer = document.createElement("div");
        submenuContainer.id = SELECTORS.PROFILE.SUBMENU_ID;
        submenuContainer.style.cssText = "padding:8px 0;border-top:1px solid var(--essential-subdued,rgba(255,255,255,0.1));border-bottom:1px solid var(--essential-subdued,rgba(255,255,255,0.1));margin:8px 0;";

        // --- Header and Enable Toggle Row ---
        const headerRow = document.createElement("div");
        headerRow.className = SELECTORS.PROFILE.SUBMENU_BUTTON_CLASS; // Use button class for consistent padding/hover
        headerRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:8px 12px;cursor:default;"; // cursor:default as row isn't clickable

        const headerText = document.createElement("span");
        headerText.textContent = "Pinned Sidebar Panel";
        // headerText.style.fontWeight = "normal"; // Font weight is normal by default for span, removing explicit bold instead

        const enableCheckbox = document.createElement("span");
        enableCheckbox.className = SELECTORS.PROFILE.SUBMENU_CHECKBOX_CLASS;
        enableCheckbox.setAttribute("data-persistent-enable-checkbox", "true");
        enableCheckbox.innerHTML = utils.dom.createToggleSwitch(prefs.autoRestoreEnabled);
        // Add click listener directly to the checkbox span (the toggle switch itself)
        enableCheckbox.addEventListener("click", (event) => {
            event.stopPropagation(); // Prevent click from bubbling to headerRow if not desired
            const currentPrefs = utils.prefs.load();
            currentPrefs.autoRestoreEnabled = !currentPrefs.autoRestoreEnabled;
            utils.prefs.save(currentPrefs);
            enableCheckbox.innerHTML = utils.dom.createToggleSwitch(currentPrefs.autoRestoreEnabled);
            const display = currentPrefs.autoRestoreEnabled ? 'flex' : 'none';
            panelSelectItem.style.display = display;
            timeoutItem.style.display = display;

            if (currentPrefs.autoRestoreEnabled && currentPrefs.autoRestorePanel) {
                utils.log('log', `[PinnedPanel] Enable toggle ON. Preferred panel '${currentPrefs.autoRestorePanel}' exists. Switching immediately.`);
                // Clear any existing timer *before* attempting the switch, as an immediate switch is happening.
                if (autoRestoreTimer) {
                    clearTimeout(autoRestoreTimer);
                    autoRestoreTimer = null;
                    utils.log('log', "[PinnedPanel] Cleared timer before immediate switch from enable toggle.");
                }
                switchToPreferredPanel(currentPrefs.autoRestorePanel);

            }
            handleAutoRestoreSettingsChange(currentPrefs);
        });

        headerRow.appendChild(headerText);
        headerRow.appendChild(enableCheckbox);
        submenuContainer.appendChild(headerRow);

        // --- Conditional Settings (Panel Select & Timeout Input) ---
        const panelSelectItem = document.createElement("div");
        panelSelectItem.setAttribute("data-panel-select-item", "true");
        const timeoutItem = document.createElement("div");
        timeoutItem.setAttribute("data-timeout-item", "true");

        panelSelectItem.style.cssText = `display:${prefs.autoRestoreEnabled ? 'flex' : 'none'};align-items:center;padding:8px 12px;justify-content:space-between;`;
        const panelSelectLabel = document.createElement("span");
        panelSelectLabel.textContent = "Panel";
        panelSelectLabel.style.marginRight = "8px"; // Add spacing
        const panelSelect = document.createElement("select");
        panelSelect.style.cssText = "background-color:var(--spice-card);color:var(--spice-text);border:1px solid var(--spice-button-disabled);border-radius:4px;padding:4px 8px;";
        const panelOptions = [
            { label: "(Select a panel)", value: "" },
            SELECTORS.FRIEND_ACTIVITY.LABEL,
            SELECTORS.QUEUE.LABEL,
            SELECTORS.CONNECT.LABEL,
            SELECTORS.NPV.LABEL
        ];
        panelOptions.forEach(opt => {
            const option = document.createElement("option");
            if (typeof opt === 'string') {
                option.value = opt; option.textContent = opt;
                if (prefs.autoRestorePanel === opt) option.selected = true;
            } else {
                option.value = opt.value; option.textContent = opt.label;
                if (opt.value === "") { // Placeholder specific logic
                    option.disabled = true;
                    if (!prefs.autoRestorePanel) option.selected = true; // Select placeholder if no panel is chosen
                }
            }
            panelSelect.appendChild(option);
        });
        if (prefs.autoRestorePanel) panelSelect.value = prefs.autoRestorePanel; // Ensure correct selection if a panel is set

        panelSelect.addEventListener("change", (event) => {
            const currentPrefs = utils.prefs.load();
            const oldPanel = currentPrefs.autoRestorePanel;
            currentPrefs.autoRestorePanel = event.target.value === "" ? null : event.target.value;
            utils.log('log', `Auto-restore panel selection changed from '${oldPanel}' to '${currentPrefs.autoRestorePanel}'`);
            utils.prefs.save(currentPrefs);

            if (currentPrefs.autoRestoreEnabled && currentPrefs.autoRestorePanel) {
                utils.log('log', `Dropdown changed: Attempting immediate switch to ${currentPrefs.autoRestorePanel}`);
                // Clear any existing timer *before* attempting the switch
                if (autoRestoreTimer) {
                    clearTimeout(autoRestoreTimer);
                    autoRestoreTimer = null;
                    utils.log('log', "Cleared timer before immediate switch from dropdown.");
                }
                switchToPreferredPanel(currentPrefs.autoRestorePanel);

                // Delay re-evaluation to allow the switch to take effect
                setTimeout(() => {
                    utils.log('log', "Re-evaluating panel state after dropdown switch attempt.");
                    handleAutoRestoreSettingsChange(currentPrefs);

                    // Ensure NPV is closed if a non-NPV panel was selected and auto-restore is on
                    if (currentPrefs.autoRestoreEnabled && 
                        currentPrefs.autoRestorePanel && 
                        currentPrefs.autoRestorePanel !== SELECTORS.NPV.LABEL) {
                        
                        // Short delay to allow handleAutoRestoreSettingsChange's effects to settle if any
                        setTimeout(() => {
                            const activePanelAfterSwitchAndReval = getActivePanelLabel();
                            utils.log('log', `NPV Rule Check: Active panel is now: ${activePanelAfterSwitchAndReval}. Preferred panel: ${currentPrefs.autoRestorePanel}.`);
                            if (activePanelAfterSwitchAndReval === SELECTORS.NPV.LABEL) {
                                utils.log('log', `NPV Rule: NPV is active but not preferred. Attempting to close NPV.`);
                                const npvActivatorSelector = SELECTORS.NPV.ACTIVATOR_SELECTOR;
                                utils.dom.getElement(npvActivatorSelector, 1000).then(npvButton => {
                                    if (npvButton && typeof npvButton.click === 'function') {
                                        utils.log('log', "NPV Rule: Clicking NPV activator to close it.");
                                        npvButton.click();
                                        // Optionally, log the panel state again after a very brief moment
                                        setTimeout(() => {
                                            utils.log('log', `NPV Rule: Final panel state after attempting NPV close: ${getActivePanelLabel()}`);
                                        }, 150);
                                    } else {
                                        utils.log('warn', "NPV Rule: Could not find NPV activator to explicitly close it.");
                                    }
                                });
                            }
                        }, 100); // Small additional delay for this check
                    }
                }, 300); // Existing delay for re-evaluation after switch
            } else {
                // If auto-restore is disabled or no panel selected, just run the settings change handler (which clears timers)
                handleAutoRestoreSettingsChange(currentPrefs);
            }
        });
        panelSelectItem.appendChild(panelSelectLabel);
        panelSelectItem.appendChild(panelSelect);
        submenuContainer.appendChild(panelSelectItem);

        timeoutItem.style.cssText = `display:${prefs.autoRestoreEnabled ? 'flex' : 'none'};align-items:center;padding:8px 12px;justify-content:space-between;`;
        const timeoutLabel = document.createElement("span");
        timeoutLabel.textContent = "Restore after (s)";
        const timeoutInput = document.createElement("input");
        timeoutInput.type = "number";
        timeoutInput.min = CONFIG.DEFAULT_PREFS.autoRestoreTimeout;
        timeoutInput.value = prefs.autoRestoreTimeout;
        timeoutInput.style.cssText = "width: 60px; background-color:var(--spice-card);color:var(--spice-text);border:1px solid var(--spice-button-disabled);border-radius:4px;padding:4px 8px;text-align:right;";
        timeoutInput.addEventListener("change", (event) => {
            const currentPrefs = utils.prefs.load();
            let val = parseInt(event.target.value, 10);
            if (isNaN(val) || val < CONFIG.DEFAULT_PREFS.autoRestoreTimeout) val = CONFIG.DEFAULT_PREFS.autoRestoreTimeout; 
            currentPrefs.autoRestoreTimeout = val;
            event.target.value = val;
            utils.prefs.save(currentPrefs);
            handleAutoRestoreSettingsChange(currentPrefs);
        });
        timeoutItem.appendChild(timeoutLabel);
        timeoutItem.appendChild(timeoutInput);
        submenuContainer.appendChild(timeoutItem);

        let settingsItem = Array.from(dropdownMenu.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]'))
            .find(item => item.textContent?.trim() === 'Settings');
        let referenceNode = null;
        if (settingsItem) {
            while (settingsItem && settingsItem.parentNode !== dropdownMenu) settingsItem = settingsItem.parentNode;
            if (settingsItem && settingsItem.parentNode === dropdownMenu) referenceNode = settingsItem;
        }
        dropdownMenu.insertBefore(submenuContainer, referenceNode || null);
    }

    let menuObserver = null;
    function setupMenuObserver() {
        if (menuObserver) menuObserver.disconnect();
        menuObserver = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    const profileMenu = document.querySelector(SELECTORS.PROFILE.DROPDOWN_MENU);
                    if (profileMenu) {
                        const hasSettings = Array.from(profileMenu.querySelectorAll('[role="menuitem"]')).some(item => item.textContent?.trim() === 'Settings');
                        if (hasSettings && !profileMenu.querySelector(`#${SELECTORS.PROFILE.SUBMENU_ID}`)) {
                            addCustomSubMenu(profileMenu);
                        }
                    }
                }
            }
        });
        menuObserver.observe(document.body, { childList: true, subtree: true });

        utils.dom.getElement(SELECTORS.PROFILE.BUTTON).then(button => {
            if(button) button.addEventListener('click', () => {
                setTimeout(() => {
                    const menu = document.querySelector(SELECTORS.PROFILE.DROPDOWN_MENU);
                    if (menu && !menu.querySelector(`#${SELECTORS.PROFILE.SUBMENU_ID}`)) {
                        addCustomSubMenu(menu);
                    }
                }, 150); // Delay to ensure menu is rendered
            });
        });
    }

    async function init() {
        utils.log('log', "Initializing...");
        
        // Wait for Spicetify API to be fully loaded
        let attempts = 0;
        while (!(window.Spicetify && Spicetify.Platform && Spicetify.Platform.History) && attempts < CONFIG.RETRY.MAX_ATTEMPTS) {
            await new Promise(r => setTimeout(r, CONFIG.RETRY.DELAY));
            attempts++;
        }
        if (!(window.Spicetify && Spicetify.Platform)) {
            utils.log('error', "Spicetify not found!"); return;
        }

        // Wait for document to be ready
        if (document.readyState !== 'complete') {
            await new Promise(resolve => {
                if (document.readyState === 'complete') {
                    resolve();
                } else {
                    const listener = () => {
                        if (document.readyState === 'complete') {
                            document.removeEventListener('readystatechange', listener);
                            resolve();
                        }
                    };
                    document.addEventListener('readystatechange', listener);
                }
            });
        }

        // Additional delay to ensure Spotify's sidebar is fully initialized
        await new Promise(r => setTimeout(r, 1000));

        setupMenuObserver();
        observeSidebarChanges();

        const prefs = utils.prefs.load();
        if (prefs.autoRestoreEnabled && prefs.autoRestorePanel) {
            utils.log('log', "Checking startup panel state for auto-restore.");
            
            // Wait for sidebar elements to be present before attempting panel switch
            const sidebarReady = await waitForSidebarReady();
            if (!sidebarReady) {
                utils.log('warn', "Sidebar not ready after timeout, skipping startup panel switch.");
                return;
            }
            
            const currentActivePanelOnStartup = getActivePanelLabel();
            if (currentActivePanelOnStartup !== prefs.autoRestorePanel) {
                if (autoRestoreTimer) { clearTimeout(autoRestoreTimer); autoRestoreTimer = null; }
                utils.log('log', "Attempting to switch to preferred panel on startup.");
                
                // Retry mechanism for startup panel switch
                let switchAttempts = 0;
                const maxSwitchAttempts = 3;
                
                while (switchAttempts < maxSwitchAttempts) {
                    switchAttempts++;
                    await switchToPreferredPanel(prefs.autoRestorePanel);
                    await new Promise(r => setTimeout(r, 500)); // Wait for switch to take effect
                    
                    const resultPanel = getActivePanelLabel();
                    if (resultPanel === prefs.autoRestorePanel) {
                        utils.log('log', `Startup panel switch successful on attempt ${switchAttempts}.`);
                        break;
                    } else if (switchAttempts < maxSwitchAttempts) {
                        utils.log('log', `Startup panel switch attempt ${switchAttempts} failed, retrying...`);
                        await new Promise(r => setTimeout(r, 1000)); // Wait before retry
                    } else {
                        utils.log('warn', `Startup panel switch failed after ${maxSwitchAttempts} attempts.`);
                    }
                }
                
                setTimeout(() => handleSidebarPanelChange(), 250);
            }
        }
        
        // Startup phase complete, enable normal auto-restore behavior
        setTimeout(() => {
            isStartupPhase = false;
            utils.log('log', "Startup phase complete, auto-restore timer enabled.");
        }, 2000); // Give extra time for startup operations to settle
        
        utils.log('log', "Initialized successfully.");
    }

    // Helper function to wait for sidebar to be ready
    async function waitForSidebarReady(timeoutMs = 10000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeoutMs) {
            // Check if key sidebar elements are present
            const rightSidebar = document.querySelector('.Root__right-sidebar, [class*="right-sidebar"]');
            const hasAnyPanelActivator = document.querySelector(SELECTORS.FRIEND_ACTIVITY.ACTIVATOR_SELECTOR) ||
                                        document.querySelector(SELECTORS.QUEUE.ACTIVATOR_SELECTOR) ||
                                        document.querySelector(SELECTORS.CONNECT.ACTIVATOR_SELECTOR);
            
            if (rightSidebar && hasAnyPanelActivator) {
                return true;
            }
            
            await new Promise(r => setTimeout(r, 200));
        }
        
        return false;
    }

    init();
})(); 