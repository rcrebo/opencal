import { db } from "@/lib/db";
import { bookings, slots } from "@/lib/schema";
import { getSessionEmail } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const myBookings = await db
    .select({
      id: bookings.id,
      name: bookings.name,
      email: bookings.email,
      notes: bookings.notes,
      createdAt: bookings.createdAt,
      slotStart: slots.startTime,
      slotEnd: slots.endTime,
    })
    .from(bookings)
    .innerJoin(slots, eq(bookings.slotId, slots.id))
    .where(eq(slots.owner, email))
    .orderBy(desc(slots.startTime));

  return NextResponse.json(myBookings);
}
