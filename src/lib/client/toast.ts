"use client";

// One short message at a time at the bottom of the screen ("Token copied").
// Any code can call toast(); <Toaster /> in the root layout shows it.

export interface ToastMessage {
  id: number;
  text: string;
  tone: "done" | "error";
}

type Listener = (m: ToastMessage) => void;
const listeners = new Set<Listener>();
let next = 1;

export function toast(text: string, tone: ToastMessage["tone"] = "done") {
  const m = { id: next++, text, tone };
  listeners.forEach((l) => l(m));
}

export function onToast(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/**
 * Copy text to the clipboard. The Clipboard API needs a secure page (https or
 * localhost); a phone opening the dev server by its LAN address isn't one, so
 * fall back to a hidden text box and the older copy command there.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the older way
  }
  const box = document.createElement("textarea");
  box.value = text;
  box.setAttribute("readonly", "");
  box.style.position = "fixed";
  box.style.opacity = "0";
  document.body.appendChild(box);
  box.select();
  box.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  box.remove();
  return ok;
}
