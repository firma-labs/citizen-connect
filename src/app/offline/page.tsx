"use client";

import { AppBar, Screen } from "@/components/ui/AppBar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n";

export default function Offline() {
  const { t } = useI18n();
  return (
    <>
      <AppBar />
      <Screen>
        <div className="mx-auto max-w-md py-12 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ink text-white">
            <Icon name="offline" size={30} />
          </span>
          <h1 className="mt-5 text-[1.6rem] font-extrabold">{t("offline.title")}</h1>
          <p className="mt-2 text-ink-2">{t("offline.body")}</p>
          <Button href="/capture" size="lg" icon="camera" className="mt-6">
            {t("home.scan")}
          </Button>
        </div>
      </Screen>
    </>
  );
}
