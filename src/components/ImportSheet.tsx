import { useId, useRef, useState } from "preact/hooks";
import { useSheetHeight } from "../hooks/useSheetHeight";
import { commitImport, discardImport, importDraft, importFile, importStatus, importUrl, selectableImportKeys } from "../state/importer";
import { exitSelection, selected } from "../state/selection";
import { Icon } from "./Icon";

interface Props {
  state: "open" | "closing";
  /** True while a file is dragged over the panel. */
  dragging: boolean;
}

/**
 * Bottom sheet for selection mode's Import. Before a calendar is loaded it
 * offers a drop zone, a file picker and a link field; afterwards it
 * summarizes the preview (shown in the list) and commits the selection.
 */
export function ImportSheet({ state, dragging }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useSheetHeight(ref);
  const draft = importDraft.value;
  const status = importStatus.value;
  const n = selectableImportKeys.value.filter((k) => selected.value.has(k)).length;

  return (
    <div ref={ref} class="sheet sheet--import" data-state={state} role="region" aria-labelledby="sheet-title">
      <div class="sheet__grabber" aria-hidden="true" />
      <div class="sheet__head">
        <h2 id="sheet-title" class="sheet__title">
          Import
        </h2>
        {draft && (
          <span class="sheet__count" aria-live="polite">
            {n} selected
          </span>
        )}
      </div>

      {draft ? <Summary /> : <Picker dragging={dragging} />}

      {status.kind === "loading" && (
        <p class="sheet__status" role="status">
          <span class="spinner" aria-hidden="true" />
          {status.label}
        </p>
      )}
      {status.kind === "error" && (
        <p class="sheet__error" role="alert">
          {status.message}
        </p>
      )}

      <div class="sheet__footer">
        <button type="button" class="button button--subtle" onClick={exitSelection}>
          Cancel
        </button>
        {draft && (
          <button
            type="button"
            class="button button--primary"
            disabled={n === 0}
            onClick={() => {
              commitImport();
              exitSelection();
            }}
          >
            Add selected{n > 0 ? ` (${n})` : ""}
          </button>
        )}
      </div>
    </div>
  );
}

function Picker({ dragging }: { dragging: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const ids = { url: useId(), hint: useId() };
  const busy = importStatus.value.kind === "loading";

  return (
    <>
      <div class={`dropzone${dragging ? " dropzone--active" : ""}`}>
        <Icon name="import" />
        <p class="dropzone__text">
          <strong>Drop an .ics file</strong> or{" "}
          <button type="button" class="link-button dropzone__browse" disabled={busy} onClick={() => fileRef.current?.click()}>
            browse
          </button>
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".ics,.ical,.icalendar,text/calendar"
          class="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (file) void importFile(file);
          }}
        />
      </div>

      <form
        class="url-form"
        onSubmit={(e) => {
          e.preventDefault();
          void importUrl(url);
        }}
      >
        <label for={ids.url} class="field-label">
          Or paste a calendar link
        </label>
        <div class="url-form__row">
          <input
            id={ids.url}
            class="text-input"
            type="text"
            inputMode="url"
            autoComplete="off"
            spellcheck={false}
            placeholder="webcal://… or https://…/basic.ics"
            aria-describedby={ids.hint}
            value={url}
            onInput={(e) => setUrl(e.currentTarget.value)}
          />
          <button type="submit" class="button button--secondary" disabled={busy || !url.trim()}>
            Fetch
          </button>
        </div>
        <p id={ids.hint} class="field-hint">
          Google Calendar: Settings › your calendar › Secret address in iCal format. Apple Calendar: share as Public
          Calendar.
        </p>
      </form>
    </>
  );
}

function Summary() {
  const d = importDraft.value!;
  const offered = d.candidates.length - d.duplicates.size;
  const details = [
    `${offered} to import`,
    d.duplicates.size ? `${d.duplicates.size} already added` : "",
    d.pastHidden ? `${d.pastHidden} past hidden` : "",
    d.truncated ? `${d.truncated} more not shown` : "",
  ].filter(Boolean);
  return (
    <div class="import-summary">
      <Icon name="calendar" />
      <div class="import-summary__text">
        <strong class="import-summary__source">{d.source}</strong>
        <span class="import-summary__detail">{details.join(" · ")}</span>
      </div>
      <button type="button" class="link-button" onClick={discardImport}>
        Change
      </button>
    </div>
  );
}
