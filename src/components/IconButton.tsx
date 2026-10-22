import { Icon, type IconName } from "./Icon";

interface Props {
  icon: IconName;
  label: string;
  onClick?: () => void;
  tooltipAlign?: "start" | "center" | "end";
}

export function IconButton({ icon, label, onClick, tooltipAlign = "center" }: Props) {
  return (
    <button
      type="button"
      class="icon-button"
      aria-label={label}
      data-tooltip={label}
      data-tooltip-align={tooltipAlign === "center" ? undefined : tooltipAlign}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  );
}
