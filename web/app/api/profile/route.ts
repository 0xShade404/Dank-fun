import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionAddress } from "@/lib/auth";

const MAX_LEN = { displayName: 32, bio: 280, social: 200 };

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Updates the SIGNED-IN wallet's own profile only -- there is no address in the request body,
 * so there's nothing to check-and-mismatch: the session cookie (proven by a wallet signature at
 * sign-in, see lib/auth.ts) is the only source of "which wallet" for this write.
 */
export async function PATCH(request: NextRequest) {
  const address = await getSessionAddress();
  if (!address) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const update = {
    displayName: clean(body.displayName, MAX_LEN.displayName),
    bio: clean(body.bio, MAX_LEN.bio),
    twitter: clean(body.twitter, MAX_LEN.social),
    telegram: clean(body.telegram, MAX_LEN.social),
    website: clean(body.website, MAX_LEN.social),
    profileUpdatedAt: Math.floor(Date.now() / 1000),
  };

  await db.update(users).set(update).where(eq(users.address, address));

  return NextResponse.json({ ok: true, ...update });
}
