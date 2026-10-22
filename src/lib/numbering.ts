// Numbered titles for repeating items: "Chapter {n} Homework" becomes
// "Chapter 1 Homework", "Chapter 2 Homework", … by occurrence position.

export const NUMBER_TOKEN = "{n}";
const TOKEN = /\{n\}/gi;

export const hasNumberToken = (title: string) => /\{n\}/i.test(title);

/** Title for the occurrence at `index` (0-based), numbering from `from`. */
export function renderTitle(template: string, index: number, from = 1): string {
  return template.replace(TOKEN, String(from + index));
}

/**
 * Inserts the token into a title at the selection. If the selection is a
 * whole number (e.g. the "1" in "Chapter 1"), it is replaced and returned as
 * the starting number. Returns the new title, caret position and start.
 */
export function insertToken(
  title: string,
  selStart: number,
  selEnd: number,
): { title: string; caret: number; from?: number } {
  const selectedText = title.slice(selStart, selEnd).trim();
  const from = /^\d{1,6}$/.test(selectedText) ? Number(selectedText) : undefined;
  const next = `${title.slice(0, selStart)}${NUMBER_TOKEN}${title.slice(selEnd)}`;
  return { title: next, caret: selStart + NUMBER_TOKEN.length, ...(from !== undefined ? { from } : {}) };
}
