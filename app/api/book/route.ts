import { db } from "@/lib/db";
import { slots, bookings } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { sendBookingConfirmation, sendBookingNotification } from "@/lib/email";
import { getHostByEmail, getZoomLink } from "@/lib/hosts";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { slotId, name, email, notes, participants, key } = body;

  if (key !== process.env.BOOKING_SECRET) {
    return NextResponse.json({ error: "Invalid access key" }, { status: 403 });
  }

  if (!slotId || !name || !email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Atomically claim the slot (check + update in one query to prevent double-booking)
  const [slot] = await db
    .update(slots)
    .set({ isBooked: true })
    .where(and(eq(slots.id, slotId), eq(slots.isBooked, false)))
    .returning();

  if (!slot) {
    return NextResponse.json({ error: "Slot is no longer available" }, { status: 409 });
  }

  const [booking] = await db
    .insert(bookings)
    .values({ slotId, name, email, notes: notes || null, participants: Array.isArray(participants) ? participants : [] })
    .returning();

  // Get host info for zoom link and notification
  const host = getHostByEmail(slot.owner);
  const zoomLink = await getZoomLink(slot.owner);

  // Format times in UK timezone for the email
  const ukFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const ukDateFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const startTime = ukFormatter.format(slot.startTime);
  const endTime = ukFormatter.format(slot.endTime);
  const date = ukDateFormatter.format(slot.startTime);
  const hostName = host?.name || "us";

  const startTimeIso = slot.startTime.toISOString();
  const endTimeIso = slot.endTime.toISOString();

  const emailParams = {
    name,
    date,
    startTime,
    endTime,
    startTimeIso,
    endTimeIso,
    zoomLink,
    notes,
    hostName,
  };

  try {
    const allRecipients = [email, ...(Array.isArray(participants) ? participants : [])];
    await Promise.all([
      ...allRecipients.map((to) =>
        sendBookingConfirmation({ ...emailParams, to })
      ),
      sendBookingNotification({
        ...emailParams,
        to: slot.owner,
        bookerEmail: email,
      }),
    ]);
  } catch (e) {
    console.error("Failed to send email:", e);
  }

  return NextResponse.json({ booking, zoomLink });
}
