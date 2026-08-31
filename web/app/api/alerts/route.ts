import { NextRequest, NextResponse } from "next/server";
import { getRecentAlerts, getTokenAlerts } from "@/lib/db/queries";

export async function GET(request: NextRequest) {
  const tokenAddress = request.nextUrl.searchParams.get("token");
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 30) || 30, 100);
  const rows = tokenAddress ? await getTokenAlerts(tokenAddress, limit) : await getRecentAlerts(limit);
  return NextResponse.json({ alerts: rows });
}
