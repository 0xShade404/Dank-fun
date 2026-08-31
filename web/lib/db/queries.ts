import { db } from "./client";
import { tokens, trades, holders, alerts, liquidityEvents, curveSnapshots } from "./schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { spotPrice, curveProgressBps } from "@/lib/curve";

/**
 * NOTE on numeric columns: token/native amounts are 18-decimal bigints stored as TEXT (values up
 * to ~1e27), which comfortably exceed SQLite's 64-bit INTEGER range. `CAST(x AS INTEGER)` on a
 * value that large clamps to INT64_MAX rather than erroring, which would silently break any
 * ORDER BY / SUM built on it. So every numeric comparison, sum, or sort on these columns happens
 * in JS with BigInt below instead of in SQL -- the query layer only uses SQL for equality/range
 * filters on plain integer columns (timestamps, block numbers) and text filters.
 */

export type TokenRow = typeof tokens.$inferSelect;
export type TradeRow = typeof trades.$inferSelect;

export function tokenSpotPriceNative(token: TokenRow): bigint {
  return spotPrice({ basePrice: BigInt(token.basePrice), slope: BigInt(token.slope) }, BigInt(token.sold));
}

export function tokenMarketCapNative(token: TokenRow): bigint {
  const totalSupply = BigInt(token.curveSupplyCap) + BigInt(token.graduationReserve);
  const price = tokenSpotPriceNative(token);
  // price is native-wei per whole token; totalSupply is 18-decimal -> convert to whole tokens.
  return (price * totalSupply) / 10n ** 18n;
}

export function tokenProgressBps(token: TokenRow): number {
  return curveProgressBps(BigInt(token.sold), BigInt(token.curveSupplyCap));
}

function decorateToken(token: TokenRow, volume24h: bigint, trades24h: number) {
  return {
    ...token,
    volume24h: volume24h.toString(),
    trades24h,
    spotPrice: tokenSpotPriceNative(token).toString(),
    marketCap: tokenMarketCapNative(token).toString(),
    progressBps: tokenProgressBps(token),
  };
}

export async function getTokenByAddress(address: string): Promise<TokenRow | undefined> {
  const [row] = await db
    .select()
    .from(tokens)
    .where(eq(tokens.address, address.toLowerCase()))
    .limit(1);
  return row;
}

async function volumeByToken(sinceSeconds: number): Promise<Map<string, { volume: bigint; count: number }>> {
  const rows = await db
    .select({ tokenAddress: trades.tokenAddress, nativeAmount: trades.nativeAmount })
    .from(trades)
    .where(gte(trades.timestamp, sinceSeconds));

  const map = new Map<string, { volume: bigint; count: number }>();
  for (const row of rows) {
    const entry = map.get(row.tokenAddress) ?? { volume: 0n, count: 0 };
    entry.volume += BigInt(row.nativeAmount);
    entry.count += 1;
    map.set(row.tokenAddress, entry);
  }
  return map;
}

export type TokenSort =
  | "trending"
  | "new"
  | "near_graduation"
  | "graduated"
  | "volume"
  | "gainers"
  | "losers"
  | "market_cap";

interface ListTokensOptions {
  sort?: TokenSort;
  limit?: number;
  offset?: number;
  creator?: string;
}

export async function listTokens(options: ListTokensOptions = {}) {
  const { sort = "trending", limit = 40, offset = 0, creator } = options;
  const dayAgo = Math.floor(Date.now() / 1000) - 86_400;

  const [rows, volMap] = await Promise.all([
    creator
      ? db.select().from(tokens).where(eq(tokens.creatorAddress, creator.toLowerCase()))
      : db.select().from(tokens),
    volumeByToken(dayAgo),
  ]);

  let decorated = rows.map((token) => {
    const vol = volMap.get(token.address) ?? { volume: 0n, count: 0 };
    return decorateToken(token, vol.volume, vol.count);
  });

  switch (sort) {
    case "new":
      decorated.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case "near_graduation":
      decorated = decorated.filter((t) => !t.graduated);
      decorated.sort((a, b) => (BigInt(b.sold) > BigInt(a.sold) ? 1 : -1));
      break;
    case "graduated":
      decorated = decorated.filter((t) => t.graduated);
      decorated.sort((a, b) => (b.graduatedAt ?? 0) - (a.graduatedAt ?? 0));
      break;
    case "volume":
      decorated.sort((a, b) => (BigInt(b.volume24h) > BigInt(a.volume24h) ? 1 : -1));
      break;
    case "market_cap":
      decorated.sort((a, b) => (BigInt(b.marketCap) > BigInt(a.marketCap) ? 1 : -1));
      break;
    case "trending":
    default:
      decorated.sort((a, b) => b.trades24h - a.trades24h || b.createdAt - a.createdAt);
      break;
  }

  return decorated.slice(offset, offset + limit);
}

