import { Icon } from "./Icon";

interface Props {
  /** "first": nothing at all yet. "clear": nothing upcoming, but past/completed items exist. */
  variant: "first" | "clear";
  onNew: () => void;
  onImport: () => void;
}

const COPY = {
  first: {
    title: "Nothing on the clock",
    text: "Add a deadline or event to start a countdown, or bring them in from your calendar.",
  },
  clear: {
    title: "All caught up",
    text: "Nothing upcoming. Add something new or import from your calendar.",
  },
};

export function EmptyState({ variant, onNew, onImport }: Props) {
  const { title, text } = COPY[variant];
  return (
    <section class={`empty empty--${variant}`} aria-labelledby="empty-title">
      {variant === "first" && (
        <svg class="empty__art" viewBox="0 0 64 64" aria-hidden="true">
          <defs>
            <linearGradient id="empty-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" class="empty__stop-a" />
              <stop offset="1" class="empty__stop-b" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="22" class="empty__track" />
          <path d="M32 10a22 22 0 1 1-22 22" class="empty__arc" stroke="url(#empty-ring)" pathLength={1} />
          <circle cx="32" cy="32" r="3.5" class="empty__dot" />
        </svg>
      )}
      <h2 id="empty-title" class="empty__title">
        {title}
      </h2>
      <p class="empty__text">{text}</p>
      <div class="empty__actions">
        <button type="button" class="button button--primary" onClick={onNew}>
          <Icon name="plus" />
          New item
        </button>
        <button type="button" class="button button--secondary" onClick={onImport}>
          <Icon name="import" />
          Import calendar
        </button>
      </div>
    </section>
  );
}
