import "server-only";
import { translate, type Locale } from "@/lib/i18n/core";
import type { SmsRecord } from "@/lib/types";

// SMS on save, in the letter's language (PRD §4.1 #5). Production uses AWS End
// User Messaging with TRAI DLT-registered templates (PRD §9.2); until those are
// approved the pilot only logs the message it would send (SMS_PROVIDER=console).
// The wording below must match the DLT templates once registered.

export interface SmsSender {
  readonly name: string;
  send(to: string, body: string): Promise<{ status: SmsRecord["status"]; detail?: string }>;
}

const consoleSender: SmsSender = {
  name: "console",
  async send(to, body) {
    console.log(`[sms:console] to=+91${to}\n${body}`);
    return { status: "logged", detail: "Pilot: SMS not sent — DLT templates pending" };
  },
};

export function getSmsSender(): SmsSender {
  switch (process.env.SMS_PROVIDER ?? "console") {
    case "console":
      return consoleSender;
    default:
      throw new Error(`Unknown SMS_PROVIDER ${process.env.SMS_PROVIDER}`);
  }
}

/** SMS sent after staff save an application, in the letter's language (Marathi if it is another language). Text: messages/<lang>.json "sms.tokenReceived". */
export function tokenSms(language: string, token: string, trackUrl: string): string {
  const locale: Locale = language === "hi" || language === "en" ? language : "mr";
  return translate(locale, "sms.tokenReceived", { token, url: trackUrl });
}
