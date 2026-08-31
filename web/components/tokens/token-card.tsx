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
  const progress = Math.min(100, token.progressBps / 100);
  return (
    <Link href={`/dank/${token.address}`} className="credit-card group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card transition duration-200 hover:-translate-y-0.5 hover:border-primary/60">
      <div className="relative aspect-square w-full overflow-hidden bg-secondary">
        {token.imageUrl ? <Image src={token.imageUrl} alt={`${token.name} token artwork`} fill className="object-cover transition duration-500 group-hover:scale-105" unoptimized /> : <div className="flex h-full w-full items-center justify-center bg-secondary px-3 text-center text-2xl font-black text-muted-foreground/50">${token.symbol.slice(0, 4)}</div>}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/80 to-transparent" />
        {token.graduated && <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-1 text-[10px] font-bold tracking-wide text-primary-foreground">GRADUATED</span>}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0"><p className="truncate font-bold text-foreground">${token.symbol}</p><p className="truncate text-xs text-muted-foreground">{token.name}</p></div>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{shortAddress(token.creatorAddress)}</span>
        </div>
        <div className="mt-auto grid grid-cols-2 gap-2 text-xs"><div><p className="text-muted-foreground">Market cap</p><p className="font-semibold text-foreground">{formatCompactNative(token.marketCap)}</p></div><div className="text-right"><p className="text-muted-foreground">24h volume</p><p className="font-semibold text-foreground">{formatCompactNative(token.volume24h)}</p></div></div>
        {!token.graduated && <div><div className="curve-progress-track h-1.5 w-full overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div><p className="mt-1 text-right text-[10px] text-muted-foreground">{bpsToPercent(token.progressBps, 1)} to graduation</p></div>}
      </div>
    </Link>
  );
}
