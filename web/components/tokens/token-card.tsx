import Link from "next/link";
import Image from "next/image";
import { bpsToPercent, formatCompactNative, shortAddress } from "@/lib/format";

export interface TokenCardData {
  address: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
  creatorAddress: string;
  marketCap: string;
  volume24h: string;
  progressBps: number;
  graduated: boolean;
  createdAt: number;
}

export function TokenCard({ token }: { token: TokenCardData }) {
  return (
    <Link
      href={`/dank/${token.address}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60 transition hover:border-lime-400/50 hover:bg-neutral-900"
    >
      <div className="relative aspect-square w-full bg-neutral-800">
        {token.imageUrl ? (
          <Image src={token.imageUrl} alt={token.symbol} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl font-black text-neutral-600">
            ${token.symbol.slice(0, 4)}
          </div>
        )}
        {token.graduated && (
          <span className="absolute right-2 top-2 rounded-full bg-lime-400 px-2 py-0.5 text-[10px] font-bold text-neutral-950">
            GRADUATED
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-bold text-neutral-50">${token.symbol}</span>
          <span className="shrink-0 text-[11px] text-neutral-500">{shortAddress(token.creatorAddress)}</span>
        </div>
        <p className="truncate text-xs text-neutral-400">{token.name}</p>

        <div className="mt-auto flex items-center justify-between text-xs">
          <div>
            <div className="text-neutral-500">Market Cap</div>
            <div className="font-semibold text-neutral-200">{formatCompactNative(token.marketCap)}</div>
          </div>
          <div className="text-right">
            <div className="text-neutral-500">24h Vol</div>
            <div className="font-semibold text-neutral-200">{formatCompactNative(token.volume24h)}</div>
          </div>
        </div>

        {!token.graduated && (
          <div>
            <div className="curve-progress-track h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full rounded-full bg-lime-400 transition-all"
                style={{ width: `${Math.min(100, token.progressBps / 100)}%` }}
              />
            </div>
            <div className="mt-1 text-right text-[10px] text-neutral-500">
              {bpsToPercent(token.progressBps, 1)} to graduation
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
