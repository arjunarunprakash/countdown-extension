import type { RefObject } from "preact";
import { useId } from "preact/hooks";
import { hasNumberToken, insertToken, NUMBER_TOKEN, renderTitle } from "../lib/numbering";
import { Icon } from "./Icon";

interface Props {
  title: string;
  onTitleChange: (title: string) => void;
  /** Number for the first occurrence. */
  from: number;
  onFromChange: (from: number) => void;
  /** Whether the item repeats; numbering only applies then. */
  repeating: boolean;
  /** How many occurrences there will be, when known (for the preview). */
  count?: number;
  /** Index of the first occurrence to preview (an existing series' next one). */
  offset?: number;
  inputRef: RefObject<HTMLInputElement | null>;
}

const PREVIEW = 3;

/**
 * Lets a repeating item number its titles ("Chapter {n} Homework"). The
 * button inserts the {n} token at the caret, or replaces a selected number
 * and starts counting from it. A live preview shows the resulting titles.
 */
export function TitleNumbering({ title, onTitleChange, from, onFromChange, repeating, count, offset = 0, inputRef }: Props) {
  const fromId = useId();
  const numbered = hasNumberToken(title);
  if (!repeating && !numbered) return null;

  const insert = () => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? title.length;
    const end = input?.selectionEnd ?? title.length;
    const result = insertToken(title, start, end);
    onTitleChange(result.title);
    if (result.from !== undefined) onFromChange(result.from);
    // Put the caret back after the token once the new title has rendered.
    setTimeout(() => {
      input?.focus();
      input?.setSelectionRange(result.caret, result.caret);
    });
  };

  if (!numbered) {
    return (
      <div class="numbering">
        <button
          type="button"
          class="numbering__insert"
          onPointerDown={(e) => e.preventDefault()} // keep the title's selection
          onClick={insert}
          aria-label="Number each occurrence: insert {n} in the title"
          data-tooltip="Select a number in the title to replace it"
          data-tooltip-align="start"
        >
          <span aria-hidden="true">#</span> Number each occurrence
        </button>
      </div>
    );
  }

  const remaining = count === undefined ? undefined : Math.max(0, count - offset);
  const shown = Math.min(PREVIEW, remaining ?? PREVIEW);
  const preview = Array.from({ length: shown }, (_, i) => renderTitle(title, offset + i, from));
  const more = remaining === undefined || remaining > shown;

  return (
    <div class="numbering numbering--on">
      <div class="numbering__row">
        <label for={fromId} class="numbering__label">
          <span aria-hidden="true">#</span> Numbered from
        </label>
        <input
          id={fromId}
          class="text-input text-input--narrow"
          type="number"
          inputMode="numeric"
          min={0}
          max={99999}
          value={from}
          onInput={(e) => {
            const n = Math.round(Number(e.currentTarget.value));
            if (Number.isFinite(n) && n >= 0 && n <= 99999) onFromChange(n);
          }}
        />
        <button
          type="button"
          class="icon-button icon-button--sm"
          aria-label="Stop numbering"
          data-tooltip="Stop numbering"
          data-tooltip-align="end"
          onClick={() => onTitleChange(title.replace(/\s*\{n\}/gi, "").trim())}
        >
          <Icon name="close" />
        </button>
      </div>
      <p class="numbering__preview" aria-live="polite">
        {repeating ? (
          <>
            {preview.join(", ")}
            {more ? "…" : ""}
          </>
        ) : (
          <>Set Repeat to number each occurrence. Until then, {NUMBER_TOKEN} reads as {from}.</>
        )}
      </p>
    </div>
  );
}
