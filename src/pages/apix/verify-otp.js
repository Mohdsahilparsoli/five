export const prerender = false;

import { json, verifyToken } from "../../lib/otp";

/** POST { email, otp, token } → { success } */
export async function POST({ request }) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: "Invalid JSON body" }, 400);

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const otp = String(body.otp ?? "").trim();

  const result = verifyToken(email, otp, body.token);
  if (result === "expired") return json({ error: "OTP expired" }, 400);
  if (result !== "ok") return json({ error: "Invalid OTP" }, 400);

  return json({ success: true, message: "OTP verified" });
}
