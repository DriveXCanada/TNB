import nodemailer from "nodemailer";

export function mailEnabled() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

export async function sendMail(to: string[], subject: string, text: string) {
  if (!mailEnabled() || to.length === 0) return;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  try {
    await transport.sendMail({ from: process.env.SMTP_FROM, to: to.join(", "), subject, text });
  } catch (err) {
    console.error("Failed to send notification email", err);
  }
}

export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
