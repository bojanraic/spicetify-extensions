/**
 * Create or update a `<style>` tag with the given id and CSS text. CSS-based
 * hiding applies the moment matching elements appear and survives re-renders,
 * which is why it replaces imperative element.style + MutationObserver code.
 */
export function injectStyle(id: string, css: string): HTMLStyleElement {
  let style = document.getElementById(id) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = id;
    document.head.appendChild(style);
  }
  if (style.textContent !== css) style.textContent = css;
  return style;
}
