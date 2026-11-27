import nodemailer from "nodemailer";
import { getSettings } from "./settings";

/**
 * Two ways to send email:
 * - Resend (RESEND_API_KEY): sends over HTTPS, so it works on hosts that block outgoing SMTP
 *   (Railway's Trial/Hobby plans do).
 * - SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS), e.g. Gmail / Google Workspace.
 * Either way MAIL_FROM (or SMTP_FROM) is the sender, e.g. "TNB Process Serving <notices@example.com>".
 */
const from = () => process.env.MAIL_FROM || process.env.SMTP_FROM || "";

export function mailEnabled() {
  return Boolean(from() && (process.env.RESEND_API_KEY || process.env.SMTP_HOST));
}

type Attachment = { filename: string; content: Buffer; contentType: string };

async function viaResend(to: string[], subject: string, text: string, attachments: Attachment[], replyTo?: string) {
  const res = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: from(),
      to,
      subject,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
      attachments: attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

async function viaSmtp(to: string[], subject: string, text: string, attachments: Attachment[], replyTo?: string) {
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({ from: from(), to: to.join(", "), subject, text, attachments, replyTo });
}

export async function sendMail(to: string[], subject: string, text: string, attachments: Attachment[] = []) {
  if (!mailEnabled() || to.length === 0) return;
  // Replies go to the company email from Settings, if one is set.
  const replyTo = (await getSettings()).companyEmail || undefined;
  try {
    if (process.env.RESEND_API_KEY) await viaResend(to, subject, text, attachments, replyTo);
    else await viaSmtp(to, subject, text, attachments, replyTo);
  } catch (err) {
    console.error("Failed to send email", err);
  }
}

export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
