import { NextRequest, NextResponse } from "next/server";
import { getHolders, getTokenByAddress } from "@/lib/db/queries";

export async function GET(request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 50) || 50, 200);
  const [token, holders] = await Promise.all([getTokenByAddress(address), getHolders(address, limit)]);

  const totalSupply = token ? BigInt(token.curveSupplyCap) + BigInt(token.graduationReserve) : 0n;

  return NextResponse.json({
    holders: holders.map((h) => ({
      ...h,
      percentBps: totalSupply > 0n ? Number((BigInt(h.balance) * 10_000n) / totalSupply) : 0,
    })),
  });
}
