// @ts-expect-error Node's source harness runs through TypeScript stripping.
import { getMenuCoordinator } from './menu.ts';

type TestMenu = Element & { isConnected: boolean };

function createMenu(): TestMenu {
  return { isConnected: true } as TestMenu;
}

function equal<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(actual)} to equal ${String(expected)}`);
  }
}

function deepEqual(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`,
    );
  }
}

async function rejects(operation: Promise<unknown>, message: RegExp): Promise<void> {
  try {
    await operation;
  } catch (error) {
    if (error instanceof Error && message.test(error.message)) {
      return;
    }
    throw error;
  }

  throw new Error('Expected operation to reject');
}

async function testCoordinator() {
  const coordinator = getMenuCoordinator();

  deepEqual(coordinator.register('private-session'), ['private-session']);
  deepEqual(coordinator.register('sidebar-customizer'), [
    'private-session',
    'sidebar-customizer',
  ]);
  deepEqual(coordinator.register('private-session'), [
    'private-session',
    'sidebar-customizer',
  ]);
  deepEqual(coordinator.installed(), [
    'private-session',
    'sidebar-customizer',
  ]);

  const menu = createMenu();
  const events: string[] = [];
  const first = coordinator.enqueue(menu, 'first', async () => {
    events.push('first:start');
    await Promise.resolve();
    events.push('first:end');
  });
  const second = coordinator.enqueue(menu, 'second', () => {
    events.push('second');
  });

  await Promise.all([first, second]);
  deepEqual(events, ['first:start', 'first:end', 'second']);

  const rejected = coordinator.enqueue(menu, 'rejected', () => {
    throw new Error('expected failure');
  });
  await rejects(rejected, /expected failure/);

  await coordinator.enqueue(menu, 'recovery', () => {
    events.push('recovered');
  });
  equal(events[events.length - 1], 'recovered');

  const detached = createMenu();
  detached.isConnected = false;
  let ran = false;
  await coordinator.enqueue(detached, 'detached', () => {
    ran = true;
  });
  equal(ran, false);

  equal(getMenuCoordinator(), coordinator);
}

await testCoordinator();
console.log('menu coordinator harness passed');
