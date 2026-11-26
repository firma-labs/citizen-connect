import "server-only";
import { translate, type Locale } from "@/lib/i18n/core";
import type { CitizenMessage } from "@/lib/types";

// WhatsApp message to the citizen on save, in the letter's language (PRD §4.1
// #5). This phase uses WhatsApp only (no SMS). Production sends through the
// WhatsApp Business Platform (Cloud API) with an approved utility template;
// until the business number and template are approved the pilot only logs the
// message it would send (WHATSAPP_PROVIDER=console). The wording must match
// the approved template: messages/<lang>.json "whatsapp.tokenReceived".

export interface MessageSender {
  readonly name: string;
  send(to: string, body: string): Promise<{ status: CitizenMessage["status"]; detail?: string }>;
}

const consoleSender: MessageSender = {
  name: "console",
  async send(to, body) {
    console.log(`[whatsapp:console] to=+91${to}\n${body}`);
    return { status: "logged", detail: "Pilot: WhatsApp message not sent — template approval pending" };
  },
};

export function getMessageSender(): MessageSender {
  switch (process.env.WHATSAPP_PROVIDER ?? "console") {
    case "console":
      return consoleSender;
    default:
      throw new Error(`Unknown WHATSAPP_PROVIDER ${process.env.WHATSAPP_PROVIDER}`);
  }
}

/** WhatsApp message sent after staff save an application, in the letter's language (Marathi if it is another language). */
export function tokenMessage(language: string, token: string, trackUrl: string): string {
  const locale: Locale = language === "hi" || language === "en" ? language : "mr";
  return translate(locale, "whatsapp.tokenReceived", { token, url: trackUrl });
}
