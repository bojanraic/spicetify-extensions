# Shared Debug Logging and Menu Coordination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Centralize debug-gated logging and serialize shared profile-menu mutations across the TypeScript extensions.

**Architecture:** Extend the existing `core` package with a runtime/build-time debug gate and a browser-global, per-menu coordinator. Keep menu-specific behavior in `core/src/ui.ts`, using the coordinator from `arrangeProfileMenu()` so `private-session` and `sidebar-customizer` share one seam without importing each other.

**Tech Stack:** TypeScript, tsup, esbuild, Spicetify browser globals, DOM `MutationObserver`, `WeakMap`, Promise queues.

**Spec:** `docs/superpowers/specs/2026-09-26-shared-debug-menu-coordination-design.md`

## Global Constraints

- Normal production bundles must drop debug logger calls.
- Development/debug builds must retain debug logger calls.
- Runtime debugging must be opt-in through `globalThis.__SPICETIFY_EXTENSIONS_DEBUG__` or `localStorage['spicetify-extensions-debug'] === 'true'`.
- Menu tasks must be idempotent, recover after rejected tasks, and skip detached menus.
- Existing extension labels, preference keys, and native `Spicetify.Menu` behavior must remain unchanged.

## Review Focus

- A production build must not retain logger calls; verify against generated `dist` output.
- A source/debug build must retain namespaced logger calls; verify against generated `dist` output.
- Two extensions registering against the same menu must execute mutations serially; test ordering.
- A rejected menu task must not block the following task; test queue recovery.
- A menu detached before execution must be skipped without throwing; test detached-menu handling.

### Task 1: Add the shared menu coordinator

**Files:**
- Create: `core/src/menu.ts`
- Modify: `core/src/index.ts`
- Test: `core/src/menu.test.ts` or an equivalent focused executable harness if the repository has no test runner

**Interfaces:**
- Produces `MenuCoordinator` with `register(extensionName: string): string[]`, `installed(): string[]`, and `enqueue(menu: Element, owner: string, task: (menu: Element) => void | Promise<void>): Promise<void>`.
- Produces `getMenuCoordinator(): MenuCoordinator`, backed by a stable namespaced `globalThis` singleton.

- [ ] **Step 1: Add focused coordinator tests/harness** covering registration, FIFO ordering, rejection recovery, detached-menu skipping, and singleton reuse.
- [ ] **Step 2: Run the focused test/harness and verify it fails** because `core/src/menu.ts` does not exist yet.
- [ ] **Step 3: Implement `core/src/menu.ts`** with a versioned global singleton, a `Set` for registration, and a `WeakMap<Element, Promise<void>>` for per-menu queues. Recover the queue after a rejected predecessor and skip tasks whose menu is no longer connected.
- [ ] **Step 4: Export the coordinator from `core/src/index.ts`.**
- [ ] **Step 5: Run the focused test/harness and workspace typecheck; verify they pass.**

### Task 2: Centralize debug-gated logging and build flags

**Files:**
- Modify: `core/src/log.ts`
- Modify: `core/src/i18n.ts`
- Modify: `tsup.preset.ts`
- Modify: `core/types/env.d.ts`
- Test: generated development and production bundles

**Interfaces:**
- `createLogger(namespace: string): Logger` remains the public logging interface.
- The build defines a boolean debug constant and esbuild drops `console`/`debugger` only for normal production builds.

- [ ] **Step 1: Add the compile-time debug constant declaration and runtime gate tests/checks** for development build, production build, global runtime flag, and localStorage runtime flag.
- [ ] **Step 2: Update `createLogger()` and `tDebug()`** to use the shared gate while preserving timestamped namespaced output.
- [ ] **Step 3: Update `tsup.preset.ts`** so `NODE_ENV=development` retains logging, `NODE_ENV=production` removes it, and an explicit debug build can retain it without changing extension source.
- [ ] **Step 4: Build one production and one development/debug artifact, then verify with `rg`** that production contains no logger strings while the debug artifact contains the logger namespace.
- [ ] **Step 5: Run workspace typecheck.**

### Task 3: Integrate coordination into shared profile-menu UI

**Files:**
- Modify: `core/src/ui.ts`
- Test: focused DOM harness for `arrangeProfileMenu()` and coordinator ordering

**Interfaces:**
- `arrangeProfileMenu(opts)` remains the extension-facing interface.
- It registers the caller and queues its arrangement work through `getMenuCoordinator()`.

- [ ] **Step 1: Add a DOM harness case** with two registered menu owners and assert that arrangement callbacks execute in queue order.
- [ ] **Step 2: Update `arrangeProfileMenu()`** to register the extension identity and enqueue its actual DOM rearrangement per concrete menu element; keep existing body dataset idempotency and divider behavior.
- [ ] **Step 3: Ensure repeated calls and detached menus remain safe.**
- [ ] **Step 4: Run the focused DOM harness and workspace typecheck.**

### Task 4: Integrate migrated extensions and remove duplicate coordination logic

**Files:**
- Modify: `private-session/src/private-session.ts`
- Modify: `sidebar-customizer/src/sidebar-customizer.ts`
- Modify: `pinned-sidebar-panel/src/pinned-sidebar-panel.ts` if required by shared arrangement usage
- Test: workspace typecheck and development builds for affected extensions

**Interfaces:**
- Extensions continue to call `arrangeProfileMenu()` and `createLogger()` from `@spicetify-ext/core`.
- No extension owns a second global coordinator or direct menu queue.

- [ ] **Step 1: Replace any local logging/coordinator implementations** with the core interfaces.
- [ ] **Step 2: Register stable extension names when arranging profile menus.**
- [ ] **Step 3: Build affected extensions in development mode and inspect output for the expected namespaces and coordinator usage.**
- [ ] **Step 4: Run workspace typecheck and lint.**

### Task 5: Verify the migration branch

**Files:**
- Modify: none unless verification exposes an issue

- [ ] **Step 1: Run `npm run typecheck`.**
- [ ] **Step 2: Run `npm run lint`.**
- [ ] **Step 3: Run `npm run build` and inspect production bundles for absent debug logging.**
- [ ] **Step 4: Run the focused coordinator/UI harness.**
- [ ] **Step 5: Review the final diff for accidental behavior changes and document any test seam limitations.**
