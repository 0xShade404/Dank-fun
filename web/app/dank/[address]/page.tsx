import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getTokenByAddress,
  getTrades,
  getHolders,
  getTokenAlerts,
  getLiquidityEvents,
  tokenSpotPriceNative,
  tokenMarketCapNative,
  tokenProgressBps,
} from "@/lib/db/queries";
import { TokenTradingSection } from "@/components/trading/token-trading-section";
import { RecentTrades } from "@/components/trading/recent-trades";
import { LiveTopHolders } from "@/components/tokens/live-top-holders";
import { ShareButton } from "@/components/tokens/share-button";
import { formatCompactNative, relativeTime, shortAddress } from "@/lib/format";

export default async function TokenPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const token = await getTokenByAddress(address);
  if (!token) notFound();

  const [trades, holdersRaw, tokenAlerts, liquidity] = await Promise.all([
    getTrades(token.address, 50),
    getHolders(token.address, 50),
    getTokenAlerts(token.address, 10),
    getLiquidityEvents(token.address),
  ]);

  const totalSupply = BigInt(token.curveSupplyCap) + BigInt(token.graduationReserve);
  const holders = holdersRaw.map((h) => ({
    ...h,
    percentBps: totalSupply > 0n ? Number((BigInt(h.balance) * 10_000n) / totalSupply) : 0,
  }));

  const initial = {
    sold: token.sold,
    reserveBalance: token.reserveBalance,
    curveSupplyCap: token.curveSupplyCap,
    graduationReserve: token.graduationReserve,
    basePrice: token.basePrice,
    slope: token.slope,
    spotPrice: tokenSpotPriceNative(token).toString(),
    marketCap: tokenMarketCapNative(token).toString(),
    progressBps: tokenProgressBps(token),
    graduated: token.graduated,
    migratedLiquidityNative: liquidity[0]?.nativeAmount ?? "0",
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
          {token.imageUrl ? (
            <Image src={token.imageUrl} alt={token.symbol} fill className="object-cover" unoptimized />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-black text-neutral-600">
              ${token.symbol.slice(0, 4)}
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black text-neutral-50">${token.symbol}</h1>
            <span className="text-neutral-400">{token.name}</span>
            {token.graduated && (
              <span className="rounded-full bg-lime-400 px-2 py-0.5 text-[10px] font-bold text-neutral-950">GRADUATED</span>
            )}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            created by{" "}
            <Link href={`/profile/${token.creatorAddress}`} className="text-neutral-400 hover:text-lime-400">
              {shortAddress(token.creatorAddress)}
            </Link>{" "}
            · {relativeTime(token.createdAt)}
          </p>
          {token.description && <p className="mt-3 max-w-2xl text-sm text-neutral-300">{token.description}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {token.twitter && <SocialLink href={token.twitter} label="Twitter/X" />}
            {token.telegram && <SocialLink href={token.telegram} label="Telegram" />}
            {token.website && <SocialLink href={token.website} label="Website" />}
            <ShareButton path={`/dank/${token.address}`} />
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TokenTradingSection
            tokenAddress={token.address as `0x${string}`}
            marketAddress={token.marketAddress as `0x${string}`}
            symbol={token.symbol}
            initial={initial}
          />

          {tokenAlerts.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {tokenAlerts.slice(0, 3).map((a) => (
                <div key={a.id} className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-300">
                  🚨 {a.message} <span className="text-neutral-600">· {relativeTime(a.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60">
            <h2 className="border-b border-neutral-900 px-4 py-2.5 text-sm font-semibold text-neutral-200">Recent Trades</h2>
            <div className="max-h-80 overflow-y-auto">
              <RecentTrades tokenAddress={token.address} initialTrades={trades} />
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60">
            <h2 className="border-b border-neutral-900 px-4 py-2.5 text-sm font-semibold text-neutral-200">Top Holders</h2>
            <div className="max-h-80 overflow-y-auto">
              <LiveTopHolders tokenAddress={token.address} marketAddress={token.marketAddress} initial={holders} />
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 text-xs text-neutral-500">
            <div className="flex justify-between py-1">
              <span>Token contract</span>
              <a
                className="font-mono text-neutral-300 hover:text-lime-400"
                href={`https://etherscan.io/address/${token.address}`}
                target="_blank"
                rel="noreferrer"
              >
                {shortAddress(token.address)}
              </a>
            </div>
            <div className="flex justify-between py-1">
              <span>Curve market</span>
              <span className="font-mono text-neutral-300">{shortAddress(token.marketAddress)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Total supply</span>
              <span className="text-neutral-300">{formatCompactNative(totalSupply).replace(" DRC", "")} {token.symbol}</span>
            </div>
            <div className="mt-2 rounded-lg bg-amber-950/40 px-2 py-1.5 text-[10px] text-amber-300">
              Unverified token. Anyone can launch anything here — always verify the contract address yourself.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SocialLink({ href, label }: { href: string; label: string }) {
  const url = href.startsWith("http") ? href : `https://${href}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="rounded-full border border-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-600"
    >
      {label}
    </a>
  );
}
