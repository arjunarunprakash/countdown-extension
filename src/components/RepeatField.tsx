import { useId } from "preact/hooks";
import { addMonths, fromYmd, toYmd } from "../lib/calendar";
import type { DateParts } from "../lib/parse";
import { describeRule, presetRule, type RepeatEnd, type RepeatPreset, type RepeatRule, type RulePreset } from "../lib/recurrence";
import { DatePicker } from "./DatePicker";
import { Icon } from "./Icon";
import { MultiDatePicker } from "./MultiDatePicker";

export interface RepeatValue {
  preset: RepeatPreset;
  end: RepeatEnd;
  /** The original rule when it isn't one of the presets (e.g. imported). */
  custom?: RepeatRule;
  /** Hand-picked days (YYYY-MM-DD, sorted) for the "dates" preset. */
  dates?: string[];
}

export const NO_REPEAT: RepeatValue = { preset: "none", end: { type: "never" } };

export function ruleOf(value: RepeatValue): RepeatRule | null {
  if (value.preset === "none") return null;
  if (value.preset === "custom") return value.custom ?? null;
  if (value.preset === "dates") return value.dates?.length ? { freq: "DATES", interval: 1, dates: value.dates } : null;
  return presetRule(value.preset);
}

export function sameRepeat(a: RepeatValue, b: RepeatValue): boolean {
  return (
    a.preset === b.preset &&
    JSON.stringify(a.end) === JSON.stringify(b.end) &&
    JSON.stringify(a.dates ?? []) === JSON.stringify(b.dates ?? [])
  );
}

interface Props {
  /** The item's date: option labels are phrased from it ("Weekly on Thursday"). */
  date: DateParts;
  value: RepeatValue;
  onChange: (value: RepeatValue) => void;
}

/** Repeat and Ends controls, modelled on Google Calendar's repeat menu. */
export function RepeatField({ date, value, onChange }: Props) {
  const ids = { count: useId() };
  const start = new Date(date.year, date.month, date.day);
  const label = (p: RulePreset) => describeRule(presetRule(p), start);
  const options: [RepeatPreset, string][] = [
    ["none", "Does not repeat"],
    ["daily", label("daily")],
    ["weekdays", "Every weekday (Mon–Fri)"],
    ["weekly", label("weekly")],
    ["biweekly", label("biweekly")],
    ["monthly", label("monthly")],
    ["yearly", label("yearly")],
    ["dates", "Custom dates…"],
  ];
  if (value.preset === "custom" && value.custom) options.push(["custom", describeRule(value.custom, start)]);

  const setEnd = (type: RepeatEnd["type"]) => {
    const end: RepeatEnd =
      type === "until"
        ? { type, date: toYmd(addMonths(date, 3)) }
        : type === "count"
          ? { type, count: 10 }
          : { type: "never" };
    onChange({ ...value, end });
  };

  return (
    <div class="repeat">
      <div class="select-field">
        <Icon name="repeat" />
        <select
          aria-label="Repeat"
          value={value.preset}
          onChange={(e) => {
            const preset = e.currentTarget.value as RepeatPreset;
            // Custom dates start from the item's current date.
            const dates = preset === "dates" && !value.dates?.length ? [toYmd(date)] : value.dates;
            onChange({ ...value, preset, ...(dates ? { dates } : {}) });
          }}
        >
          {options.map(([v, text]) => (
            <option key={v} value={v}>
              {text}
            </option>
          ))}
        </select>
        <Icon name="chevronDown" />
      </div>

      {value.preset === "dates" && (
        <MultiDatePicker dates={value.dates ?? []} onChange={(dates) => onChange({ ...value, dates })} />
      )}

      {value.preset !== "none" && value.preset !== "dates" && (
        <div class="repeat__end">
          <div class="repeat__end-row">
            <div class="select-field select-field--compact">
              <select aria-label="Ends" value={value.end.type} onChange={(e) => setEnd(e.currentTarget.value as RepeatEnd["type"])}>
                <option value="never">Never ends</option>
                <option value="until">Until a date</option>
                <option value="count">After a number of times</option>
              </select>
              <Icon name="chevronDown" />
            </div>
            {value.end.type === "count" && (
              <span class="repeat__count">
                <input
                  id={ids.count}
                  class="text-input text-input--narrow"
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={999}
                  aria-label="Number of occurrences"
                  value={value.end.count}
                  onInput={(e) => {
                    const n = Math.round(Number(e.currentTarget.value));
                    if (n >= 1 && n <= 999) onChange({ ...value, end: { type: "count", count: n } });
                  }}
                />
                <label for={ids.count}>times</label>
              </span>
            )}
          </div>
          {value.end.type === "until" && (
            <DatePicker
              value={fromYmd(value.end.date)}
              label="End date"
              onChange={(p) => onChange({ ...value, end: { type: "until", date: toYmd(p) } })}
            />
          )}
        </div>
      )}
    </div>
  );
}
