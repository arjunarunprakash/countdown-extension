import { signal } from "@preact/signals";

export interface ToastData {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

export const TOAST_MS = 5000;

/** One toast at a time: a new one replaces the current one (whose change then stands). */
export const toast = signal<ToastData | null>(null);

let nextId = 1;

export function showToast(data: Omit<ToastData, "id">) {
  toast.value = { ...data, id: nextId++ };
}

export function dismissToast(id?: number) {
  if (id === undefined || toast.value?.id === id) toast.value = null;
}
