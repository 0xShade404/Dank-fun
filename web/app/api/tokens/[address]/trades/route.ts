import { NextRequest, NextResponse } from "next/server";
import { getTrades } from "@/lib/db/queries";

export async function GET(request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 50) || 50, 200);
  const trades = await getTrades(address, limit);
  return NextResponse.json({ trades });
}
