"use client";

import { useCallback, useEffect, useState } from "react";
import { BuySellPanel } from "./buy-sell-panel";
import { bpsToPercent, formatCompactNative } from "@/lib/format";

export interface LiveTokenState {
  sold: string;
  reserveBalance: string;
  curveSupplyCap: string;
  graduationReserve: string;
  basePrice: string;
  slope: string;
  spotPrice: string;
  marketCap: string;
  progressBps: number;
  graduated: boolean;
  migratedLiquidityNative: string;
}

interface Props {
  tokenAddress: `0x${string}`;
  marketAddress: `0x${string}`;
  symbol: string;
  initial: LiveTokenState;
}

const POLL_MS = 5000;

export function TokenTradingSection({ tokenAddress, marketAddress, symbol, initial }: Props) {
  const [state, setState] = useState(initial);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/tokens/${tokenAddress}`, { cache: "no-store" });
      if (!res.ok) return;
      const { token, liquidity } = await res.json();
      setState({
        ...token,
        migratedLiquidityNative: liquidity?.[0]?.nativeAmount ?? "0",
      });
    } catch {
      // ignore transient fetch errors, keep showing last known state
    }
  }, [tokenAddress]);

  useEffect(() => {
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm sm:grid-cols-4">
        <Stat label="Market Cap" value={formatCompactNative(state.marketCap)} />
        <Stat
          label={state.graduated ? "Liquidity (migrated)" : "Curve Reserve"}
          value={formatCompactNative(state.graduated ? state.migratedLiquidityNative : state.reserveBalance)}
        />
        <Stat label="Spot Price" value={`${formatCompactNative(state.spotPrice)}/tok`} />
        <Stat label="Status" value={state.graduated ? "Graduated 🎓" : `${bpsToPercent(state.progressBps)} filled`} />
      </div>

      {!state.graduated && (
        <div>
          <div className="curve-progress-track h-2.5 w-full overflow-hidden rounded-full bg-neutral-900">
            <div
              className="h-full rounded-full bg-gradient-to-r from-lime-500 to-lime-300 transition-all"
              style={{ width: `${Math.min(100, state.progressBps / 100)}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-neutral-500">
            <span>Bonding curve progress</span>
            <span>{bpsToPercent(state.progressBps)}</span>
          </div>
        </div>
      )}

      <BuySellPanel
        tokenAddress={tokenAddress}
        marketAddress={marketAddress}
        symbol={symbol}
        sold={state.sold}
        curveSupplyCap={state.curveSupplyCap}
        basePrice={state.basePrice}
        slope={state.slope}
        graduated={state.graduated}
        onTraded={refresh}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="font-semibold text-neutral-100">{value}</div>
    </div>
  );
}
