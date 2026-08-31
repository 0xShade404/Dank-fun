import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard, type LeaderboardCategory } from "@/lib/db/queries";

const VALID: LeaderboardCategory[] = [
  "volume_24h",
  "market_cap",
  "price_change_24h",
  "creator_volume",
  "most_traded",
  "recently_graduated",
];

export async function GET(request: NextRequest) {
  const categoryParam = request.nextUrl.searchParams.get("category") ?? "volume_24h";
  const category = (VALID.includes(categoryParam as LeaderboardCategory) ? categoryParam : "volume_24h") as LeaderboardCategory;
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 20) || 20, 100);

  const rows = await getLeaderboard(category, limit);
  return NextResponse.json({ category, rows });
}
