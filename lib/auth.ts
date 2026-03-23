import { cookies } from "next/headers";
import { db } from "./db";
import { otpCodes } from "./schema";
import { eq, and, gt } from "drizzle-orm";
import { Resend } from "resend";

const COOKIE_NAME = "admin_session";
// Add admin emails here — only these can log in
const ALLOWED_EMAILS = ["alice@example.com", "bob@example.com"];

export function isAllowedEmail(email: string): boolean {
  return ALLOWED_EMAILS.includes(email.toLowerCase().trim());
}

export async function generateAndSendOtp(email: string): Promise<void> {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db.insert(otpCodes).values({ email: email.toLowerCase().trim(), code, expiresAt });

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: `OpenCal <${process.env.EMAIL_FROM || "noreply@example.com"}>`,
    to: [email],
    subject: `Your login code: ${code}`,
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#18181b;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">Admin Login Code</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 20px;color:#3f3f46;font-size:15px;line-height:1.6;">
        Here's your one-time login code:
      </p>
      <div style="background:#f4f4f5;border-radius:8px;padding:16px;text-align:center;margin:0 0 20px;">
        <span style="font-size:32px;font-weight:700;letter-spacing:6px;color:#18181b;">${code}</span>
      </div>
      <p style="margin:0;color:#a1a1aa;font-size:13px;">
        This code expires in 10 minutes. If you didn't request this, ignore this email.
      </p>
    </div>
  </div>
</body>
</html>
    `,
  });
}

export async function verifyOtp(email: string, code: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();

  const [match] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.email, normalizedEmail),
        eq(otpCodes.code, code),
        gt(otpCodes.expiresAt, now)
      )
    )
    .limit(1);

  if (!match) return false;

  // Delete used and expired codes for this email
  await db.delete(otpCodes).where(eq(otpCodes.email, normalizedEmail));

  return true;
}

async function createSessionToken(email: string): Promise<string> {
  const secret = process.env.ADMIN_SECRET!;
  const data = `authenticated:${email}:${secret}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return `${email}:${Buffer.from(signature).toString("hex")}`;
}

export async function verifySession(): Promise<boolean> {
  return (await getSessionEmail()) !== null;
}

export async function getSessionEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const colonIdx = token.indexOf(":");
  if (colonIdx === -1) return null;

  const email = token.slice(0, colonIdx);
  if (!isAllowedEmail(email)) return null;

  const expected = await createSessionToken(email);
  return token === expected ? email : null;
}

export async function setSessionCookie(email: string): Promise<void> {
  const token = await createSessionToken(email);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
}
