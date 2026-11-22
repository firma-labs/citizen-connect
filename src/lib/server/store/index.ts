import "server-only";
import { localStore } from "./local";
import { supabaseStore } from "./supabase";
import type { Store } from "./types";

export type { Store, PageBlob } from "./types";

/** STORE=local|supabase. Defaults to supabase when its env vars are present. */
export function getStore(): Store {
  const choice =
    process.env.STORE ??
    (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "local");
  return choice === "supabase" ? supabaseStore : localStore;
}
