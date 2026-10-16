/**
 * Stateless OTP helpers.
 *
 * Serverless functions don't share memory between instances, so an in-memory
 * OTP store breaks on Vercel. Instead, `send-otp` returns a signed token
 * (HMAC of email + OTP + expiry) and `verify-otp` checks it — no database.
 */
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_TTL_MS = 5 * 60 * 1000;

const secret = () =>
  import.meta.env.OTP_SECRET ||
  process.env.OTP_SECRET ||
  import.meta.env.SMTP_PASS ||
  process.env.SMTP_PASS ||
  "";

const sign = (email, otp, expires) =>
  createHmac("sha256", secret())
    .update(`${email.toLowerCase()}|${otp}|${expires}`)
    .digest("base64url");

export const generateOtp = () => String(randomInt(100000, 1000000));

export function createToken(email, otp) {
  const expires = Date.now() + OTP_TTL_MS;
  return `${expires}.${sign(email, otp, expires)}`;
}

/** @returns {"ok" | "expired" | "invalid"} */
export function verifyToken(email, otp, token) {
  const [expiresRaw, signature] = String(token ?? "").split(".");
  const expires = Number(expiresRaw);
  if (!expires || !signature || !secret()) return "invalid";
  if (Date.now() > expires) return "expired";

  const expected = Buffer.from(sign(email, otp, expires));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given)
    ? "ok"
    : "invalid";
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
