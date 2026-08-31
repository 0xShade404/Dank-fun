"use client";

import { useState } from "react";
import { useConnection, useReadContract } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { BondingCurveMarketAbi, DankTokenAbi } from "@/lib/chain/abi";
import { estimateTokensForNative } from "@/lib/curve";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useTrade } from "@/hooks/use-trade";
import { useSession } from "@/components/wallet/session-context";
import { formatCompactNative, formatTokenAmount } from "@/lib/format";

const SLIPPAGE_PRESETS = [1, 2, 5];

interface Props {
  tokenAddress: `0x${string}`;
  marketAddress: `0x${string}`;
  symbol: string;
  sold: string;
  curveSupplyCap: string;
  basePrice: string;
  slope: string;
  graduated: boolean;
  onTraded?: () => void;
}

export function BuySellPanel({
  tokenAddress,
  marketAddress,
  symbol,
  sold,
  curveSupplyCap,
  basePrice,
  slope,
  graduated,
  onTraded,
}: Props) {
  const { isConnected, address } = useConnection();
  const { sessionAddress, signIn, isSigningIn } = useSession();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(200); // 2%
  const debouncedAmount = useDebouncedValue(amount, 350);
  const trade = useTrade(marketAddress, tokenAddress);

  const remainingSupply = BigInt(curveSupplyCap) - BigInt(sold);

  function parseAmount(): bigint {
    try {
      return debouncedAmount ? parseUnits(debouncedAmount, 18) : 0n;
    } catch {
      return 0n;
    }
  }

  const parsedNativeIn = parseAmount();
  const parsedTokenIn = parseAmount();

  const estimatedTokensForBuy =
    side === "buy" && parsedNativeIn > 0n
      ? estimateTokensForNative(
          { basePrice: BigInt(basePrice), slope: BigInt(slope) },
          BigInt(sold),
          parsedNativeIn,
          remainingSupply / 10n ** 18n
        )
      : 0n;

  const buyQuote = useReadContract({
    address: marketAddress,
    abi: BondingCurveMarketAbi,
    functionName: "quoteBuy",
    args: [estimatedTokensForBuy],
    query: { enabled: side === "buy" && estimatedTokensForBuy > 0n },
  });

  const sellQuote = useReadContract({
    address: marketAddress,
    abi: BondingCurveMarketAbi,
    functionName: "quoteSell",
    args: [parsedTokenIn],
    query: { enabled: side === "sell" && parsedTokenIn > 0n },
  });

  const allowance = useReadContract({
    address: tokenAddress,
    abi: DankTokenAbi,
    functionName: "allowance",
    args: address ? [address, marketAddress] : undefined,
    query: { enabled: side === "sell" && Boolean(address) },
  });

  const tokenBalance = useReadContract({
    address: tokenAddress,
    abi: DankTokenAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const busy = ["approving", "awaiting-signature", "confirming", "syncing"].includes(trade.step);
  const canTrade = isConnected && sessionAddress && !graduated;

  const buyTotalCost = (buyQuote.data as readonly [bigint, bigint, bigint] | undefined)?.[2];
  const sellNetPayout = (sellQuote.data as readonly [bigint, bigint, bigint] | undefined)?.[2];

  async function handleSubmit() {
    if (side === "buy") {
      if (!buyTotalCost || estimatedTokensForBuy <= 0n) return;
      const maxNativeIn = (buyTotalCost * BigInt(10_000 + slippageBps)) / 10_000n;
      await trade.buy(estimatedTokensForBuy, maxNativeIn);
    } else {
      if (!sellNetPayout || parsedTokenIn <= 0n) return;
      const minNativeOut = (sellNetPayout * BigInt(10_000 - slippageBps)) / 10_000n;
      await trade.sell(parsedTokenIn, minNativeOut, (allowance.data as bigint | undefined) ?? 0n);
    }
    setAmount("");
    trade.reset();
    buyQuote.refetch();
    sellQuote.refetch();
    tokenBalance.refetch();
    onTraded?.();
  }

  if (graduated) {
    return (
      <div className="rounded-2xl border border-lime-400/30 bg-lime-400/5 p-5 text-center text-sm text-lime-300">
        🎓 ${symbol} graduated the curve. It now trades via the migrated DEX liquidity, not this curve.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-full bg-neutral-950 p-1">
        <button
          onClick={() => setSide("buy")}
          className={`rounded-full py-2 text-sm font-bold transition ${side === "buy" ? "bg-lime-400 text-neutral-950" : "text-neutral-400"}`}
        >
          Buy
        </button>
        <button
          onClick={() => setSide("sell")}
          className={`rounded-full py-2 text-sm font-bold transition ${side === "sell" ? "bg-red-400 text-neutral-950" : "text-neutral-400"}`}
        >
          Sell
        </button>
      </div>

      <label className="text-xs text-neutral-500">{side === "buy" ? "Amount to spend (DRC)" : `Amount to sell (${symbol})`}</label>
      <div className="mt-1 flex items-center rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="0.0"
          inputMode="decimal"
          className="w-full bg-transparent text-lg font-semibold text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
        />
        {side === "sell" && (
          <button
            type="button"
            className="shrink-0 rounded-full bg-neutral-800 px-2 py-1 text-[10px] font-semibold text-neutral-300"
            onClick={() => setAmount(formatUnits((tokenBalance.data as bigint | undefined) ?? 0n, 18))}
          >
            MAX
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
        <span>{side === "buy" ? "Estimated tokens" : "Estimated payout"}</span>
        <span className="font-semibold text-neutral-300">
          {side === "buy"
            ? `${formatTokenAmount(estimatedTokensForBuy)} ${symbol}`
            : sellNetPayout !== undefined
              ? formatCompactNative(sellNetPayout)
              : "—"}
        </span>
      </div>
      {side === "buy" && buyTotalCost !== undefined && (
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>Total cost (incl. fee)</span>
          <span className="font-semibold text-neutral-300">{formatCompactNative(buyTotalCost)}</span>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
        <span>Slippage</span>
        {SLIPPAGE_PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setSlippageBps(p * 100)}
            className={`rounded-full px-2 py-1 ${slippageBps === p * 100 ? "bg-neutral-700 text-neutral-100" : "bg-neutral-900 text-neutral-500"}`}
          >
            {p}%
          </button>
        ))}
      </div>

      {trade.error && <div className="mt-3 rounded-lg border border-red-900 bg-red-950/50 p-2 text-xs text-red-300">{trade.error}</div>}

      {!isConnected && <div className="mt-4 text-center text-xs text-neutral-500">Connect your wallet to trade.</div>}
      {isConnected && !sessionAddress && (
        <button
          onClick={() => signIn()}
          disabled={isSigningIn}
          className="mt-4 w-full rounded-full bg-lime-400 py-3 text-sm font-bold text-neutral-950 disabled:opacity-50"
        >
          {isSigningIn ? "Check wallet…" : "Sign in to trade"}
        </button>
      )}
      {canTrade && (
        <button
          onClick={handleSubmit}
          disabled={busy || (side === "buy" ? estimatedTokensForBuy <= 0n : parsedTokenIn <= 0n)}
          className={`mt-4 w-full rounded-full py-3 text-sm font-bold text-neutral-950 transition disabled:opacity-50 ${
            side === "buy" ? "bg-lime-400 hover:bg-lime-300" : "bg-red-400 hover:bg-red-300"
          }`}
        >
          {busy ? STEP_LABEL[trade.step] : side === "buy" ? `Buy $${symbol}` : `Sell $${symbol}`}
        </button>
      )}
    </div>
  );
}

const STEP_LABEL: Record<string, string> = {
  approving: "Approving tokens…",
  "awaiting-signature": "Confirm in wallet…",
  confirming: "Confirming on-chain…",
  syncing: "Updating…",
};
