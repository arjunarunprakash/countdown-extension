import type { CompletionRecord, Item, Unit } from "./types";

export const SCHEMA_VERSION = 1;

export interface Prefs {
  unit: Unit;
  pastCollapsed: boolean;
}

export const DEFAULT_PREFS: Prefs = { unit: "days", pastCollapsed: false };

export interface StoredState {
  items: Item[];
  completions: CompletionRecord[];
  prefs: Prefs;
}

type StorageKey = keyof StoredState | "schemaVersion";

/** The slice of chrome.storage.local the app uses, so tests and plain-browser previews can swap it. */
export interface StorageBackend {
  get(): Promise<Record<string, unknown>>;
  set(values: Partial<Record<StorageKey, unknown>>): Promise<void>;
  /** Calls back with changed keys (from this or another panel). Returns an unsubscribe function. */
  subscribe(onChange: (changes: Record<string, unknown>) => void): () => void;
}

export const chromeBackend: StorageBackend = {
  get: () => chrome.storage.local.get(null),
  set: (values) => chrome.storage.local.set(values),
  subscribe(onChange) {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local") return;
      onChange(Object.fromEntries(Object.entries(changes).map(([k, c]) => [k, c.newValue])));
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  },
};

/** Fallback for opening the panel page outside the extension (local preview). */
export function localStorageBackend(prefix = "countdown:"): StorageBackend {
  return {
    async get() {
      const out: Record<string, unknown> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        if (key.startsWith(prefix)) out[key.slice(prefix.length)] = JSON.parse(localStorage.getItem(key)!);
      }
      return out;
    },
    async set(values) {
      for (const [k, v] of Object.entries(values)) localStorage.setItem(prefix + k, JSON.stringify(v));
    },
    subscribe(onChange) {
      const listener = (e: StorageEvent) => {
        if (e.key?.startsWith(prefix)) onChange({ [e.key.slice(prefix.length)]: e.newValue && JSON.parse(e.newValue) });
      };
      addEventListener("storage", listener);
      return () => removeEventListener("storage", listener);
    },
  };
}

export function defaultBackend(): StorageBackend {
  return typeof chrome !== "undefined" && chrome.storage?.local ? chromeBackend : localStorageBackend();
}

// ── Validation ──────────────────────────────────────────────────
// Stored data is treated as untrusted: a bad record is dropped rather
// than crashing the panel.

const isString = (v: unknown): v is string => typeof v === "string";
const isOptionalString = (v: unknown) => v === undefined || isString(v);
const isDateString = (v: unknown) => isString(v) && !Number.isNaN(Date.parse(v));

export function isItem(v: unknown): v is Item {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    isString(o.id) &&
    isString(o.title) &&
    (o.type === "due" || o.type === "starts") &&
    isDateString(o.dateTime) &&
    (o.source === "manual" || o.source === "import") &&
    isString(o.createdAt) &&
    isString(o.updatedAt) &&
    (o.allDay === undefined || typeof o.allDay === "boolean") &&
    isOptionalString(o.notes) &&
    isOptionalString(o.uid) &&
    isOptionalString(o.seriesId) &&
    (o.completedAt === undefined || isDateString(o.completedAt))
  );
}

function isCompletion(v: unknown): v is CompletionRecord {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    isString(o.id) &&
    isString(o.itemId) &&
    isString(o.title) &&
    (o.type === "due" || o.type === "starts") &&
    isDateString(o.dateTime) &&
    isDateString(o.completedAt)
  );
}

const UNITS_SET = new Set<unknown>(["days", "hours", "minutes", "seconds"]);

export function parsePrefs(v: unknown): Prefs {
  const o = (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
  return {
    unit: UNITS_SET.has(o.unit) ? (o.unit as Unit) : DEFAULT_PREFS.unit,
    pastCollapsed: typeof o.pastCollapsed === "boolean" ? o.pastCollapsed : DEFAULT_PREFS.pastCollapsed,
  };
}

export const parseItems = (v: unknown): Item[] => (Array.isArray(v) ? v.filter(isItem) : []);
export const parseCompletions = (v: unknown): CompletionRecord[] => (Array.isArray(v) ? v.filter(isCompletion) : []);

export async function loadState(backend: StorageBackend): Promise<StoredState> {
  const raw = await backend.get();
  const state: StoredState = {
    items: parseItems(raw.items),
    completions: parseCompletions(raw.completions),
    prefs: parsePrefs(raw.prefs),
  };
  // Future schema changes migrate here, keyed on raw.schemaVersion.
  if (raw.schemaVersion !== SCHEMA_VERSION) await backend.set({ schemaVersion: SCHEMA_VERSION });
  return state;
}
