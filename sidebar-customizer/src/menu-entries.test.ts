// @ts-expect-error Node's source harness runs through TypeScript stripping.
import { menuEntries } from './menu-entries.ts';
// @ts-expect-error Node's source harness runs through TypeScript stripping.
import { panelSelectors } from '../../core/src/selectors.ts';

function equal<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
  }
}

Object.assign(globalThis, {
  Spicetify: {
    Platform: {
      Translations: {
        'buddy-feed.listening-activity': 'Freundesaktivität',
        'web-player.now-playing-view.label': 'Wiedergabeansicht',
        'playback-control.queue': 'Warteschlange',
        'playback-control.connect-picker': 'Verbinden',
        'web-player.whats-new-feed.button-label': 'Neuigkeiten',
      },
    },
  },
});

equal(
  menuEntries().map((entry) => entry.name),
  ['Freundesaktivität', 'Neuigkeiten', 'Warteschlange', 'Verbinden', 'Wiedergabeansicht', 'Album Art Handler'],
);
equal(
  panelSelectors.queueButton(),
  'button[data-testid="control-button-queue"], button[aria-label="Warteschlange"]',
);
equal(panelSelectors.nowPlayingAside(), 'aside[aria-label="Wiedergabeansicht"]');

console.log('sidebar locale menu harness passed');
