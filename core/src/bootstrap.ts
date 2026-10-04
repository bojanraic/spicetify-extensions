import { platform } from './platform';

export interface ReadyOptions {
  /** Platform API whose presence signals Spicetify is fully loaded. */
  api?: string;
  timeoutMs?: number;
  intervalMs?: number;
  /**
   * Also wait for Spicetify's React runtime. Required before constructing
   * Spicetify.Menu items, which use the React jsx runtime internally.
   */
  react?: boolean;
}

function reactReady(): boolean {
  return (
    typeof Spicetify !== 'undefined' && !!Spicetify.React && !!Spicetify.ReactJSX && !!Spicetify.ReactDOM
  );
}

/**
 * Resolve once Spicetify is ready: the given Platform API exists and the
 * document has finished loading (and, if `react`, the React runtime is up).
 * Rejects if it never becomes ready in time.
 */
export async function whenReady(opts: ReadyOptions = {}): Promise<void> {
  const { api = 'FeedbackAPI', timeoutMs = 15000, intervalMs = 100, react = false } = opts;
  const deadline = Date.now() + timeoutMs;

  const isReady = () =>
    !!platform()?.[api] && document.readyState === 'complete' && (!react || reactReady());

  while (!isReady()) {
    if (Date.now() > deadline) {
      throw new Error(`Spicetify not ready (Platform.${api}${react ? ' + React' : ''})`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
