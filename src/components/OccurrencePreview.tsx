import { formatShortDateTime } from "../lib/dates";
import { hasNumberToken, renderTitle } from "../lib/numbering";
import { occurrences, withinEnd, type RepeatEnd, type RepeatRule } from "../lib/recurrence";

interface Props {
  /** First occurrence (date and time). */
  start: Date;
  allDay: boolean;
  rule: RepeatRule;
  end: RepeatEnd;
  /** Title, possibly with {n}. */
  template: string;
  numberFrom: number;
}

/** Most occurrences listed; endless series show the next few. */
const MAX = 50;
const ENDLESS = 10;

/**
 * Lists the occurrences a repeating item will create, with their titles and
 * dates, so long or numbered series can be checked before saving. Scrolls
 * when long.
 */
export function OccurrencePreview({ start, allDay, rule, end, template, numberFrom }: Props) {
  const endless = end.type === "never" && rule.freq !== "DATES";
  const limit = endless ? ENDLESS : MAX;
  const rows: { title: string; date: Date }[] = [];
  let total = 0;
  const numbered = hasNumberToken(template);
  for (const date of occurrences(start, rule)) {
    if (!withinEnd(date, total, end) || total > 1000) break;
    if (rows.length < limit) rows.push({ title: numbered ? renderTitle(template, total, numberFrom) : template, date });
    total++;
    if (endless && total >= limit) break;
  }
  if (rows.length === 0) return null;

  const heading = endless
    ? `Next ${rows.length} occurrences`
    : total > rows.length
      ? `First ${rows.length} of ${total} occurrences`
      : `${total} ${total === 1 ? "occurrence" : "occurrences"}`;

  return (
    <section class="occurrence-preview" aria-label="Occurrences that will be created">
      <p class="occurrence-preview__head">{heading}</p>
      <ol class="occurrence-preview__list" role="list" tabIndex={0} aria-label={heading}>
        {rows.map((r, i) => (
          <li key={i} class="occurrence-preview__row">
            <span class="occurrence-preview__title">{r.title || "Untitled"}</span>
            <span class="occurrence-preview__date">{formatShortDateTime(r.date, allDay)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
