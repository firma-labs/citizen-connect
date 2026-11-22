import "server-only";
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

export function tokenSms(language: string, token: string, trackUrl: string): string {
  switch (language) {
    case "hi":
      return `जनता दरबार: आपका आवेदन प्राप्त हुआ। टोकन क्र. ${token}. स्थिति देखें: ${trackUrl} - वन मंत्री कार्यालय, महाराष्ट्र`;
    case "en":
      return `Janata Darbar: Your application has been received. Token ${token}. Check status: ${trackUrl} - Office of the Forest Minister, Maharashtra`;
    default:
      return `जनता दरबार: आपला अर्ज प्राप्त झाला आहे. टोकन क्र. ${token}. स्थिती पहा: ${trackUrl} - वनमंत्री कार्यालय, महाराष्ट्र`;
  }
}
