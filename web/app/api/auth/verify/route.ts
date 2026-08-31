import { NextRequest, NextResponse } from "next/server";
import { isAddress, recoverMessageAddress } from "viem";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buildSignInMessage, setSessionCookie } from "@/lib/auth";


export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const address = body?.address;
  const signature = body?.signature;

  if (typeof address !== "string" || !isAddress(address) || typeof signature !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const lowerAddress = address.toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.address, lowerAddress)).limit(1);
  if (!user) {
    return NextResponse.json({ error: "Request a nonce first" }, { status: 400 });
  }

  const expectedMessage = buildSignInMessage(lowerAddress, user.nonce);

  let recovered: string;
  try {
    recovered = await recoverMessageAddress({
      message: expectedMessage,
      signature: signature as `0x${string}`,
    });
  } catch {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
  }

  if (recovered.toLowerCase() !== lowerAddress) {
    return NextResponse.json({ error: "Signature does not match address" }, { status: 401 });
  }

  // Rotate the nonce so this signature can't be replayed.
  await db
    .update(users)
    .set({ nonce: crypto.randomUUID(), lastLoginAt: Math.floor(Date.now() / 1000) })
    .where(eq(users.address, lowerAddress));

  await setSessionCookie(lowerAddress);

  return NextResponse.json({ address: lowerAddress });
}
