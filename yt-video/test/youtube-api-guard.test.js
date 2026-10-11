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
  // instead of actually performing YTV_MAX_API_CALLS_PER_SESSION real calls.
  yt.__resetYtvRateLimiterStateForTests({ apiCallCount: yt.YTV_MAX_API_CALLS_PER_SESSION - 1 });

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
