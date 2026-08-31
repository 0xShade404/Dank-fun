import Link from "next/link";
import { bpsToPercent, formatTokenAmount, shortAddress } from "@/lib/format";

interface HolderRow {
  holderAddress: string;
  balance: string;
  percentBps: number;
}

export function TopHolders({ holders, marketAddress }: { holders: HolderRow[]; marketAddress: string }) {
  if (holders.length === 0) {
    return <div className="p-4 text-center text-sm text-neutral-500">No holders yet.</div>;
  }

  return (
    <div className="divide-y divide-neutral-900">
      {holders.map((h, i) => {
        const isMarket = h.holderAddress.toLowerCase() === marketAddress.toLowerCase();
        return (
        <div key={h.holderAddress} className="flex items-center justify-between px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-4 text-neutral-600">#{i + 1}</span>
            {isMarket ? (
              <span className="text-neutral-300">{shortAddress(h.holderAddress)}</span>
            ) : (
              <Link href={`/profile/${h.holderAddress}`} className="text-neutral-300 hover:text-lime-400">
                {shortAddress(h.holderAddress)}
              </Link>
            )}
            {isMarket && <span className="rounded bg-neutral-800 px-1 text-[10px] text-neutral-500">curve</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-neutral-300">{formatTokenAmount(h.balance)}</span>
            <span className="w-12 text-right text-neutral-500">{bpsToPercent(h.percentBps)}</span>
          </div>
        </div>
        );
      })}
    </div>
  );
}
