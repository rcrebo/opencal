import { isAllowedEmail, verifyOtp, setSessionCookie } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { email, code } = await request.json();

  if (!email || !code || !isAllowedEmail(email)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const valid = await verifyOtp(email, code);
  if (!valid) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
  }

  await setSessionCookie(email);
  return NextResponse.json({ ok: true });
}
