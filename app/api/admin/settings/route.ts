import { db } from "@/lib/db";
import { settings } from "@/lib/schema";
import { getSessionEmail } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.email, email))
    .limit(1);

  return NextResponse.json({ zoomLink: row?.zoomLink || "" });
}

export async function PUT(request: NextRequest) {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { zoomLink } = await request.json();

  const [existing] = await db
    .select()
    .from(settings)
    .where(eq(settings.email, email))
    .limit(1);

  if (existing) {
    await db
      .update(settings)
      .set({ zoomLink: zoomLink || "" })
      .where(eq(settings.email, email));
  } else {
    await db
      .insert(settings)
      .values({ email, zoomLink: zoomLink || "" });
  }

  return NextResponse.json({ ok: true });
}
