import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateNonce, buildSignInMessage } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const address = body?.address;

  if (typeof address !== "string" || !isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const lowerAddress = address.toLowerCase();
  const nonce = generateNonce();
  const now = Math.floor(Date.now() / 1000);

  const existing = await db.select().from(users).where(eq(users.address, lowerAddress)).limit(1);
  if (existing.length === 0) {
    await db.insert(users).values({ address: lowerAddress, nonce, createdAt: now });
  } else {
    await db.update(users).set({ nonce }).where(eq(users.address, lowerAddress));
  }

  return NextResponse.json({ message: buildSignInMessage(lowerAddress, nonce) });
}
