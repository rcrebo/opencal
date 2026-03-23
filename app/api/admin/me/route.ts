import { getSessionEmail } from "@/lib/auth";
import { getHostByEmail } from "@/lib/hosts";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const host = getHostByEmail(email);
  const origin = request.nextUrl.origin;
  const bookingSecret = process.env.BOOKING_SECRET || "";
  const bookingLink = `${origin}/?key=${encodeURIComponent(bookingSecret)}&host=${host?.slug || ""}`;

  return NextResponse.json({
    email,
    name: host?.name || email,
    slug: host?.slug,
    bookingLink,
  });
}
