import { Icon, type IconName } from "./Icon";

interface Props {
  icon: IconName;
  label: string;
  onClick?: () => void;
  tooltipAlign?: "start" | "center" | "end";
  disabled?: boolean;
  /** For toggle buttons (e.g. Export while its sheet is open). */
  pressed?: boolean;
  id?: string;
}

export function IconButton({ icon, label, onClick, tooltipAlign = "center", disabled, pressed, id }: Props) {
  return (
    <button
      type="button"
      id={id}
      class="icon-button"
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={label}
      data-tooltip={label}
      data-tooltip-align={tooltipAlign === "center" ? undefined : tooltipAlign}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  );
}
