import "server-only";
import { blobStore } from "./blob";
import { localStore } from "./local";
import type { Store } from "./types";

export type { Store, PageBlob } from "./types";
export { StoreBusyError } from "./types";

/**
 * Where data lives:
 *   - On Vercel (Preview, Production): Vercel Blob — the project's connected Blob store.
 *   - Anywhere else (your Mac, `--prod` included): JSON files in .data/, as before.
 * Decided by where the app runs, not by which keys are present, so Blob keys in a
 * local env file never move local data. STORE=local|blob overrides.
 */
export function getStore(): Store {
  const choice = process.env.STORE ?? (process.env.VERCEL ? "blob" : "local");
  if (choice !== "blob") return localStore;
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
    throw new Error(
      "No Vercel Blob store is connected to this deployment. In the Vercel project: Storage → Create → Blob (private, Mumbai bom1), connect it to this environment, then redeploy.",
    );
  }
  return blobStore;
}
