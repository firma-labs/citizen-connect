import type { Application } from "@/lib/types";

export interface PageBlob {
  bytes: Uint8Array;
  contentType: string;
}

/**
 * Persistence boundary. Pilot: local files (dev) or Supabase (Vercel).
 * Production (PRD §9.2) swaps in RDS PostgreSQL + S3/KMS behind the same interface.
 */
export interface Store {
  readonly name: string;
  get(token: string): Promise<Application | null>;
  /** Insert if absent; returns the stored record either way (idempotent for sync retries). */
  createIfAbsent(app: Application): Promise<Application>;
  /** Read-modify-write. `fn` may return null to abort without writing. */
  update(token: string, fn: (app: Application) => Application | null): Promise<Application | null>;
  list(limit?: number): Promise<Application[]>;
  putPage(token: string, idx: number, page: PageBlob): Promise<void>;
  getPage(token: string, idx: number): Promise<PageBlob | null>;
}
