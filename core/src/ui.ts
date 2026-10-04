import { PROFILE_MENU_SELECTOR } from './selectors';
import { getMenuCoordinator } from './menu';

// Spicetify.Menu can only create item rows, not Spotify's native divider
// element. We register a marker item, then swap it for a real
// `main-contextMenu-dividerAfter` div once the menu renders (see
// enhanceMenuDividers). This yields the exact native divider look.
const DIVIDER_MARKER = 'sx-menu-divider';

/**
 * A divider placeholder for native Spicetify profile menus. Must be paired
 * with a one-time enhanceMenuDividers() call to render as a real divider.
 * Construct only after the React runtime is ready (whenReady({ react: true })).
 */
export function menuDivider(): Spicetify.Menu.Item {
  return new Spicetify.Menu.Item(DIVIDER_MARKER, false, () => {});
}

/**
 * Replace menuDivider() marker rows with Spotify's native divider element,
 * re-applying whenever a (sub)menu renders. Idempotent across extensions
 * (guarded on document.body), so every extension may safely call it.
 */
export function enhanceMenuDividers(): void {
  if (document.body.dataset.sxMenuDividers === '1') return;
  document.body.dataset.sxMenuDividers = '1';

  const convert = () => {
    document.querySelectorAll<HTMLElement>('li.main-contextMenu-menuItem').forEach((li) => {
      if (li.textContent?.trim() !== DIVIDER_MARKER) return;
      const parent = li.parentElement;
      if (!parent) return;
      // Native dividers are direct children of the menu <ul>, so replace the
      // whole marker <li> rather than nesting the divider inside it.
      const divider = document.createElement('div');
      divider.className = 'main-contextMenu-dividerAfter';
      parent.insertBefore(divider, li);
      li.remove();
    });
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (
          node instanceof HTMLElement &&
          (node.matches?.('li.main-contextMenu-menuItem') ||
            node.querySelector?.('li.main-contextMenu-menuItem'))
        ) {
          convert();
          return;
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  convert();
}

/**
 * Move this extension's profile-menu item(s) to just above the Settings entry,
 * with a single native divider above the moved group. Spicetify.Menu always
 * prepends and offers no position control, so this repositions after render.
 *
 * Items are matched by exact label text, or — for the icon-only private-session
 * toggle whose label collides with Spotify's built-in — by the `locked` icon.
 * Idempotent and shared across extensions via a registry on document.body.
 */
export function arrangeProfileMenu(
  opts: { owner?: string; label?: string; locked?: boolean } = {},
): void {
  const owner = opts.owner ?? 'unknown';
  const coordinator = getMenuCoordinator();
  coordinator.register(owner);
  const registered: string[] = JSON.parse(document.body.dataset.sxMoveLabels || '[]');
  if (opts.label && !registered.includes(opts.label)) {
    registered.push(opts.label);
    document.body.dataset.sxMoveLabels = JSON.stringify(registered);
  }
  if (opts.locked) {
    document.body.dataset.sxMoveLocked = '1';
    if (opts.label) document.body.dataset.sxMoveLockedLabel = opts.label;
  }

  if (document.body.dataset.sxArrangeObserver === '1') return;
  document.body.dataset.sxArrangeObserver = '1';

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        // Only react when the MAIN profile menu opens. Submenu flyouts also use
        // role="menu" and appear on hover, so they must not trigger arrange().
        if (
          node instanceof HTMLElement &&
          (node.matches?.('a[href*="preferences"]') ||
            node.querySelector?.('a[href*="preferences"]'))
        ) {
          arrange();
          return;
        }
      }
    }
  });

  function arrange() {
    const settingsLi = findSettingsItem();
    const menu = settingsLi?.parentElement;
    if (!menu || !settingsLi) return;

    const wantLabels: string[] = JSON.parse(document.body.dataset.sxMoveLabels || '[]');
    const singleMatchLabel = document.body.dataset.sxMoveLockedLabel;
    const lockRaw =
      document.body.dataset.sxMoveLocked === '1' ? (Spicetify.SVGIcons?.locked ?? '') : '';
    // Match by the icon's path data so wrapper differences don't defeat it.
    const lockNeedle = lockRaw ? (/d="([^"]+)"/.exec(lockRaw)?.[1] ?? lockRaw) : '';

    const ours: HTMLElement[] = [];
    const matchedLabels = new Set<string>();
    let lockedItemFound = false;
    menu.querySelectorAll<HTMLElement>(':scope > li').forEach((li) => {
      const text = li.textContent?.trim() ?? '';
      const byLabel =
        wantLabels.includes(text) &&
        (text !== singleMatchLabel || !matchedLabels.has(text));
      const byLock =
        !!lockNeedle && !lockedItemFound && li.innerHTML.includes(lockNeedle);
      if (byLabel) matchedLabels.add(text);
      if (byLock) lockedItemFound = true;
      if (byLabel || byLock) ours.push(li);
    });
    if (!ours.length) return;

    // Idempotency: bail if already positioned, so our own mutations below
    // don't re-trigger the observer into an infinite loop.
    const existingDivider = menu.querySelector('.sx-group-divider');
    const alreadyArranged =
      !!existingDivider &&
      existingDivider.nextElementSibling === ours[0] &&
      ours[ours.length - 1].nextElementSibling === settingsLi;
    if (alreadyArranged) return;

    void coordinator
      .enqueue(menu, owner, () => {
        if (!menu.isConnected) return;

        const currentSettingsLi = findSettingsItem(menu);
        if (!currentSettingsLi) return;
        const currentOurs: HTMLElement[] = [];
        const currentSingleMatchLabel = document.body.dataset.sxMoveLockedLabel;
        const currentMatchedLabels = new Set<string>();
        let currentLockedItemFound = false;
        menu.querySelectorAll<HTMLElement>(':scope > li').forEach((li) => {
          const text = li.textContent?.trim() ?? '';
          const byLabel =
            wantLabels.includes(text) &&
            (text !== currentSingleMatchLabel || !currentMatchedLabels.has(text));
          const byLock =
            !!lockNeedle &&
            !currentLockedItemFound &&
            li.innerHTML.includes(lockNeedle);
          if (byLabel) currentMatchedLabels.add(text);
          if (byLock) currentLockedItemFound = true;
          if (byLabel || byLock) currentOurs.push(li);
        });
        if (!currentOurs.length) return;

        const currentDivider = menu.querySelector('.sx-group-divider');
        const currentAlreadyArranged =
          !!currentDivider &&
          currentDivider.nextElementSibling === currentOurs[0] &&
          currentOurs[currentOurs.length - 1].nextElementSibling === currentSettingsLi;
        if (currentAlreadyArranged) return;

        // Mutate with the observer detached to avoid self-triggering.
        observer.disconnect();
        currentOurs.forEach((li) => menu.insertBefore(li, currentSettingsLi));
        const divider =
          currentDivider ??
          Object.assign(document.createElement('div'), {
            className: 'main-contextMenu-dividerAfter sx-group-divider',
          });
        menu.insertBefore(divider, currentOurs[0]);
        observer.observe(document.body, { childList: true, subtree: true });
      })
      .catch(() => {
        observer.observe(document.body, { childList: true, subtree: true });
      });
  }

  observer.observe(document.body, { childList: true, subtree: true });
  arrange();
}

