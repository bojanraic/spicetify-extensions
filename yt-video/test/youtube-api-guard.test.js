"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

// Minimal in-memory localStorage polyfill so cacheUtils works outside a
// browser. Installed before requiring the extension so top-level code that
// touches localStorage (there is none at load time, but cacheUtils methods
// are called from tests) has something to talk to.
function installLocalStoragePolyfill() {
  const store = new Map();
  global.localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
  };
}

installLocalStoragePolyfill();

// `window` must stay undefined here (Node has no `window` by default) so the
// extension's bootstrap guard skips starting its Spicetify-readiness poll
// loop, which would otherwise keep the test process alive forever.
const yt = require("../src/yt-video.js");

function jsonResponse(body) {
  return { json: async () => body };
}

test.beforeEach(() => {
  global.localStorage.clear();
  yt.__resetYtvRateLimiterStateForTests();
});

test("dedupes concurrent identical in-flight searches into a single API call", async () => {
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls++;
    return jsonResponse({ items: [{ id: { videoId: "abc" } }] });
  };

  const [first, second] = await Promise.all([
    yt.fetchYoutubeSearchResults("Artist - Song music video", { fetchImpl }),
    yt.fetchYoutubeSearchResults("Artist - Song music video", { fetchImpl }),
  ]);

  assert.equal(fetchCalls, 1);
  assert.deepEqual(first.data, second.data);
});

test("serializes slot reservations and enforces the minimum interval between them", async () => {
  const times = [];
  async function reserveAndRecord() {
    await yt.ytvReserveApiCallSlot();
    times.push(Date.now());
  }

  await Promise.all([reserveAndRecord(), reserveAndRecord(), reserveAndRecord()]);

  assert.equal(times.length, 3);
  const sorted = [...times].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    assert.ok(
      gap >= yt.YTV_MIN_API_CALL_INTERVAL_MS - 20,
      `expected gap >= ~${yt.YTV_MIN_API_CALL_INTERVAL_MS}ms, got ${gap}ms`
    );
  }
});

test("cached searches do not trigger an API call", async () => {
  const cacheKey = yt.cacheUtils.getSearchKey("Artist - Song music video");
  yt.cacheUtils.set(cacheKey, { items: [{ id: { videoId: "cached" } }] });

  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls++;
    return jsonResponse({ items: [] });
  };

  const result = await yt.fetchYoutubeSearchResults("Artist - Song music video", { fetchImpl });

  assert.equal(fetchCalls, 0);
  assert.equal(result.fromCache, true);
  assert.equal(result.data.items[0].id.videoId, "cached");
});

test("the per-instance request budget blocks further searches once exhausted", async () => {
  // Seed state so the very next call is the one that pushes past the budget,
  // instead of actually performing YTV_MAX_API_CALLS_PER_WINDOW real calls.
  yt.__resetYtvRateLimiterStateForTests({ apiCallCount: yt.YTV_MAX_API_CALLS_PER_WINDOW - 1 });

  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls++;
    return jsonResponse({ items: [{ id: { videoId: "last-budgeted-call" } }] });
  };

  // This call consumes the final budget slot and should succeed.
  await yt.fetchYoutubeSearchResults("final budgeted query", { fetchImpl });
  assert.equal(fetchCalls, 1);
  assert.equal(yt.ytvHasApiBudget(), false);

  // The next, different query should be rejected without calling fetch.
  await assert.rejects(
    yt.fetchYoutubeSearchResults("one query too many", { fetchImpl }),
    { name: "YtvBudgetExhaustedError" }
  );
  assert.equal(fetchCalls, 1);
});

test("a quota-exceeded response starts a cooldown instead of retrying", async () => {
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls++;
    return jsonResponse({
      error: { code: 403, errors: [{ reason: "quotaExceeded" }] },
    });
  };

  await assert.rejects(
    yt.fetchYoutubeSearchResults("first query", { fetchImpl }),
    { name: "YtvQuotaCoolingDownError" }
  );
  assert.equal(fetchCalls, 1);
  assert.equal(yt.ytvIsQuotaCoolingDown(), true);

  // A different query, issued while still cooling down, must not retry.
  await assert.rejects(
    yt.fetchYoutubeSearchResults("second query", { fetchImpl }),
    { name: "YtvQuotaCoolingDownError" }
  );
  assert.equal(fetchCalls, 1);
});

test("a failed request does not leave a permanently pending in-flight entry", async () => {
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls++;
    if (fetchCalls === 1) {
      throw new Error("network error");
    }
    return jsonResponse({ items: [{ id: { videoId: "retry-ok" } }] });
  };

  await assert.rejects(yt.fetchYoutubeSearchResults("flaky query", { fetchImpl }));
  assert.equal(fetchCalls, 1);

  // Same query again: should hit the network again, not reuse a stuck entry.
  const result = await yt.fetchYoutubeSearchResults("flaky query", { fetchImpl });
  assert.equal(fetchCalls, 2);
  assert.equal(result.data.items[0].id.videoId, "retry-ok");
});

