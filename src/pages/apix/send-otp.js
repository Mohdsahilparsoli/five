export const prerender = false;

import nodemailer from "nodemailer";

const SMTP_USER = import.meta.env.SMTP_USER ?? process.env.SMTP_USER;
const SMTP_PASS = import.meta.env.SMTP_PASS ?? process.env.SMTP_PASS;

// ✅ GLOBAL STORE (IMPORTANT FIX)
globalThis.otpStore = globalThis.otpStore || new Map();

export async function POST({ request }) {
  let body;

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!email) {
    return new Response(JSON.stringify({ error: "Email required" }), { status: 400 });
  }

  if (!SMTP_USER || !SMTP_PASS) {
    console.error("SMTP_USER / SMTP_PASS env variables missing");
    return new Response(JSON.stringify({ error: "Mail service not configured" }), { status: 500 });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // ✅ SAVE IN GLOBAL
  globalThis.otpStore.set(email, otp);

  setTimeout(() => {
    globalThis.otpStore.delete(email);
  }, 5 * 60 * 1000);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      // 🔐 Credentials ab Vercel Environment Variables se aate hain
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  try {
  await transporter.sendMail({
     from: `"Ogrelogic Support" <${SMTP_USER}>`,
  to: email,
  subject: "Your OTP Code – Valid for 5 Minutes",
  html: `
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
        © ${new Date().getFullYear()} Fivepointsbenefits. All rights reserved.
      </p>
    </div>
  </div>
  `,
  });
  } catch (error) {
    console.error("OTP mail failed:", error?.message ?? error);
    return new Response(JSON.stringify({ error: "Failed to send OTP" }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }));
}