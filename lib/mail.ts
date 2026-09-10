import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD belum diset di environment variables");
  }
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return transporter;
}

export async function sendMail(opts: { to: string | string[]; subject: string; html: string }) {
  const from = process.env.GMAIL_USER;
  const t = getTransporter();
  await t.sendMail({
    from: `Crackling HR <${from}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
}
