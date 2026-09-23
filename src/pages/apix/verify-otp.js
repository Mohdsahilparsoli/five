export const prerender = false;

// ✅ SAME GLOBAL STORE
globalThis.otpStore = globalThis.otpStore || new Map();

export async function POST({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const otp = typeof body?.otp === "string" ? body.otp.trim() : String(body?.otp ?? "");

  const savedOtp = globalThis.otpStore.get(email);


  if (!savedOtp) {
    return new Response(JSON.stringify({ error: "OTP expired" }), { status: 400 });
  }

  if (savedOtp !== otp) {
    return new Response(JSON.stringify({ error: "Invalid OTP" }), { status: 400 });
  }

  globalThis.otpStore.delete(email);

  return new Response(JSON.stringify({ success: true, message: "OTP verified" }));
}