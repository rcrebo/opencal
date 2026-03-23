import { db } from "@/lib/db";
import { slots } from "@/lib/schema";
import { eq, gt, and, asc } from "drizzle-orm";
import { getHostBySlug } from "@/lib/hosts";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (key !== process.env.BOOKING_SECRET) {
    return NextResponse.json({ error: "Invalid access key" }, { status: 403 });
  }

  const host = request.nextUrl.searchParams.get("host");
  if (!host) {
    return NextResponse.json({ error: "host parameter required" }, { status: 400 });
  }

  const hostConfig = getHostBySlug(host);
  if (!hostConfig) {
    return NextResponse.json({ error: "Unknown host" }, { status: 404 });
  }

  const now = new Date();
  const available = await db
    .select()
    .from(slots)
    .where(
      and(
        eq(slots.owner, hostConfig.email),
        eq(slots.isBooked, false),
        gt(slots.startTime, now)
      )
    )
    .orderBy(asc(slots.startTime));

  return NextResponse.json(available);
}
