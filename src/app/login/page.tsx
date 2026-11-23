"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AppBar, Screen } from "@/components/ui/AppBar";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { saveSettings } from "@/lib/client/settings";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  return (
    <>
      <AppBar publicPage />
      <Screen>
        <Suspense>
          <Login />
        </Suspense>
      </Screen>
    </>
  );
}

function Login() {
  const { t } = useI18n();
  const params = useSearchParams();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"invalid" | "notConfigured" | "error" | null>(null);

  // Only same-site paths, so the link can't send someone elsewhere after sign-in.
  const next = (() => {
    const n = params.get("next") ?? "/";
    return n.startsWith("/") && !n.startsWith("//") ? n : "/";
  })();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, password }),
      });
      if (res.status === 401) return setError("invalid");
      if (res.status === 503) return setError("notConfigured");
      if (!res.ok) return setError("error");
      const body = await res.json();
      // The signed-in identity replaces any name typed while the app was open to everyone.
      if (body.name) saveSettings({ staff: body.name });
      window.location.replace(next); // full load so the service worker and sync start signed in
    } catch {
      setError("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="relative isolate overflow-hidden rounded-[var(--radius-hero)] bg-gradient-to-br from-indigo-50 via-sky-50 to-mint-50 p-6">
        <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 -z-10 h-40 w-40 rounded-full bg-white/60" />
        <h1 className="text-[1.7rem] font-bold tracking-tight">{t("login.title")}</h1>
        <p className="mt-1 text-ink-2">{t("login.body")}</p>
      </div>

      <form onSubmit={submit} className="card mt-5 space-y-5 p-5">
        <Field id="mobile" label="login.mobile">
          <input
            id="mobile"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            required
            inputMode="tel"
            autoComplete="username"
            placeholder="98XXXXXXXX"
            className={`${inputClass()} text-[1.15rem]`}
          />
        </Field>
        <Field id="password" label="login.password">
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className={`${inputClass()} text-[1.15rem]`}
          />
        </Field>
        {error && (
          <Notice tone="error" role="alert">
            {t(error === "invalid" ? "login.invalid" : error === "notConfigured" ? "login.notConfigured" : "login.error")}
          </Notice>
        )}
        <Button type="submit" size="lg" block disabled={busy}>
          {busy ? t("login.signingIn") : t("login.submit")}
        </Button>
      </form>

      <p className="mt-6 text-center text-[0.92rem] text-ink-3">
        <Link href="/track" className="underline underline-offset-4">
          {t("login.citizen")}
        </Link>
      </p>
    </div>
  );
}
