// @ts-expect-error Node's source harness runs through TypeScript stripping.
import { arrangeProfileMenu } from './ui.ts';
// @ts-expect-error Node's source harness runs through TypeScript stripping.
import { getMenuCoordinator } from './menu.ts';

type FakeNode = {
  textContent: string;
  parentElement: FakeElement | null;
  nextElementSibling: FakeNode | null;
  isConnected: boolean;
  className: string;
  children: FakeElement[];
  append(child: FakeElement): void;
  insertBefore(child: FakeElement, before: FakeNode | null): void;
  remove(): void;
  matches(selector: string): boolean;
  querySelector(selector: string): FakeElement | null;
  querySelectorAll(selector: string): FakeElement[];
  closest(selector: string): FakeElement | null;
  innerHTML: string;
};

class FakeElement implements FakeNode {
  textContent = '';
  parentElement: FakeElement | null = null;
  nextElementSibling: FakeNode | null = null;
  isConnected = true;
  className = '';
  innerHTML = '';
  children: FakeElement[] = [];

  private readonly kind: string;

  constructor(kind: string) {
    this.kind = kind;
  }

  append(child: FakeElement): void {
    this.insertBefore(child, null);
  }

  insertBefore(child: FakeElement, before: FakeNode | null): void {
    child.parentElement?.removeChild(child);
    const index = before ? this.children.indexOf(before as FakeElement) : -1;
    if (index < 0) this.children.push(child);
    else this.children.splice(index, 0, child);
    child.parentElement = this;
    child.isConnected = this.isConnected;
    this.refreshSiblings();
  }

  removeChild(child: FakeElement): void {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parentElement = null;
    child.isConnected = false;
    this.refreshSiblings();
  }

  remove(): void {
    this.parentElement?.removeChild(this);
  }

  matches(selector: string): boolean {
    return (
      (selector === 'ul.main-contextMenu-menu' && this.kind === 'menu') ||
      (selector === 'a[href*="preferences"]' && this.kind === 'settings-link') ||
      (selector === 'li.main-contextMenu-menuItem' && this.kind === 'item')
    );
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const matches: FakeElement[] = [];
    for (const child of this.children) {
      if (selector === ':scope > li.main-contextMenu-menuItem' && child.kind === 'item') {
        matches.push(child);
      } else if (selector === ':scope > li' && child.kind === 'item') {
        matches.push(child);
      } else if (selector === '.sx-group-divider' && child.className.includes('sx-group-divider')) {
        matches.push(child);
      } else if (child.matches(selector)) {
        matches.push(child);
      }
      matches.push(...child.querySelectorAll(selector));
    }
    return matches;
  }

  closest(selector: string): FakeElement | null {
    if (selector === 'li' && this.kind === 'settings-link') return this.parentElement;
    return this.matches(selector) ? this : null;
  }

  private refreshSiblings(): void {
    this.children.forEach((child, index) => {
      child.nextElementSibling = this.children[index + 1] ?? null;
    });
  }
}

class FakeMutationObserver {
  static observers: FakeMutationObserver[] = [];
  private callback: () => void;

  constructor(callback: () => void) {
    this.callback = callback;
    FakeMutationObserver.observers.push(this);
  }

  observe(): void {}
  disconnect(): void {}
  trigger(): void {
    this.callback();
  }
}

function equal<T>(actual: T, expected: T): void {
  if (actual !== expected) throw new Error(`Expected ${String(actual)} to equal ${String(expected)}`);
}

function deepEqual(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
  }
}

function createMenu(): { body: FakeElement & { dataset: Record<string, string> }; menu: FakeElement } {
  const body = Object.assign(new FakeElement('body'), { dataset: {} as Record<string, string> });
  const menu = new FakeElement('menu');
  const first = Object.assign(new FakeElement('item'), { textContent: 'First' });
  const second = Object.assign(new FakeElement('item'), { textContent: 'Second' });
  const settings = Object.assign(new FakeElement('item'), { textContent: 'Settings' });
  const link = Object.assign(new FakeElement('settings-link'), { textContent: 'Settings' });
  settings.append(link);
  menu.append(first);
  menu.append(second);
  menu.append(settings);
  body.append(menu);
  return { body, menu };
}

