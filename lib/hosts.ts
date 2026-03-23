import { db } from "./db";
import { settings } from "./schema";
import { eq } from "drizzle-orm";

export interface HostConfig {
  email: string;
  name: string;
  slug: string;
}

// Configure your hosts here
export const HOSTS: HostConfig[] = [
  {
    email: "alice@example.com",
    name: "Alice Smith",
    slug: "alice",
  },
  {
    email: "bob@example.com",
    name: "Bob Jones",
    slug: "bob",
  },
];

export function getHostBySlug(slug: string): HostConfig | undefined {
  return HOSTS.find((h) => h.slug === slug);
}

export function getHostByEmail(email: string): HostConfig | undefined {
  return HOSTS.find((h) => h.email === email.toLowerCase());
}

export async function getZoomLink(email: string): Promise<string> {
  const [row] = await db
    .select({ zoomLink: settings.zoomLink })
    .from(settings)
    .where(eq(settings.email, email.toLowerCase()))
    .limit(1);
  return row?.zoomLink || "";
}
