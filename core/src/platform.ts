// Upstream globals.d.ts types `Spicetify.Platform` as `any`. This module adds
// typing for the Platform APIs our extensions actually use, via a narrow cast.
// Extend PlatformShape as more Platform APIs are adopted.

export interface PrivateSessionAPI {
  setPrivateSession(enabled: boolean): void;
  subscribeToPrivateSession?(cb: (state: unknown) => void): { cancel(): void };
  getCapabilities?(): { isSupported: boolean };
}

export interface PlatformShape {
  Translations?: Record<string, string>;
  PrivateSessionAPI?: PrivateSessionAPI;
  // Other APIs (e.g. FeedbackAPI) are keyed by name; allow dynamic access.
  [key: string]: unknown;
}

/** Typed view over `Spicetify.Platform`. Safe before load (may be undefined). */
export function platform(): PlatformShape | undefined {
  return (typeof Spicetify !== 'undefined' ? Spicetify.Platform : undefined) as
    | PlatformShape
    | undefined;
}
