import { platform } from './platform';
import { createLogger, debugEnabled } from './log';

const log = createLogger('i18n');

function lookup(key: string): string | undefined {
  return platform()?.Translations?.[key];
}

/** Locale-aware string from Spotify's Translations, falling back to English. */
export function t(key: string, fallback: string): string {
  return lookup(key) ?? fallback;
}

/**
 * Like `t`, but in dev builds logs whether the value came from Translations or
 * the fallback. The log is stripped from production bundles (drop console).
 */
export function tDebug(key: string, fallback: string): string {
  const value = lookup(key);
  if (__SPICETIFY_EXTENSIONS_DEBUG__ && debugEnabled()) {
    log.log(
      `t("${key}") -> ${value !== undefined ? `"${value}" (translations)` : `"${fallback}" (fallback)`}`,
    );
  }
  return value ?? fallback;
}
