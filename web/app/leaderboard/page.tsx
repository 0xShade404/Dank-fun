import Link from "next/link";
import Image from "next/image";
import { getLeaderboard, type LeaderboardCategory } from "@/lib/db/queries";
import { formatCompactNative, shortAddress, bpsToPercent } from "@/lib/format";

const CATEGORIES: { key: LeaderboardCategory; label: string }[] = [
  { key: "volume_24h", label: "24h Volume" },
  { key: "market_cap", label: "Market Cap" },
  { key: "price_change_24h", label: "Price Change" },
  { key: "creator_volume", label: "Creator Volume" },
  { key: "most_traded", label: "Most Traded" },
  { key: "recently_graduated", label: "Recently Graduated" },
];

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category: categoryParam } = await searchParams;
  const category = (CATEGORIES.some((c) => c.key === categoryParam) ? categoryParam : "volume_24h") as LeaderboardCategory;
  const rows = await getLeaderboard(category, 30);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-black text-neutral-50">Leaderboard</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Link
            key={c.key}
            href={`/leaderboard?category=${c.key}`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              category === c.key ? "bg-lime-400 text-neutral-950" : "bg-neutral-900 text-neutral-400 hover:text-neutral-100"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-800">
        {rows.length === 0 && <div className="p-8 text-center text-sm text-neutral-500">No data yet.</div>}

        {category === "creator_volume"
          ? (rows as { creator: string; volume24h: string; tokenCount: number }[]).map((row, i) => (
              <div key={row.creator} className="flex items-center justify-between border-b border-neutral-900 bg-neutral-900/40 px-4 py-3 text-sm last:border-0">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-neutral-600">#{i + 1}</span>
                  <span className="font-mono text-neutral-200">{shortAddress(row.creator)}</span>
                  <span className="text-xs text-neutral-500">{row.tokenCount} token{row.tokenCount === 1 ? "" : "s"}</span>
                </div>
                <span className="font-semibold text-neutral-100">{formatCompactNative(row.volume24h)}</span>
              </div>
            ))
          : (rows as Array<Record<string, unknown>>).map((row, i) => {
              const address = row.address as string;
              const symbol = row.symbol as string;
              const name = row.name as string;
              const imageUrl = row.imageUrl as string | null;
              const marketCap = row.marketCap as string;
              const volume24h = row.volume24h as string;
              const changeBps = row.changeBps as number | undefined;
              return (
                <Link
                  key={address}
                  href={`/dank/${address}`}
                  className="flex items-center justify-between border-b border-neutral-900 bg-neutral-900/40 px-4 py-3 text-sm last:border-0 hover:bg-neutral-900"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-neutral-600">#{i + 1}</span>
                    <div className="relative h-8 w-8 overflow-hidden rounded-full bg-neutral-800">
                      {imageUrl && <Image src={imageUrl} alt={symbol} fill className="object-cover" unoptimized />}
                    </div>
                    <div>
                      <div className="font-semibold text-neutral-100">${symbol}</div>
                      <div className="text-xs text-neutral-500">{name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    {category === "price_change_24h" && changeBps !== undefined ? (
                      <span className={changeBps >= 0 ? "text-lime-400" : "text-red-400"}>
                        {changeBps >= 0 ? "+" : ""}
                        {bpsToPercent(changeBps)}
                      </span>
                    ) : category === "volume_24h" ? (
                      <span className="font-semibold text-neutral-100">{formatCompactNative(volume24h)}</span>
                    ) : (
                      <span className="font-semibold text-neutral-100">{formatCompactNative(marketCap)}</span>
                    )}
                  </div>
                </Link>
              );
            })}
      </div>
    </div>
  );
}
