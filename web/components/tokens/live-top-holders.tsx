"use client";

import { useCallback, useEffect, useState } from "react";
import { TopHolders } from "./top-holders";

interface HolderRow {
  holderAddress: string;
  balance: string;
  percentBps: number;
}

const POLL_MS = 5000;

export function LiveTopHolders({
  tokenAddress,
  marketAddress,
  initial,
}: {
  tokenAddress: string;
  marketAddress: string;
  initial: HolderRow[];
}) {
  const [holders, setHolders] = useState(initial);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/tokens/${tokenAddress}/holders`, { cache: "no-store" });
      if (!res.ok) return;
      const { holders } = await res.json();
      setHolders(holders);
    } catch {
      // ignore transient fetch errors, keep showing last known state
    }
  }, [tokenAddress]);

  useEffect(() => {
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return <TopHolders holders={holders} marketAddress={marketAddress} />;
}
