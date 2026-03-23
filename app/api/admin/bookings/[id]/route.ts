import { db } from "@/lib/db";
import { bookings, slots } from "@/lib/schema";
import { getSessionEmail } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { sendCancellationEmail } from "@/lib/email";
import { getHostByEmail } from "@/lib/hosts";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const bookingId = parseInt(id, 10);
  if (isNaN(bookingId)) {
    return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 });
  }

  // Fetch booking + slot, ensuring the slot belongs to this admin
  const [booking] = await db
    .select({
      id: bookings.id,
      name: bookings.name,
      email: bookings.email,
      participants: bookings.participants,
      slotId: bookings.slotId,
      slotStart: slots.startTime,
      slotEnd: slots.endTime,
    })
    .from(bookings)
    .innerJoin(slots, eq(bookings.slotId, slots.id))
    .where(and(eq(bookings.id, bookingId), eq(slots.owner, email)));

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Delete booking and reopen the slot
  await db.delete(bookings).where(eq(bookings.id, bookingId));
  await db.update(slots).set({ isBooked: false }).where(eq(slots.id, booking.slotId));

  // Send cancellation email if requested
  const { searchParams } = request.nextUrl;
  if (searchParams.get("notify") === "true") {
    const host = getHostByEmail(email);
    const ukDateFormatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const ukTimeFormatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    try {
      const cancelParams = {
        name: booking.name,
        date: ukDateFormatter.format(booking.slotStart),
        startTime: ukTimeFormatter.format(booking.slotStart),
        endTime: ukTimeFormatter.format(booking.slotEnd),
        hostName: host?.name || "us",
      };
      const allRecipients = [booking.email, ...(booking.participants || [])];
      await Promise.all(
        allRecipients.map((to) => sendCancellationEmail({ ...cancelParams, to }))
      );
    } catch (e) {
      console.error("Failed to send cancellation email:", e);
    }
  }

  return NextResponse.json({ ok: true });
}
