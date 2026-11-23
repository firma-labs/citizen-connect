"use client";

import { useEffect, useState } from "react";

// Whether this device is used by staff: signed in, or sign-in is switched off
// (local development). Public pages (the citizen status page) use it to show
// the staff navigation only to staff. Asked once per page load.

let staffP: Promise<boolean> | null = null;

export function useIsStaff(): boolean {
  const [staff, setStaff] = useState(false);
  useEffect(() => {
    staffP ??= fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { mode: "on", signedIn: false }))
      .then((me: { mode: string; signedIn: boolean }) => me.mode === "open" || me.signedIn)
      .catch(() => false);
    let live = true;
    void staffP.then((v) => live && setStaff(v));
    return () => {
      live = false;
    };
  }, []);
  return staff;
}
