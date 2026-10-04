type Level = 'log' | 'warn' | 'error';

const DEBUG_STORAGE_KEY = 'spicetify-extensions-debug';

function runtimeDebugEnabled(): boolean {
  try {
    const global = globalThis as typeof globalThis & {
      __SPICETIFY_EXTENSIONS_DEBUG__?: boolean;
    };
    return (
      global.__SPICETIFY_EXTENSIONS_DEBUG__ === true ||
      global.localStorage?.getItem(DEBUG_STORAGE_KEY) === 'true'
    );
  } catch {
    return false;
  }
}

/** Whether the current build or browser runtime has opted into debug output. */
export function debugEnabled(): boolean {
  return (
    (typeof __SPICETIFY_EXTENSIONS_DEBUG__ !== 'undefined' &&
      __SPICETIFY_EXTENSIONS_DEBUG__) ||
    runtimeDebugEnabled()
  );
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(
    d.getMilliseconds(),
    3,
  )}`;
}

export interface Logger {
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

/** Timestamped, namespaced console logger. Stripped from production bundles. */
export function createLogger(namespace: string): Logger {
  const emit = (level: Level, args: unknown[]) => {
    if (!debugEnabled()) return;
    try {
      console[level](`[${timestamp()}] [${namespace}]`, ...args);
    } catch {
      // Logging must never prevent an extension from initializing.
    }
  };
  return {
    log: (...args) => emit('log', args),
    warn: (...args) => emit('warn', args),
    error: (...args) => emit('error', args),
  };
}
