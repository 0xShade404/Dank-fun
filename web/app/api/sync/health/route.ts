import { NextResponse } from "next/server";
import { publicClient } from "@/lib/chain/client";
import { validateDogechainConfig } from "@/lib/chain/config";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    validateDogechainConfig();
    const [blockNumber] = await Promise.all([
      publicClient.getBlockNumber(),
      db.execute(sql`select 1`),
    ]);
    return NextResponse.json({ ok: true, chainId: publicClient.chain.id, blockNumber: blockNumber.toString() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Service unavailable" }, { status: 503 });
  }
}
