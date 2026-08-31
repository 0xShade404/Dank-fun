import { NextRequest, NextResponse } from "next/server";
import { processIndexerBatch, indexerConfig } from "@/lib/chain/indexer";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const expected = process.env.INDEXER_ADMIN_TOKEN;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...await processIndexerBatch() });
  } catch (error) {
    console.error("indexer batch failed", error);
    return NextResponse.json({ ok: false, error: "Indexer batch failed", config: indexerConfig() }, { status: 503 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, config: indexerConfig(), usage: "POST with Authorization: Bearer <INDEXER_ADMIN_TOKEN>" });
}
