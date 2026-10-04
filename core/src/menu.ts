export interface MenuCoordinator {
  register(extensionName: string): string[];
  installed(): string[];
  enqueue(
    menu: Element,
    owner: string,
    task: (menu: Element) => void | Promise<void>,
  ): Promise<void>;
}

const GLOBAL_KEY = '__SPICETIFY_EXTENSIONS_MENU_COORDINATOR_V1__';
const REPORTER_KEY = '__SPICETIFY_EXTENSIONS_MENU_ERROR_REPORTER_V1__';

type MenuGlobal = typeof globalThis & {
  [GLOBAL_KEY]?: MenuCoordinator;
  [REPORTER_KEY]?: (owner: string, error: unknown) => void;
};

function createMenuCoordinator(): MenuCoordinator {
  const extensions = new Set<string>();
  const queues = new WeakMap<Element, Promise<void>>();

  return {
    register(extensionName) {
      extensions.add(extensionName);
      return [...extensions];
    },

    installed() {
      return [...extensions];
    },

    enqueue(menu, owner, task) {
      const predecessor = queues.get(menu) ?? Promise.resolve();
      const queued = predecessor
        .catch(() => undefined)
        .then(async () => {
          if (!menu.isConnected) return;
          await task(menu);
        })
        .catch((error) => {
          const reporter = (globalThis as MenuGlobal)[REPORTER_KEY];
          reporter?.(owner, error);
          throw error;
        });

      queues.set(menu, queued.catch(() => undefined));
      return queued;
    },
  };
}

export function getMenuCoordinator(): MenuCoordinator {
  const globalScope = globalThis as MenuGlobal;
  if (
    typeof __SPICETIFY_EXTENSIONS_DEBUG__ !== 'undefined' &&
    __SPICETIFY_EXTENSIONS_DEBUG__
  ) {
    globalScope[REPORTER_KEY] = (owner, error) => {
      console.error(`[${owner}] profile menu task failed`, error);
    };
  }
  return (globalScope[GLOBAL_KEY] ??= createMenuCoordinator());
}
