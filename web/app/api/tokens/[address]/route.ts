import { NextRequest, NextResponse } from "next/server";
import { getTokenByAddress, tokenSpotPriceNative, tokenMarketCapNative, tokenProgressBps, getLiquidityEvents } from "@/lib/db/queries";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const token = await getTokenByAddress(address);

  if (!token) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  const liquidity = await getLiquidityEvents(token.address);

  return NextResponse.json({
    token: {
      ...token,
      spotPrice: tokenSpotPriceNative(token).toString(),
      marketCap: tokenMarketCapNative(token).toString(),
      progressBps: tokenProgressBps(token),
      remainingCurveSupply: (BigInt(token.curveSupplyCap) - BigInt(token.sold)).toString(),
    },
    liquidity,
  });
}
