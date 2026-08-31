"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { relativeTime } from "@/lib/format";

interface AlertRow {
  id: number;
  tokenAddress: string;
  type: string;
  message: string;
  createdAt: number;
}

const ICON: Record<string, string> = {
  new_token: "🆕",
  first_buy: "🎯",
  large_buy: "🐳",
  large_sell: "📉",
  rapid_volume: "🔥",
  graduation: "🎓",
  liquidity_migrated: "💧",
};

export function AlertFeed({ initialAlerts }: { initialAlerts: AlertRow[] }) {
  const [alerts, setAlerts] = useState(initialAlerts);

  useEffect(() => {
    const source = new EventSource("/api/alerts/stream");
    source.addEventListener("message", (event) => {
      const alert = JSON.parse(event.data) as AlertRow;
      setAlerts((prev) => {
        if (prev.some((a) => a.id === alert.id)) return prev;
        return [alert, ...prev].slice(0, 100);
      });
    });
    return () => source.close();
  }, []);

  if (alerts.length === 0) {
    return <div className="p-8 text-center text-sm text-neutral-500">No alerts yet. Launch or trade a token to see activity here.</div>;
  }

  return (
    <div className="divide-y divide-neutral-900">
      {alerts.map((a) => (
        <Link
          key={a.id}
          href={`/dank/${a.tokenAddress}`}
          className="flex items-start gap-3 px-4 py-3 text-sm transition hover:bg-neutral-900/60"
        >
          <span className="text-lg">{ICON[a.type] ?? "🚨"}</span>
          <div className="flex-1">
            <p className="text-neutral-200">{a.message}</p>
            <p className="text-xs text-neutral-600" suppressHydrationWarning>
              {relativeTime(a.createdAt)}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
