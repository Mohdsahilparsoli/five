export const prerender = false;

import nodemailer from "nodemailer";
import { createToken, generateOtp, json } from "../../lib/otp";

const SMTP_USER = import.meta.env.SMTP_USER || process.env.SMTP_USER;
const SMTP_PASS = import.meta.env.SMTP_PASS || process.env.SMTP_PASS;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emailHtml = (otp, year) => `
  <div style="font-family: Arial, sans-serif; background-color:#f4f6f8; padding:20px;">
    <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:10px; padding:30px; box-shadow:0 4px 10px rgba(0,0,0,0.05);">
      
      <h2 style="color:#333; text-align:center;">🔐 Email Verification</h2>
      
      <p style="font-size:16px; color:#555;">
        Hello,
      </p>

      <p style="font-size:16px; color:#555;">
        Use the following One-Time Password (OTP) to complete your verification process:
      </p>

      <div style="text-align:center; margin:30px 0;">
        <span style="
          display:inline-block;
          font-size:28px;
          letter-spacing:6px;
          font-weight:bold;
          color:#2c3e50;
          background:#f1f3f5;
          padding:15px 25px;
          border-radius:8px;
        ">
          ${otp}
        </span>
      </div>

      <p style="font-size:15px; color:#777; text-align:center;">
        ⏳ This OTP is valid for <strong>5 minutes</strong>.
      </p>

      <p style="font-size:14px; color:#999; margin-top:30px;">
        If you did not request this, please ignore this email.
      </p>

      <hr style="margin:30px 0; border:none; border-top:1px solid #eee;" />

      <p style="font-size:13px; color:#aaa; text-align:center;">
        © ${year} Fivepointsbenefits. All rights reserved.
      </p>
    </div>
  </div>
`;

/** POST { email } → { success, token } — pass `token` to /apix/verify-otp */
export async function POST({ request }) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: "Invalid JSON body" }, 400);

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!EMAIL_RE.test(email)) return json({ error: "Valid email required" }, 400);

  if (!SMTP_USER || !SMTP_PASS) {
    console.error("[otp] SMTP_USER / SMTP_PASS env variables missing");
    return json({ error: "Mail service not configured" }, 500);
  }

  const otp = generateOtp();
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  try {
    await transporter.sendMail({
      from: `"Five Points Benefits" <${SMTP_USER}>`,
      to: email,
      subject: "Your OTP Code – Valid for 5 Minutes",
      html: emailHtml(otp, new Date().getFullYear()),
    });
  } catch (error) {
    console.error("[otp] Mail failed:", error?.message ?? error);
    return json({ error: "Failed to send OTP" }, 500);
  }

  return json({ success: true, token: createToken(email, otp) });
}
