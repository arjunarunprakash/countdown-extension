import { useEffect, useRef, useState } from "preact/hooks";
import { categories } from "../state/store";
import { Icon } from "./Icon";
import { Popover } from "./Popover";

interface Props {
  onNewItem: (categoryId: string | null) => void;
  onNewCategory: () => void;
  disabled?: boolean;
}

/**
 * The small arrow beside "+": New category, and New item in a specific
 * category. "+" itself keeps adding an item straight away.
 */
export function AddMenu({ onNewItem, onNewCategory, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) close(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  const choose = (run: () => void) => {
    close(false);
    run();
  };

  // Arrow keys move between menu items.
  const onKey = (e: KeyboardEvent) => {
    const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (at + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        class="icon-button add-menu__toggle"
        aria-label="More ways to add"
        aria-haspopup="menu"
        aria-expanded={open}
        data-tooltip="New category…"
        disabled={disabled}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <Icon name="chevronDown" />
      </button>
      {open && (
        <Popover anchor={buttonRef} align="end" popoverRef={menuRef} class="popover--menu" role="menu" aria-label="Add" onKeyDown={onKey}>
          <button type="button" role="menuitem" class="menu-item" onClick={() => choose(onNewCategory)}>
            <Icon name="folder" />
            New category
          </button>
          <button type="button" role="menuitem" class="menu-item" onClick={() => choose(() => onNewItem(null))}>
            <Icon name="plus" />
            New item
          </button>
          {categories.value.length > 0 && <div class="menu-separator" role="separator" />}
          {categories.value.map((c) => (
            <button key={c.id} type="button" role="menuitem" class={`menu-item category--${c.color}`} onClick={() => choose(() => onNewItem(c.id))}>
              <span class="category__dot" aria-hidden="true" />
              New item in {c.name}
            </button>
          ))}
        </Popover>
      )}
    </>
  );
}
