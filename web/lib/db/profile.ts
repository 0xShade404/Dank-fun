import { db } from "./client";
import { trades, tokens, users } from "./schema";
import { eq, asc } from "drizzle-orm";
import { tokenSpotPriceNative, listTokens } from "./queries";

/**
 * Portfolio + PnL are derived entirely from the trades this wallet has made through
 * BondingCurveMarket (the only venue this MVP indexes) using the average-cost-basis method:
 * every buy adds to a running (tokens held, total native spent) pair; every sell realizes PnL
 * against the current average cost and shrinks the position proportionally. This mirrors what
 * `holders.balance` already tracks incrementally in lib/chain/sync.ts, so a wallet's computed
 * `held` here should always agree with its holders row for the same token.
 */

export interface PortfolioPosition {
  tokenAddress: string;
  symbol: string;
  name: string;
  imageUrl: string | null;
  graduated: boolean;
  balance: string; // 18-decimal token amount, string bigint
  costBasisNative: string; // remaining cost basis for the current balance, wei string
  currentValueNative: string; // balance priced at current spot, wei string
  unrealizedPnlNative: string; // currentValue - costBasis, wei string (can be negative)
}

export interface PortfolioSummary {
  positions: PortfolioPosition[];
  totalCurrentValueNative: string;
  totalCostBasisNative: string;
  totalUnrealizedPnlNative: string;
  totalRealizedPnlNative: string;
  tradeCount: number;
}

export async function getPortfolio(address: string): Promise<PortfolioSummary> {
  const lower = address.toLowerCase();
  const rows = await db
    .select()
    .from(trades)
    .where(eq(trades.trader, lower))
    .orderBy(asc(trades.blockNumber), asc(trades.id));

  const perToken = new Map<string, { held: bigint; costBasis: bigint; realized: bigint }>();

  for (const trade of rows) {
    const state = perToken.get(trade.tokenAddress) ?? { held: 0n, costBasis: 0n, realized: 0n };
    const amount = BigInt(trade.tokenAmount);
    const native = BigInt(trade.nativeAmount);
    const fee = BigInt(trade.fee);

    if (trade.side === "buy") {
      state.held += amount;
      state.costBasis += native + fee; // what the buyer actually paid, fee included
    } else if (state.held > 0n) {
      const sellAmount = amount > state.held ? state.held : amount; // defensive clamp
      const costOfSold = (state.costBasis * sellAmount) / state.held;
      const netPayout = native - fee; // what the seller actually received
      state.realized += netPayout - costOfSold;
      state.costBasis -= costOfSold;
      state.held -= sellAmount;
    }

    perToken.set(trade.tokenAddress, state);
  }

  const positions: PortfolioPosition[] = [];
  let totalCurrentValue = 0n;
  let totalCostBasis = 0n;
  let totalRealized = 0n;

  for (const [tokenAddress, state] of perToken) {
    totalRealized += state.realized;
    if (state.held <= 0n) continue;

    const [token] = await db.select().from(tokens).where(eq(tokens.address, tokenAddress)).limit(1);
    if (!token) continue;

    const price = tokenSpotPriceNative(token);
    const currentValue = (price * state.held) / 10n ** 18n;
    totalCurrentValue += currentValue;
    totalCostBasis += state.costBasis;

    positions.push({
      tokenAddress,
      symbol: token.symbol,
      name: token.name,
      imageUrl: token.imageUrl,
      graduated: token.graduated,
      balance: state.held.toString(),
      costBasisNative: state.costBasis.toString(),
      currentValueNative: currentValue.toString(),
      unrealizedPnlNative: (currentValue - state.costBasis).toString(),
    });
  }

  positions.sort((a, b) => (BigInt(b.currentValueNative) > BigInt(a.currentValueNative) ? 1 : -1));

  return {
    positions,
    totalCurrentValueNative: totalCurrentValue.toString(),
    totalCostBasisNative: totalCostBasis.toString(),
    totalUnrealizedPnlNative: (totalCurrentValue - totalCostBasis).toString(),
    totalRealizedPnlNative: totalRealized.toString(),
    tradeCount: rows.length,
  };
}

export interface CreatorStats {
  tokenCount: number;
  graduatedCount: number;
  totalMarketCapNative: string;
  totalVolume24hNative: string;
  tokens: Awaited<ReturnType<typeof listTokens>>;
}

export async function getCreatorStats(address: string): Promise<CreatorStats> {
  const created = await listTokens({ sort: "new", creator: address, limit: 500 });
  const totalMarketCap = created.reduce((sum, t) => sum + BigInt(t.marketCap), 0n);
  const totalVolume = created.reduce((sum, t) => sum + BigInt(t.volume24h), 0n);
  return {
    tokenCount: created.length,
    graduatedCount: created.filter((t) => t.graduated).length,
    totalMarketCapNative: totalMarketCap.toString(),
    totalVolume24hNative: totalVolume.toString(),
    tokens: created,
  };
}

export type UserRow = typeof users.$inferSelect;

export async function getUserByAddress(address: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(users).where(eq(users.address, address.toLowerCase())).limit(1);
  return row;
}
