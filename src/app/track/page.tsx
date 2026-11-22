"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

// Public, citizen-facing: Marathi first, English second (PRD §10).

export default function TrackPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="bg-forest-700 px-4 py-4 text-white" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
        <div className="mx-auto max-w-xl">
          <div className="text-xl font-extrabold">अर्जाची स्थिती · Application status</div>
          <div className="text-sm text-white/85">जनता दरबार — वनमंत्री कार्यालय, महाराष्ट्र</div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-5">
        <Suspense>
          <Track />
        </Suspense>
      </main>
    </div>
  );
}

interface Result {
  token: string;
  stage: "received" | "routed" | "in_progress" | "closed";
  received_at: string;
  department: { code: string; name: string; mr: string } | null;
  sla_due_at: string | null;
  closing_remark: string | null;
}

const STAGES = [
  { key: "received", mr: "अर्ज प्राप्त", en: "Received" },
  { key: "routed", mr: "विभागाकडे पाठवला", en: "Sent to department" },
  { key: "in_progress", mr: "कार्यवाही सुरू", en: "Action in progress" },
  { key: "closed", mr: "निकाली", en: "Closed" },
] as const;

function Track() {
  const params = useSearchParams();
  const [token, setToken] = useState(params.get("t") ?? "");
  const [mobile, setMobile] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      if (res.status === 404) throw new Error("notfound");
      if (!res.ok) throw new Error("error");
      setResult(await res.json());
    } catch (err) {
      setError(
        (err as Error).message === "notfound"
          ? "टोकन किंवा मोबाईल क्रमांक जुळत नाही. · Token or mobile number does not match."
          : "सध्या स्थिती पाहता येत नाही. नंतर प्रयत्न करा. · Could not check right now — please try again later.",
      );
    } finally {
      setLoading(false);
    }
  }

  const idx = result ? STAGES.findIndex((s) => s.key === result.stage) : -1;

  return (
    <>
      <form onSubmit={check} className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
        <label className="block">
          <span className="font-bold">टोकन क्रमांक · Token number</span>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value.toUpperCase())}
            required
            autoCapitalize="characters"
            placeholder="TH-2211-7KQ4X"
            className="token-text mt-1 block w-full rounded-xl border-2 border-line px-4 py-3 text-xl"
          />
        </label>
        <label className="block">
          <span className="font-bold">मोबाईल क्रमांक · Mobile number</span>
          <input
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            required
            inputMode="numeric"
            autoComplete="tel"
            placeholder="98XXXXXXXX"
            className="mt-1 block w-full rounded-xl border-2 border-line px-4 py-3 text-xl"
          />
          <span className="text-sm text-muted">अर्जावर दिलेला · The one written on your application</span>
        </label>
        <button disabled={loading} className="min-h-16 w-full rounded-2xl bg-forest-700 text-white disabled:bg-gray-400">
          <span className="block text-xl font-extrabold">{loading ? "शोधत आहे…" : "स्थिती पहा"}</span>
          <span className="block text-sm">Check status</span>
        </button>
      </form>

      {error && <p className="mt-4 rounded-xl bg-danger-50 p-4 text-danger-600">{error}</p>}

      {result && (
        <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
          <div className="token-text text-xl font-extrabold">{result.token}</div>
          <div className="text-sm text-muted">प्राप्त · Received {new Date(result.received_at).toLocaleDateString("en-IN")}</div>
          <ol className="mt-4 space-y-3">
            {STAGES.map((s, i) => (
              <li key={s.key} className="flex items-center gap-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-bold ${i <= idx ? "bg-forest-700 text-white" : "bg-gray-200 text-gray-500"}`}>
                  {i <= idx ? "✓" : i + 1}
                </span>
                <span className={i <= idx ? "" : "text-gray-500"}>
                  <b>{s.mr}</b> · {s.en}
                  {s.key === "routed" && result.department && i <= idx && (
                    <span className="block text-sm">
                      {result.department.mr} · {result.department.name}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
          {result.sla_due_at && result.stage !== "closed" && (
            <p className="mt-4 rounded-lg bg-forest-50 p-3 text-[15px]">
              अपेक्षित कार्यवाही दिनांक · Expected action by <b>{new Date(result.sla_due_at).toLocaleDateString("en-IN")}</b>
            </p>
          )}
          {result.closing_remark && <p className="mt-3 rounded-lg bg-forest-50 p-3">{result.closing_remark}</p>}
          {result.stage === "received" && (
            <p className="mt-4 text-sm text-muted">तुमचा अर्ज तपासला जात आहे. · Your application is being checked.</p>
          )}
        </section>
      )}

      <p className="mt-8 text-center text-xs text-muted">
        तुमची माहिती केवळ तुमच्या अर्जावरील कार्यवाहीसाठी वापरली जाते. · Your information is used only to act on your application.
      </p>
      <p className="mt-2 text-center text-xs">
        <Link href="/" className="text-muted underline">Staff</Link>
      </p>
    </>
  );
}
