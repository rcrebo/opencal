import { db } from "@/lib/db";
import { slots, bookings } from "@/lib/schema";
import { getSessionEmail } from "@/lib/auth";
import { and, asc, eq, gte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mySlots = await db
    .select({
      id: slots.id,
      owner: slots.owner,
      startTime: slots.startTime,
      endTime: slots.endTime,
      isBooked: slots.isBooked,
      createdAt: slots.createdAt,
      bookerName: bookings.name,
      bookerEmail: bookings.email,
    })
    .from(slots)
    .leftJoin(bookings, eq(slots.id, bookings.slotId))
    .where(and(eq(slots.owner, email), gte(slots.startTime, new Date())))
    .orderBy(asc(slots.startTime));

  return NextResponse.json(mySlots);
}

export async function POST(request: NextRequest) {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const slotsToCreate: { owner: string; startTime: Date; endTime: Date }[] = [];

  if (Array.isArray(body)) {
    for (const s of body) {
      slotsToCreate.push({
        owner: email,
        startTime: new Date(s.startTime),
        endTime: new Date(s.endTime),
      });
    }
  } else {
    slotsToCreate.push({
      owner: email,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
    });
  }

  const created = await db.insert(slots).values(slotsToCreate).returning();
  return NextResponse.json(created, { status: 201 });
}
