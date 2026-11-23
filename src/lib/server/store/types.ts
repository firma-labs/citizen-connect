import type { Application } from "@/lib/types";

export interface PageBlob {
  bytes: Uint8Array;
  contentType: string;
}

/**
 * Persistence boundary. Local JSON files on a developer machine; Vercel Blob on Vercel.
 * Production (PRD §9.2) swaps in RDS PostgreSQL + S3/KMS behind the same interface.
 */
export type AiReadResult = { ok: true; used: number } | { ok: false; reason: "user" | "total" };

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
  /**
   * Atomically take one AI reading for `user` on `day`, checking both the
   * per-user and the overall daily limit (0 = no overall limit).
   */
  takeAiRead(day: string, user: string, userLimit: number, totalLimit: number): Promise<AiReadResult>;
  /** AI readings used on a day: by one user, and by everyone. */
  aiReadsOn(day: string, user: string): Promise<{ user: number; total: number }>;
}
