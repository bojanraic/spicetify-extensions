/** Resolve context-menu metadata without losing a usable current-track fallback. */
export async function resolveContextMenuTrackInfo<T>(
  cached: T | null,
  loadSelected: () => Promise<T | null>,
  loadCurrent: () => T | null,
): Promise<T | null> {
  if (cached) return cached;

  try {
    const selected = await loadSelected();
    if (selected) return selected;
  } catch {
    // A failed selected-track lookup should still allow the current-track fallback.
  }

  return loadCurrent();
}
