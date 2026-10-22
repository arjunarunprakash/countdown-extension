import { afterEach, describe, expect, it, vi } from "vitest";
import { chromeBackend, localStorageBackend } from "../src/lib/storage";

afterEach(() => vi.unstubAllGlobals());

/** Minimal Storage + storage-event stand-in for Node. */
function fakeLocalStorage() {
  const map = new Map<string, string>();
  const listeners: ((e: { key: string | null; newValue: string | null }) => void)[] = [];
  vi.stubGlobal("localStorage", {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  });
  vi.stubGlobal("addEventListener", (_: string, fn: (typeof listeners)[number]) => listeners.push(fn));
  vi.stubGlobal("removeEventListener", () => {});
  return { map, fire: (key: string, value: unknown) => listeners.forEach((fn) => fn({ key, newValue: JSON.stringify(value) })) };
}

describe("localStorageBackend (local preview)", () => {
  it("round-trips values under its prefix and ignores other keys", async () => {
    const ls = fakeLocalStorage();
    ls.map.set("other-app", "1");
    ls.map.set("countdown-theme-cache", "dark");
    const b = localStorageBackend();
    await b.set({ items: [{ id: "a" }], prefs: { unit: "hours" } });
    expect(await b.get()).toEqual({ items: [{ id: "a" }], prefs: { unit: "hours" } });
  });

  it("skips unreadable entries instead of failing", async () => {
    const ls = fakeLocalStorage();
    ls.map.set("countdown:items", "{not json");
    ls.map.set("countdown:prefs", '{"unit":"days"}');
    expect(await localStorageBackend().get()).toEqual({ prefs: { unit: "days" } });
  });

  it("reports changes from other tabs", () => {
    const ls = fakeLocalStorage();
    const seen: unknown[] = [];
    localStorageBackend().subscribe((c) => seen.push(c));
    ls.fire("countdown:items", [{ id: "b" }]);
    ls.fire("unrelated", 1);
    expect(seen).toEqual([{ items: [{ id: "b" }] }]);
  });
});

describe("chromeBackend", () => {
  it("reads, writes and forwards local-area changes only", async () => {
    let listener: (changes: Record<string, { newValue?: unknown }>, area: string) => void = () => {};
    const set = vi.fn(async () => {});
    vi.stubGlobal("chrome", {
      storage: {
        local: { get: vi.fn(async () => ({ items: [] })), set },
        onChanged: { addListener: (fn: typeof listener) => (listener = fn), removeListener: vi.fn() },
      },
    });
    expect(await chromeBackend.get()).toEqual({ items: [] });
    await chromeBackend.set({ items: [{ id: "a" }], series: [] });
    expect(set).toHaveBeenCalledWith({ items: [{ id: "a" }], series: [] });

    const seen: unknown[] = [];
    chromeBackend.subscribe((c) => seen.push(c));
    listener({ items: { newValue: [{ id: "b" }] }, series: { newValue: [] } }, "local");
    listener({ items: { newValue: [] } }, "sync");
    expect(seen).toEqual([{ items: [{ id: "b" }], series: [] }]);
  });
});
