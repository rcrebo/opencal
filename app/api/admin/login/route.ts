import { isAllowedEmail, generateAndSendOtp } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email || !isAllowedEmail(email)) {
    return NextResponse.json({ error: "Unauthorized email" }, { status: 401 });
  }

  try {
    await generateAndSendOtp(email);
  } catch (e) {
    console.error("Failed to send OTP:", e);
    return NextResponse.json({ error: "Failed to send code" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
