import Link from "next/link";
import Image from "next/image";
import { formatCompactNative, formatSignedCompactNative, formatTokenAmount } from "@/lib/format";
import type { PortfolioPosition } from "@/lib/db/profile";

export function PortfolioTable({ positions }: { positions: PortfolioPosition[] }) {
  if (positions.length === 0) {
    return <div className="p-6 text-center text-sm text-neutral-500">No open positions yet.</div>;
  }

  return (
    <div className="divide-y divide-neutral-900">
      {positions.map((p) => {
        const pnl = BigInt(p.unrealizedPnlNative);
        return (
          <Link
            key={p.tokenAddress}
            href={`/dank/${p.tokenAddress}`}
            className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-neutral-900/60"
          >
            <div className="flex items-center gap-3">
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-neutral-800">
                {p.imageUrl && <Image src={p.imageUrl} alt={p.symbol} fill className="object-cover" unoptimized />}
              </div>
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-neutral-100">
                  ${p.symbol}
                  {p.graduated && <span className="rounded bg-lime-400/15 px-1.5 py-0.5 text-[10px] font-bold text-lime-400">GRAD</span>}
                </div>
                <div className="text-xs text-neutral-500">{formatTokenAmount(p.balance)} tokens</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold text-neutral-200">{formatCompactNative(p.currentValueNative)}</div>
              <div className={`text-xs font-medium ${pnl >= 0n ? "text-lime-400" : "text-red-400"}`}>
                {formatSignedCompactNative(p.unrealizedPnlNative)}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