export async function searchTokens(query: string, limit = 20) {
  const like = `%${query.toLowerCase()}%`;
  const rows = await db
    .select()
    .from(tokens)
    .where(sql`lower(${tokens.name}) like ${like} or lower(${tokens.symbol}) like ${like}`)
    .limit(200);
  return rows.map((token) => decorateToken(token, 0n, 0)).slice(0, limit);
}

export async function getTrades(tokenAddress: string, limit = 50) {
  return db
    .select()
    .from(trades)
    .where(eq(trades.tokenAddress, tokenAddress.toLowerCase()))
    .orderBy(desc(trades.timestamp))
    .limit(limit);
}

export async function getHolders(tokenAddress: string, limit = 50) {
  const rows = await db.select().from(holders).where(eq(holders.tokenAddress, tokenAddress.toLowerCase()));
  return rows
    .filter((h) => BigInt(h.balance) > 0n)
    .sort((a, b) => (BigInt(b.balance) > BigInt(a.balance) ? 1 : -1))
    .slice(0, limit);
}

export async function getLiquidityEvents(tokenAddress: string) {
  return db.select().from(liquidityEvents).where(eq(liquidityEvents.tokenAddress, tokenAddress.toLowerCase()));
}

export async function getRecentAlerts(limit = 30) {
  return db.select().from(alerts).orderBy(desc(alerts.createdAt)).limit(limit);
}

export async function getTokenAlerts(tokenAddress: string, limit = 30) {
  return db
    .select()
    .from(alerts)
    .where(eq(alerts.tokenAddress, tokenAddress.toLowerCase()))
    .orderBy(desc(alerts.createdAt))
    .limit(limit);
}

export type LeaderboardCategory =
  | "volume_24h"
  | "market_cap"
  | "price_change_24h"
  | "creator_volume"
  | "most_traded"
  | "recently_graduated";

export async function getLeaderboard(category: LeaderboardCategory, limit = 20) {
  const dayAgo = Math.floor(Date.now() / 1000) - 86_400;

  if (category === "creator_volume") {
    const [allTokens, volMap] = await Promise.all([db.select().from(tokens), volumeByToken(dayAgo)]);
    const byCreator = new Map<string, { volume: bigint; tokenCount: number }>();
    for (const token of allTokens) {
      const vol = volMap.get(token.address)?.volume ?? 0n;
      const entry = byCreator.get(token.creatorAddress) ?? { volume: 0n, tokenCount: 0 };
      entry.volume += vol;
      entry.tokenCount += 1;
      byCreator.set(token.creatorAddress, entry);
    }
    return [...byCreator.entries()]
      .map(([creator, v]) => ({ creator, volume24h: v.volume.toString(), tokenCount: v.tokenCount }))
      .sort((a, b) => (BigInt(b.volume24h) > BigInt(a.volume24h) ? 1 : -1))
      .slice(0, limit);
  }

  if (category === "recently_graduated") return listTokens({ sort: "graduated", limit });
  if (category === "most_traded") return listTokens({ sort: "trending", limit });
  if (category === "volume_24h") return listTokens({ sort: "volume", limit });
  if (category === "market_cap") return listTokens({ sort: "market_cap", limit });

  // price_change_24h: compare current spot price to the most recent snapshot at/before the
  // 24h cutoff (falling back to the token's base price if it hasn't been trading that long).
  const all = await listTokens({ sort: "new", limit: 500 });
  const withChange = await Promise.all(
    all.map(async (t) => {
      const [snap] = await db
        .select()
        .from(curveSnapshots)
        .where(and(eq(curveSnapshots.tokenAddress, t.address), sql`${curveSnapshots.timestamp} <= ${dayAgo}`))
        .orderBy(desc(curveSnapshots.timestamp))
        .limit(1);
      const priorPrice = snap ? BigInt(snap.spotPrice) : BigInt(t.basePrice);
      const currentPrice = BigInt(t.spotPrice);
      const changeBps = priorPrice === 0n ? 0 : Number(((currentPrice - priorPrice) * 10_000n) / priorPrice);
      return { ...t, changeBps };
    })
  );
  return withChange.sort((a, b) => b.changeBps - a.changeBps).slice(0, limit);
}