async function testArrangeProfileMenu(): Promise<void> {
  const { body, menu } = createMenu();
  const documentStub = {
    body,
    querySelector(selector: string): FakeElement | null {
      if (selector === 'ul.main-contextMenu-menu a[href*="preferences"]') return body.querySelector('a[href*="preferences"]');
      if (selector === 'a[href*="preferences"]') return body.querySelector('a[href*="preferences"]');
      if (selector === 'ul.main-contextMenu-menu') return menu;
      if (selector === "[role='menu']") return menu;
      return null;
    },
    querySelectorAll(selector: string): FakeElement[] {
      return selector === 'ul.main-contextMenu-menu' || selector === "[role='menu']" || selector === "ul.main-contextMenu-menu, [role='menu'], ul[role='menu']" ? [menu] : [];
    },
    createElement(kind: string): FakeElement {
      return new FakeElement(kind === 'div' ? 'divider' : kind);
    },
  };
  Object.assign(globalThis, {
    document: documentStub,
    HTMLElement: FakeElement,
    MutationObserver: FakeMutationObserver,
    Spicetify: { SVGIcons: {} },
  });

  arrangeProfileMenu({ owner: 'first', label: 'First' });
  arrangeProfileMenu({ owner: 'second', label: 'Second' });

  deepEqual(getMenuCoordinator().installed(), ['first', 'second']);
  const events: string[] = [];
  await Promise.all([
    getMenuCoordinator().enqueue(menu as unknown as Element, 'first', () => {
      events.push('first');
    }),
    getMenuCoordinator().enqueue(menu as unknown as Element, 'second', () => {
      events.push('second');
    }),
  ]);
  deepEqual(events, ['first', 'second']);
  equal(menu.querySelectorAll('.sx-group-divider').length, 1);
  equal(menu.querySelectorAll(':scope > li.main-contextMenu-menuItem').length, 3);
  equal(
    menu.querySelector('a[href*="preferences"]')?.parentElement,
    menu.children[menu.children.length - 1],
  );

  arrangeProfileMenu({ owner: 'first', label: 'First' });
  equal(menu.querySelectorAll('.sx-group-divider').length, 1);

  menu.isConnected = false;
  await getMenuCoordinator().enqueue(menu as unknown as Element, 'detached', () => {
    throw new Error('detached menu task should be skipped');
  });
}

async function testLockedProfileMenuKeepsSpotifyItemsInPlace(): Promise<void> {
  const body = Object.assign(new FakeElement('body'), { dataset: {} as Record<string, string> });
  const menu = new FakeElement('menu');
  const extensionItem = Object.assign(new FakeElement('item'), {
    textContent: 'Private session',
    innerHTML: 'extension locked path',
  });
  const nativeItem = Object.assign(new FakeElement('item'), {
    textContent: 'Private session',
    innerHTML: 'native locked path',
  });
  const standardItem = Object.assign(new FakeElement('item'), { textContent: 'Standard Spotify item' });
  const settings = Object.assign(new FakeElement('item'), { textContent: 'Settings' });
  const link = Object.assign(new FakeElement('settings-link'), { textContent: 'Settings' });
  settings.append(link);
  menu.append(extensionItem);
  menu.append(nativeItem);
  menu.append(standardItem);
  menu.append(settings);
  body.append(menu);

  const documentStub = {
    body,
    querySelector(selector: string): FakeElement | null {
      if (selector === 'ul.main-contextMenu-menu') return menu;
      return null;
    },
    querySelectorAll(selector: string): FakeElement[] {
      return selector === 'ul.main-contextMenu-menu' || selector === "[role='menu']" || selector === "ul.main-contextMenu-menu, [role='menu'], ul[role='menu']" ? [menu] : [];
    },
    createElement(kind: string): FakeElement {
      return new FakeElement(kind === 'div' ? 'divider' : kind);
    },
  };
  Object.assign(globalThis, {
    document: documentStub,
    HTMLElement: FakeElement,
    MutationObserver: FakeMutationObserver,
    Spicetify: { SVGIcons: { locked: '<path d="locked path" />' } },
  });
  extensionItem.innerHTML = '<path d="locked path" /> extension';
  nativeItem.innerHTML = '<path d="locked path" /> native';

  arrangeProfileMenu({ owner: 'private-session', label: 'Private session', locked: true });
  await new Promise((resolve) => setTimeout(resolve, 0));

  deepEqual(
    menu.children.map((child) => child === nativeItem ? 'native' : child === standardItem ? 'standard' : child === extensionItem ? 'extension' : child === settings ? 'settings' : 'divider'),
    ['native', 'standard', 'divider', 'extension', 'settings'],
  );
  equal(menu.children[2].className, 'main-contextMenu-dividerAfter sx-group-divider');
}

await testArrangeProfileMenu();
await testLockedProfileMenuKeepsSpotifyItemsInPlace();
console.log('profile menu UI harness passed');
