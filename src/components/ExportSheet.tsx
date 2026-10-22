import type { ComponentChildren } from "preact";
import { useRef, useState } from "preact/hooks";
import { useSheetHeight } from "../hooks/useSheetHeight";
import { downloadFile } from "../lib/download";
import { GCAL_IMPORT_URL, googleCalendarUrl } from "../lib/gcal";
import { buildIcs, exportFileName, exportsAsList, type ExportEntry } from "../lib/ics";
import { exitSelection, selected, splitKeys } from "../state/selection";
import { items, removeMany } from "../state/store";
import { Icon, type IconName } from "./Icon";

interface Props {
  entries: ExportEntry[];
  /** "closing" plays the slide-down animation before unmounting. */
  state: "open" | "closing";
}

type Note = { text: string; link?: { href: string; label: string } };

/**
 * Bottom sheet for selection mode's Export: Google Calendar, .ics download,
 * remove, and a placeholder for share links (Phase 2 of the product).
 */
export function ExportSheet({ entries, state }: Props) {
  const [note, setNote] = useState<Note | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const n = entries.length;

  useSheetHeight(ref);

  const download = () => {
    const name = exportFileName(entries);
    downloadFile(name, buildIcs(entries, items.value));
    return name;
  };

  const addToGoogle = () => {
    // Google's link makes one event (or one repeat rule); custom-date and
    // numbered series need several events, so they go through a file.
    const single = entries[0];
    if (n === 1 && !(single?.kind === "series" && exportsAsList(single.series))) {
      window.open(googleCalendarUrl(entries[0]!), "_blank", "noopener");
      setNote({ text: "Opened a prefilled event in Google Calendar. Check the details there and save it." });
      return;
    }
    // Google Calendar links create one event at a time; several go through a file.
    const name = download();
    setNote({
      text: `Saved ${name}. In Google Calendar, open Settings › Import & export, choose the file, then Import.`,
      link: { href: GCAL_IMPORT_URL, label: "Open Google Calendar import" },
    });
  };

  const downloadIcs = () => {
    const name = download();
    setNote({ text: `Saved ${name}. Open it to add ${n === 1 ? "it" : "them"} to Apple Calendar or Outlook, or import it into any calendar app.` });
  };

  const remove = () => {
    const { itemIds, seriesIds } = splitKeys(selected.value);
    removeMany(itemIds, seriesIds);
    exitSelection();
  };

  return (
    <div ref={ref} class="sheet" data-state={state} role="region" aria-labelledby="sheet-title">
      <div class="sheet__grabber" aria-hidden="true" />
      <div class="sheet__head">
        <h2 id="sheet-title" class="sheet__title">
          Export
        </h2>
        <span class="sheet__count" aria-live="polite">
          {n === 0 ? "Select items" : `${n} selected`}
        </span>
      </div>

      {note && (
        <p class="sheet__note" role="status">
          {note.text}
          {note.link && (
            <a class="sheet__link" href={note.link.href} target="_blank" rel="noopener">
              {note.link.label}
              <Icon name="externalLink" />
            </a>
          )}
        </p>
      )}

      <div class="sheet__actions">
        <SheetAction
          icon="calendar"
          label="Google Calendar"
          hint={n === 1 && !(entries[0]?.kind === "series" && exportsAsList(entries[0].series)) ? "Opens a new event" : "Imports via a file"}
          disabled={n === 0}
          onClick={addToGoogle}
        />
        <SheetAction icon="import" label="Download .ics" hint="Apple, Outlook & more" disabled={n === 0} onClick={downloadIcs} />
        <SheetAction icon="link" label="Share link" hint="Coming soon" disabled soon />
        <SheetAction icon="trash" label="Remove" hint={n > 0 ? `${n} item${n === 1 ? "" : "s"}` : "Selected items"} danger disabled={n === 0} onClick={remove} />
      </div>

      <div class="sheet__footer">
        <button type="button" class="button button--subtle" onClick={exitSelection}>
          Cancel
        </button>
        <button type="button" class="button button--primary" onClick={exitSelection}>
          Done
        </button>
      </div>
    </div>
  );
}

interface ActionProps {
  icon: IconName;
  label: string;
  hint: ComponentChildren;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** Placeholder for a feature that isn't built yet. */
  soon?: boolean;
}

function SheetAction({ icon, label, hint, onClick, disabled, danger, soon }: ActionProps) {
  return (
    <button
      type="button"
      class={`sheet-action${danger ? " sheet-action--danger" : ""}${soon ? " sheet-action--soon" : ""}`}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} />
      <span class="sheet-action__text">
        <span class="sheet-action__label">
          {label}
          {soon && <span class="badge">Soon</span>}
        </span>
        <span class="sheet-action__hint">{hint}</span>
      </span>
    </button>
  );
}
