import { categories } from "../state/store";
import { Icon } from "./Icon";

interface Props {
  value: string | null;
  onChange: (categoryId: string | null) => void;
}

/** Category picker for editors (shown once categories exist). The keyboard route to what dragging does. */
export function CategoryField({ value, onChange }: Props) {
  const cats = categories.value;
  if (cats.length === 0) return null;
  const color = cats.find((c) => c.id === value)?.color;
  return (
    <div class={`select-field category-field${color ? ` category--${color}` : ""}`}>
      {color ? <span class="category__dot category-field__dot" aria-hidden="true" /> : <Icon name="folder" />}
      <select aria-label="Category" value={value ?? ""} onChange={(e) => onChange(e.currentTarget.value || null)}>
        <option value="">No category</option>
        {cats.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" />
    </div>
  );
}
