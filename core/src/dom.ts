/** Resolve the first element matching `selector`, or null after `timeoutMs`. */
export function waitForElement(
  selector: string,
  timeoutMs = 10000,
  intervalMs = 100,
): Promise<Element | null> {
  return new Promise((resolve) => {
    const immediate = document.querySelector(selector);
    if (immediate) {
      resolve(immediate);
      return;
    }
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      const el = document.querySelector(selector);
      if (el) {
        resolve(el);
      } else if (Date.now() > deadline) {
        resolve(null);
      } else {
        setTimeout(check, intervalMs);
      }
    };
    setTimeout(check, intervalMs);
  });
}

/** Start a MutationObserver on `target` and return it (caller disconnects). */
export function observe(
  target: Node,
  callback: MutationCallback,
  options: MutationObserverInit = { childList: true, subtree: true },
): MutationObserver {
  const observer = new MutationObserver(callback);
  observer.observe(target, options);
  return observer;
}
