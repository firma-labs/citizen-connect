"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AppBar, BottomNav, Screen } from "@/components/ui/AppBar";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { useIsStaff } from "@/lib/client/session";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { dept, refLabel } from "@/lib/reference";

// Public, citizen-facing status check (PRD §4.1 #8). Language menu top-right.

export default function TrackPage() {
  // Citizens see a plain public page; staff (signed in) keep their tab bar to get back.
  const staff = useIsStaff();
  return (
    <>
      <AppBar publicPage />
      <Screen>
        <Suspense>
          <Track />
        </Suspense>
      </Screen>
      {staff && <BottomNav />}
    </>
  );
}

interface Result {
  token: string;
  stage: "received" | "routed" | "acknowledged" | "in_progress" | "closed";
  received_at: string;
  department: { code: string } | null;
  sla_due_at: string | null;
  closing_remark: string | null;
}

const STAGES: { key: Result["stage"]; label: MessageKey }[] = [
  { key: "received", label: "track.stage.received" },
  { key: "routed", label: "track.stage.routed" },
  { key: "acknowledged", label: "track.stage.acknowledged" },
  { key: "in_progress", label: "track.stage.in_progress" },
  { key: "closed", label: "track.stage.closed" },
];

function Track() {
  const { t, date, num, locale } = useI18n();
  const params = useSearchParams();
  const [token, setToken] = useState(params.get("t") ?? "");
  const [mobile, setMobile] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<"notfound" | "error" | null>(null);
  const [loading, setLoading] = useState(false);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, mobile }),
      });
      if (res.status === 404) setError("notfound");
      else if (!res.ok) setError("error");
      else setResult(await res.json());
    } catch {
      setError("error");
    } finally {
      setLoading(false);
    }
  }

  const idx = result ? STAGES.findIndex((s) => s.key === result.stage) : -1;

  return (
    <>
      <h1 className="text-[1.7rem] font-extrabold">{t("track.title")}</h1>
      <form onSubmit={check} className="mt-4 space-y-5">
        <Field id="token" label="track.token">
          <input
            id="token"
            value={token}
            onChange={(e) => setToken(e.target.value.toUpperCase())}
            required
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="TH-2211-7KQ4X"
            className={`${inputClass()} token text-[1.25rem]`}
          />
        </Field>
        <Field id="mobile" label="track.mobile.label" hintKey="track.mobile.hint">
          <input
            id="mobile"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="98XXXXXXXX"
            className={`${inputClass()} text-[1.25rem]`}
          />
        </Field>
        <Button type="submit" size="lg" block icon="search" disabled={loading}>
          {loading ? t("track.checking") : t("track.check")}
        </Button>
      </form>

      {error && (
        <Notice tone="error" role="alert" className="mt-5">
          {t(error === "notfound" ? "track.notFound" : "track.error")}
        </Notice>
      )}

      {result && (
        <section className="mt-6 card p-5" aria-live="polite">
          <p className="token text-[1.3rem]">{result.token}</p>
          <p className="text-ink-3">{t("track.received", { date: date(result.received_at) })}</p>
          <ol className="mt-5">
            {STAGES.map((s, i) => {
              const reached = i <= idx;
              const last = i === STAGES.length - 1;
              return (
                <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0" aria-current={i === idx ? "step" : undefined}>
                  {!last && <span aria-hidden className={`absolute left-[17px] top-9 h-[calc(100%-2.25rem)] w-[3px] rounded ${i < idx ? "bg-mint-200" : "bg-surface"}`} />}
                  <span
                    className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full font-bold ${reached ? (i === idx ? "bg-mint-500 text-white shadow-[0_0_0_5px_var(--color-mint-100)]" : "bg-mint-100 text-mint-700") : "bg-surface text-ink-3"}`}
                  >
                    {reached ? <Icon name="check" size={20} /> : num(i + 1)}
                  </span>
                  <div className="pt-1">
                    <p className={reached ? "font-bold" : "text-ink-3"}>{t(s.label)}</p>
                    {s.key === "routed" && reached && result.department && <p className="text-ink-2">{refLabel(dept(result.department.code), locale)}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
          {result.sla_due_at && result.stage !== "closed" && (
            <Notice tone="info" className="mt-5">
              {t("track.expected", { date: date(result.sla_due_at) })}
            </Notice>
          )}
          {result.closing_remark && <Notice tone="done" className="mt-4">{result.closing_remark}</Notice>}
          {result.stage === "received" && <p className="mt-4 text-ink-2">{t("track.beingChecked")}</p>}
        </section>
      )}

      <p className="mt-10 text-center text-[0.9rem] text-ink-3">{t("track.privacy")}</p>
      <p className="mt-2 text-center text-[0.9rem]">
        <Link href="/" className="text-ink-3 underline underline-offset-4">
          {t("track.staff")}
        </Link>
      </p>
    </>
  );
}