function findSettingsItem(root?: Element): HTMLElement | null {
  const preferenceLink = (root ?? document).querySelector('a[href*="preferences"]');
  const preferenceItem = preferenceLink?.closest('li');
  if (preferenceItem) return preferenceItem as HTMLElement;

  const menus = root
    ? [root]
    : Array.from(document.querySelectorAll<HTMLElement>(PROFILE_MENU_SELECTOR));
  return (
    menus
      .flatMap((menu) =>
        Array.from(menu.querySelectorAll<HTMLElement>(':scope > li')),
      )
      .find((li) => li.textContent?.trim() === 'Settings') ?? null
  );
}

/** Inline HTML for a Spotify-green toggle switch (on/off). */
export function toggleSwitch(enabled: boolean): string {
  const track = enabled ? '#1DB954' : '#535353';
  const knobLeft = enabled ? '22px' : '2px';
  return `
    <div class="toggle-switch" style="position:relative;width:40px;height:20px;background-color:${track};border-radius:10px;transition:background-color .3s;">
      <div class="toggle-slider" style="position:absolute;top:2px;left:${knobLeft};width:16px;height:16px;background-color:#fff;border-radius:50%;transition:left .3s;"></div>
    </div>`;
}

function findMenuInNode(node: Element): Element | null {
  for (const raw of PROFILE_MENU_SELECTOR.split(',')) {
    const selector = raw.trim();
    if (node.matches?.(selector)) return node;
    const found = node.querySelector?.(selector);
    if (found) return found;
  }
  return null;
}

/** The profile menu is the one containing the Private Session checkbox item. */
export function isProfileMenu(menu: Element): boolean {
  return !!menu.querySelector("[role='menuitemcheckbox']");
}

/**
 * Fire `onOpen(menu)` whenever the account/profile context menu appears.
 * `onOpen` should be idempotent (guard against re-injecting on re-open).
 * Returns the observer so callers can disconnect if needed.
 */
export function observeProfileMenu(onOpen: (menu: Element) => void): MutationObserver {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        const menu = findMenuInNode(node);
        if (menu && isProfileMenu(menu)) onOpen(menu);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}
