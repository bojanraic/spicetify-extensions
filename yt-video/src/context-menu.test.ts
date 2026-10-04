// @ts-expect-error Node's source harness runs through TypeScript stripping.
import { resolveContextMenuTrackInfo } from './context-menu.ts';

type Track = { name: string; artist: string; album: string };

function equal<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
  }
}

const selected: Track = { name: 'Selected', artist: 'Artist', album: 'Album' };
const current: Track = { name: 'Current', artist: 'Artist', album: 'Album' };

equal(
  await resolveContextMenuTrackInfo(selected, async () => current, () => null),
  selected,
);
equal(
  await resolveContextMenuTrackInfo(null, async () => selected, () => current),
  selected,
);
equal(
  await resolveContextMenuTrackInfo(null, async () => null, () => current),
  current,
);
equal(
  await resolveContextMenuTrackInfo(null, async () => null, () => null),
  null,
);

console.log('context-menu fallback harness passed');
