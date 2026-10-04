# Shared Debug Logging and Menu Coordination Design

## Goal

Provide one shared foundation for debug-gated logging and serialized profile-menu mutations across the TypeScript extensions, while preserving silent production bundles and the existing native `Spicetify.Menu` approach.

## Scope

This design applies to the existing `core` package and its consumers, especially `private-session` and `sidebar-customizer`. It does not change extension behavior, menu labels, preference keys, or the native menu registration model.

## Design

### Debug logging

`core/src/log.ts` remains the single logging seam. `createLogger(namespace)` will emit only when debugging is enabled. Debugging is enabled when either:

- the build is a development/debug build, or
- `globalThis.__SPICETIFY_EXTENSIONS_DEBUG__ === true`, or
- `localStorage['spicetify-extensions-debug'] === 'true'`.

The shared logger will retain namespaced, timestamped output. The shared `tsup.preset.ts` will define the build-time flag and drop console/debugger calls from normal production bundles. Development/debug builds retain logging.

### Menu coordination

`core/src/menu.ts` will own a browser-global coordinator stored under a namespaced `globalThis` key. The coordinator will expose:

- `register(extensionName)` to record participating extensions;
- `installed()` to return the registered extension names;
- `enqueue(menu, owner, task)` to serialize asynchronous or synchronous mutations for one concrete menu element.

Queues are stored in a `WeakMap<Element, Promise<void>>`, so detached menus do not remain strongly referenced. Failed tasks will not poison the next task in the same queue. Tasks targeting detached menus will be skipped.

`core/src/ui.ts` will use the coordinator inside `arrangeProfileMenu()`. Existing idempotency checks remain authoritative; coordination only controls ordering and shared registration.

### Extension integration

`private-session` and `sidebar-customizer` will use `createLogger()` from `core` and register with the shared coordinator through the common menu layer. They will not each define a second global coordinator or direct console wrapper.

## Failure handling

- Logging failures must never prevent extension initialization.
- A rejected menu task must be reported through the owner logger and must not block later menu tasks.
- A menu removed before its queued task runs is ignored.
- Repeated registration and repeated arrangement calls remain safe and idempotent.

## Verification

- TypeScript typecheck passes for the workspace.
- Production builds contain no debug logger calls.
- Development/debug builds retain logger calls.
- A focused coordinator test or executable harness proves ordering, rejection recovery, detached-menu skipping, and cross-extension registration.
- `private-session` and `sidebar-customizer` continue to register their native menu items and arrange them after Spotify renders the profile menu.

## Non-goals

- No migration of remaining JavaScript extensions in this change.
- No redesign of Spotify selectors beyond the existing shared selector layer.
- No behavioral changes to sidebar preferences or private-session persistence.
