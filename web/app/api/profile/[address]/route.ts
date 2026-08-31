import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { getPortfolio, getCreatorStats, getUserByAddress } from "@/lib/db/profile";
import { computeBadges } from "@/lib/badges";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const lower = address.toLowerCase();
  const [user, portfolio, creatorStats] = await Promise.all([
    getUserByAddress(lower),
    getPortfolio(lower),
    getCreatorStats(lower),
  ]);

  const now = Math.floor(Date.now() / 1000);
  const accountAgeSeconds = user ? now - user.createdAt : 0;
  const hasProfile = Boolean(user?.displayName || user?.bio);
  const portfolioValueNative = Number(portfolio.totalCurrentValueNative) / 1e18;

  const badges = computeBadges({
    accountAgeSeconds,
    tokensCreated: creatorStats.tokenCount,
    tokensGraduated: creatorStats.graduatedCount,
    tradeCount: portfolio.tradeCount,
    hasProfile,
    portfolioValueNative,
  });

  return NextResponse.json({
    address: lower,
    displayName: user?.displayName ?? null,
    avatarUrl: user?.avatarUrl ?? null,
    bio: user?.bio ?? null,
    twitter: user?.twitter ?? null,
    telegram: user?.telegram ?? null,
    website: user?.website ?? null,
    memberSince: user?.createdAt ?? null,
    badges,
    portfolio,
    creatorStats,
  });
}
