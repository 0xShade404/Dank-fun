import { NextRequest, NextResponse } from "next/server";
import { isHash } from "viem";
import { syncTransaction } from "@/lib/chain/sync";

/**
 * Indexes a single confirmed transaction's logs into the database. The client calls this right
 * after a wallet-signed createToken/buy/sell tx confirms (see hooks/use-sync-tx.ts). This is a
 * pragmatic stand-in for the always-on event-listening worker described in docs/ARCHITECTURE.md
 * -- fine for a single-instance MVP where trades only happen through this UI, but a production
 * deployment needs a real indexer that also catches txs submitted outside the app.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const txHash = body?.txHash;

  if (typeof txHash !== "string" || !isHash(txHash)) {
    return NextResponse.json({ error: "Invalid txHash" }, { status: 400 });
  }

  try {
    const result = await syncTransaction(txHash as `0x${string}`);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("sync/tx failed", error);
    return NextResponse.json({ error: "Failed to sync transaction" }, { status: 500 });
  }
}
