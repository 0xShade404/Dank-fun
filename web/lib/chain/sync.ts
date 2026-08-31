import { decodeEventLog, formatUnits, type Log } from "viem";
import { db } from "@/lib/db/client";
import { tokens, trades, holders, liquidityEvents, curveSnapshots, tokenDrafts, alerts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { publicClient } from "./client";
import { FACTORY_ADDRESS } from "./config";
import { DankFactoryAbi, BondingCurveMarketAbi } from "./abi";
import { tokenMarketCapNative } from "@/lib/db/queries";

const LARGE_TRADE_NATIVE_WEI = 1_000_000_000_000_000_000n; // 1 native unit
const RAPID_VOLUME_WINDOW_SECONDS = 60;
const RAPID_VOLUME_TRADE_THRESHOLD = 5;
const RAPID_VOLUME_ALERT_COOLDOWN_SECONDS = 300;

function draftIdFromMetadataUri(metadataUri: string): string | null {
  const match = metadataUri.match(/\/api\/metadata\/([a-zA-Z0-9-]+)/);
  return match ? match[1] : null;
}

async function insertAlert(tokenAddress: string, type: (typeof alerts.$inferInsert)["type"], message: string, payload?: unknown) {
  await db.insert(alerts).values({
    tokenAddress,
    type,
    message,
    payload: payload ? JSON.stringify(payload) : null,
    createdAt: Math.floor(Date.now() / 1000),
  });
}

async function handleTokenCreated(args: {
  token: string;
  market: string;
  creator: string;
  name: string;
  symbol: string;
  metadataURI: string;
  blockNumber: bigint;
  txHash: string;
}) {
  const tokenAddress = args.token.toLowerCase();
  const existing = await db.select().from(tokens).where(eq(tokens.address, tokenAddress)).limit(1);
  if (existing.length > 0) return; // already indexed

  const [basePrice, slope, curveSupplyCap, graduationReserve, protocolFeeBps] = await Promise.all([
    publicClient.readContract({ address: args.market as `0x${string}`, abi: BondingCurveMarketAbi, functionName: "basePrice" }),
    publicClient.readContract({ address: args.market as `0x${string}`, abi: BondingCurveMarketAbi, functionName: "slope" }),
    publicClient.readContract({ address: args.market as `0x${string}`, abi: BondingCurveMarketAbi, functionName: "curveSupplyCap" }),
    publicClient.readContract({ address: args.market as `0x${string}`, abi: BondingCurveMarketAbi, functionName: "graduationReserve" }),
    publicClient.readContract({ address: args.market as `0x${string}`, abi: BondingCurveMarketAbi, functionName: "protocolFeeBps" }),
  ]) as [bigint, bigint, bigint, bigint, bigint];

  const block = await publicClient.getBlock({ blockNumber: args.blockNumber });

  let draft: typeof tokenDrafts.$inferSelect | undefined;
  const draftId = draftIdFromMetadataUri(args.metadataURI);
  if (draftId) {
    const [row] = await db.select().from(tokenDrafts).where(eq(tokenDrafts.id, draftId)).limit(1);
    draft = row;
    if (row) {
      await db.update(tokenDrafts).set({ consumedAt: Math.floor(Date.now() / 1000) }).where(eq(tokenDrafts.id, draftId));
    }
  }

  await db.insert(tokens).values({
    address: tokenAddress,
    marketAddress: args.market.toLowerCase(),
    creatorAddress: args.creator.toLowerCase(),
    name: args.name,
    symbol: args.symbol,
    imageUrl: draft?.imageUrl ?? null,
    description: draft?.description ?? null,
    twitter: draft?.twitter ?? null,
    telegram: draft?.telegram ?? null,
    website: draft?.website ?? null,
    metadataUri: args.metadataURI,
    basePrice: basePrice.toString(),
    slope: slope.toString(),
    curveSupplyCap: curveSupplyCap.toString(),
    graduationReserve: graduationReserve.toString(),
    protocolFeeBps: Number(protocolFeeBps),
    sold: "0",
    reserveBalance: "0",
    graduated: false,
    createdAt: Number(block.timestamp),
    createdTxHash: args.txHash,
    createdBlock: Number(args.blockNumber),
  });

  await insertAlert(tokenAddress, "new_token", `${args.symbol} just launched on the curve.`, {
    name: args.name,
    symbol: args.symbol,
    creator: args.creator,
  });
}

async function handleTradeExecuted(args: {
  marketAddress: string;
  trader: string;
  isBuy: boolean;
  tokenAmount: bigint;
  nativeAmount: bigint;
  fee: bigint;
  newSold: bigint;
  newSpotPrice: bigint;
  blockNumber: bigint;
  txHash: string;
  logIndex: number;
}) {
  const [token] = await db.select().from(tokens).where(eq(tokens.marketAddress, args.marketAddress.toLowerCase())).limit(1);
  if (!token) return;

  const already = await db
    .select()
    .from(trades)
    .where(and(eq(trades.txHash, args.txHash), eq(trades.logIndex, args.logIndex)))
    .limit(1);
  if (already.length > 0) return;

  const block = await publicClient.getBlock({ blockNumber: args.blockNumber });
  const timestamp = Number(block.timestamp);
  const trader = args.trader.toLowerCase();

  const priorTradeCount = (await db.select().from(trades).where(eq(trades.tokenAddress, token.address))).length;

  await db.insert(trades).values({
    tokenAddress: token.address,
    txHash: args.txHash,
    logIndex: args.logIndex,
    trader,
    side: args.isBuy ? "buy" : "sell",
    tokenAmount: args.tokenAmount.toString(),
    nativeAmount: args.nativeAmount.toString(),
    fee: args.fee.toString(),
    soldAfter: args.newSold.toString(),
    spotPriceAfter: args.newSpotPrice.toString(),
    blockNumber: Number(args.blockNumber),
    timestamp,
  });

  await db
    .update(tokens)
    .set({
      sold: args.newSold.toString(),
      reserveBalance: args.isBuy
        ? (BigInt(token.reserveBalance) + args.nativeAmount).toString()
        : (BigInt(token.reserveBalance) - args.nativeAmount).toString(),
    })
    .where(eq(tokens.address, token.address));

  const [existingHolder] = await db
    .select()
    .from(holders)
    .where(and(eq(holders.tokenAddress, token.address), eq(holders.holderAddress, trader)))
    .limit(1);
  const currentBalance = existingHolder ? BigInt(existingHolder.balance) : 0n;
  const newBalance = args.isBuy ? currentBalance + args.tokenAmount : currentBalance - args.tokenAmount;
  if (existingHolder) {
    await db
      .update(holders)
      .set({ balance: newBalance.toString(), updatedAt: timestamp })
      .where(and(eq(holders.tokenAddress, token.address), eq(holders.holderAddress, trader)));
  } else {
    await db.insert(holders).values({ tokenAddress: token.address, holderAddress: trader, balance: newBalance.toString(), updatedAt: timestamp });
  }

  const updatedToken = { ...token, sold: args.newSold.toString() };
  await db.insert(curveSnapshots).values({
    tokenAddress: token.address,
    timestamp,
    sold: args.newSold.toString(),
    spotPrice: args.newSpotPrice.toString(),
    nativeRaised: args.isBuy
      ? (BigInt(token.reserveBalance) + args.nativeAmount).toString()
      : (BigInt(token.reserveBalance) - args.nativeAmount).toString(),
    marketCapNative: Number(formatUnits(tokenMarketCapNative(updatedToken), 18)),
  });

  await maybeAlertForTrade(token.address, token.symbol, args, priorTradeCount, timestamp);
}

async function maybeAlertForTrade(
  tokenAddress: string,
  symbol: string,
  args: { isBuy: boolean; nativeAmount: bigint; trader: string },
  priorTradeCount: number,
  timestamp: number
) {
  if (priorTradeCount === 0 && args.isBuy) {
    await insertAlert(tokenAddress, "first_buy", `First buy on $${symbol} by ${short(args.trader)}.`, {
      trader: args.trader,
    });
  }

  if (args.nativeAmount >= LARGE_TRADE_NATIVE_WEI) {
    await insertAlert(
      tokenAddress,
      args.isBuy ? "large_buy" : "large_sell",
      `${args.isBuy ? "Large buy" : "Large sell"} on $${symbol}: ${formatUnits(args.nativeAmount, 18)} native.`,
      { trader: args.trader, nativeAmount: args.nativeAmount.toString() }
    );
  }

  const recentWindowStart = timestamp - RAPID_VOLUME_WINDOW_SECONDS;
  const recentTrades = await db.select().from(trades).where(eq(trades.tokenAddress, tokenAddress));
  const recentCount = recentTrades.filter((t) => t.timestamp >= recentWindowStart).length;

  if (recentCount >= RAPID_VOLUME_TRADE_THRESHOLD) {
    const recentAlerts = await db.select().from(alerts).where(and(eq(alerts.tokenAddress, tokenAddress), eq(alerts.type, "rapid_volume")));
    const alreadyAlertedRecently = recentAlerts.some((a) => a.createdAt >= timestamp - RAPID_VOLUME_ALERT_COOLDOWN_SECONDS);
    if (!alreadyAlertedRecently) {
      await insertAlert(tokenAddress, "rapid_volume", `$${symbol} is heating up: ${recentCount} trades in the last minute.`, {
        tradeCount: recentCount,
      });
    }
  }
}

async function handleTokenGraduated(args: {
  marketAddress: string;
  tokenAddress: string;
  nativeToLiquidity: bigint;
  tokensToLiquidity: bigint;
  blockNumber: bigint;
  txHash: string;
}) {
  const [token] = await db.select().from(tokens).where(eq(tokens.address, args.tokenAddress.toLowerCase())).limit(1);
  if (!token || token.graduated) return;

  const block = await publicClient.getBlock({ blockNumber: args.blockNumber });
  const timestamp = Number(block.timestamp);

  await db
    .update(tokens)
    .set({ graduated: true, graduatedAt: timestamp, reserveBalance: "0" })
    .where(eq(tokens.address, token.address));

  await db.insert(liquidityEvents).values({
    tokenAddress: token.address,
    txHash: args.txHash,
    nativeAmount: args.nativeToLiquidity.toString(),
    tokenAmount: args.tokensToLiquidity.toString(),
    timestamp,
  });

  await insertAlert(token.address, "graduation", `$${token.symbol} graduated the curve!`, {
    nativeToLiquidity: args.nativeToLiquidity.toString(),
  });
  await insertAlert(token.address, "liquidity_migrated", `$${token.symbol} liquidity migrated to the DEX escrow.`, {
    tokensToLiquidity: args.tokensToLiquidity.toString(),
  });
}

function short(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Decodes and indexes every relevant log in a transaction receipt. Idempotent. */
export async function syncTransaction(txHash: `0x${string}`) {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

  for (const log of receipt.logs as Log[]) {
    if (log.address.toLowerCase() === FACTORY_ADDRESS.toLowerCase()) {
      const decoded = tryDecode(DankFactoryAbi, log);
      if (decoded?.eventName === "TokenCreated") {
        const a = decoded.args as { token: string; market: string; creator: string; name: string; symbol: string; metadataURI: string };
        await handleTokenCreated({ ...a, blockNumber: log.blockNumber!, txHash });
      }
      continue;
    }

    const decoded = tryDecode(BondingCurveMarketAbi, log);
    if (!decoded) continue;

    if (decoded.eventName === "TradeExecuted") {
      const a = decoded.args as {
        trader: string;
        isBuy: boolean;
        tokenAmount: bigint;
        nativeAmount: bigint;
        fee: bigint;
        newSold: bigint;
        newSpotPrice: bigint;
      };
      await handleTradeExecuted({
        marketAddress: log.address,
        ...a,
        blockNumber: log.blockNumber!,
        txHash,
        logIndex: log.logIndex!,
      });
    } else if (decoded.eventName === "TokenGraduated") {
      const a = decoded.args as { token: string; nativeToLiquidity: bigint; tokensToLiquidity: bigint };
      await handleTokenGraduated({ marketAddress: log.address, tokenAddress: a.token, ...a, blockNumber: log.blockNumber!, txHash });
    }
  }

  return { blockNumber: receipt.blockNumber.toString(), logCount: receipt.logs.length };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tryDecode(abi: any, log: Log): { eventName: string; args: Record<string, unknown> } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return decodeEventLog({ abi, data: log.data, topics: log.topics }) as any;
  } catch {
    return null;
  }
}
