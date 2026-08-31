"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCompactNative, formatTokenAmount, relativeTime, shortAddress } from "@/lib/format";
import type { TradeRow } from "@/lib/db/queries";

export function RecentTrades({ tokenAddress, initialTrades }: { tokenAddress: string; initialTrades: TradeRow[] }) {
  const [trades, setTrades] = useState(initialTrades);

  useEffect(() => {
    const source = new EventSource(`/api/tokens/${tokenAddress}/stream`);
    source.addEventListener("message", (event) => {
      const trade = JSON.parse(event.data) as TradeRow;
      setTrades((prev) => {
        if (prev.some((t) => t.id === trade.id)) return prev;
        return [trade, ...prev].slice(0, 50);
      });
    });
    return () => source.close();
  }, [tokenAddress]);

  if (trades.length === 0) {
    return <div className="p-4 text-center text-sm text-neutral-500">No trades yet. Be the first.</div>;
  }

  return (
    <div className="divide-y divide-neutral-900">
      {trades.map((trade) => (
        <div key={trade.id} className="flex items-center justify-between px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-1.5 py-0.5 font-bold ${
                trade.side === "buy" ? "bg-lime-400/15 text-lime-400" : "bg-red-400/15 text-red-400"
              }`}
            >
              {trade.side.toUpperCase()}
            </span>
            <Link href={`/profile/${trade.trader}`} className="text-neutral-400 hover:text-lime-400">
              {shortAddress(trade.trader)}
            </Link>
          </div>
          <span className="text-neutral-300">{formatTokenAmount(trade.tokenAmount)}</span>
          <span className="text-neutral-300">{formatCompactNative(trade.nativeAmount)}</span>
          <span className="text-neutral-600" suppressHydrationWarning>
            {relativeTime(trade.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}