test("non-quota 403 does not trigger the quota cooldown", async () => {
  const fetchImpl = async () => jsonResponse({
    error: { code: 403, message: "API key referrer blocked", errors: [{ reason: "forbidden" }] },
  });
  await assert.rejects(yt.fetchYoutubeSearchResults("blocked referrer", { fetchImpl }),
    /API key referrer blocked/);
  assert.equal(yt.ytvIsQuotaCoolingDown(), false);
});

test("superseded queued calls neither spend budget nor delay the latest search", async () => {
  yt.__resetYtvRateLimiterStateForTests({ lastApiCallAt: Date.now() });
  const calls = [];
  const fetchImpl = async (url, { signal }) => {
    calls.push(new URL(url).searchParams.get("q"));
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    return jsonResponse({ items: [] });
  };
  const promises = ["a", "b", "c", "d", "e"].map((q) =>
    yt.fetchYoutubeSearchResults(q, { fetchImpl }).catch((error) => error));
  const results = await Promise.all(promises);
  assert.deepEqual(calls, ["e"]);
  assert.equal(results.slice(0, 4).every((e) => e.name === "AbortError"), true);
  assert.equal(yt.ytvHasApiBudget(), true);
  const budgetCalls = [];
  yt.__resetYtvRateLimiterStateForTests({ apiCallCount: yt.YTV_MAX_API_CALLS_PER_WINDOW - 2 });
  const pending = ["x", "y", "z"].map((q) => yt.fetchYoutubeSearchResults(q, {
    fetchImpl: async (url) => {
      budgetCalls.push(new URL(url).searchParams.get("q"));
      return jsonResponse({ items: [] });
    },
  }).catch((error) => error));
  await Promise.all(pending);
  assert.deepEqual(budgetCalls, ["z"]);
  assert.equal(yt.ytvHasApiBudget(), true);
});

test("late cleanup of A cannot remove a newer A in-flight entry", async () => {
  let resolveFirstA;
  let fetchCalls = 0;
  const fetchImpl = (url, { signal }) => {
    const query = new URL(url).searchParams.get("q");
    fetchCalls++;
    if (query === "A" && fetchCalls === 1) {
      return new Promise((resolve) => { resolveFirstA = resolve; });
    }
    return Promise.resolve(jsonResponse({ items: [{ id: { videoId: query } }] }));
  };
  const firstA = yt.fetchYoutubeSearchResults("A", { fetchImpl });
  while (!resolveFirstA) await new Promise((resolve) => setTimeout(resolve, 1));
  const b = yt.fetchYoutubeSearchResults("B", { fetchImpl });
  const newerA = yt.fetchYoutubeSearchResults("A", { fetchImpl });
  resolveFirstA(jsonResponse({ items: [] }));
  await Promise.allSettled([firstA, b]);
  const sameA = yt.fetchYoutubeSearchResults("A", { fetchImpl });
  await Promise.all([newerA, sameA]);
  assert.equal(fetchCalls, 2);
});

test("cache hits cancel older pending searches", async () => {
  yt.__resetYtvRateLimiterStateForTests({ lastApiCallAt: Date.now() });
  yt.cacheUtils.set(yt.cacheUtils.getSearchKey("cached"), { items: [{ id: { videoId: "hit" } }] });
  let fetchCalls = 0;
  const pending = yt.fetchYoutubeSearchResults("obsolete", {
    fetchImpl: async () => { fetchCalls++; return jsonResponse({ items: [] }); },
  }).catch((error) => error);
  const cached = await yt.fetchYoutubeSearchResults("cached");
  const cancelled = await pending;
  assert.equal(cached.fromCache, true);
  assert.equal(cancelled.name, "AbortError");
  assert.equal(fetchCalls, 0);
});

test("the call budget is a rolling window that frees up as old calls age out", async () => {
  const now = Date.now();
  // Full budget; the oldest call is 1s short of leaving the window.
  const stamps = Array.from({ length: yt.YTV_MAX_API_CALLS_PER_WINDOW }, (_, i) =>
    now - yt.YTV_API_BUDGET_WINDOW_MS + 1000 + i);
  yt.__resetYtvRateLimiterStateForTests({ apiCallTimestamps: stamps });
  assert.equal(yt.ytvHasApiBudget(), false);
  await assert.rejects(yt.fetchYoutubeSearchResults("windowed", { fetchImpl: async () => jsonResponse({ items: [] }) }),
    (e) => e.name === "YtvBudgetExhaustedError" && e.retryAfterMs > 0 && e.retryAfterMs <= 1000);

  // Age the oldest call out of the window: exactly one slot frees up.
  stamps[0] = now - yt.YTV_API_BUDGET_WINDOW_MS - 1;
  yt.__resetYtvRateLimiterStateForTests({ apiCallTimestamps: stamps });
  assert.equal(yt.ytvHasApiBudget(), true);
  await yt.fetchYoutubeSearchResults("windowed", { fetchImpl: async () => jsonResponse({ items: [] }) });
  assert.equal(yt.ytvHasApiBudget(), false);
});
