import { db } from "@/lib/db";
import { slots } from "@/lib/schema";
import { getSessionEmail } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  // Only allow deleting own slots
  await db
    .delete(slots)
    .where(and(eq(slots.id, parseInt(id)), eq(slots.owner, email)));
  return NextResponse.json({ ok: true });
}
