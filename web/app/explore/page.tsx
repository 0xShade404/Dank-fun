import Link from "next/link";
import { listTokens, searchTokens, type TokenSort } from "@/lib/db/queries";
import { TokenCard } from "@/components/tokens/token-card";

const TABS: { key: TokenSort; label: string }[] = [
  { key: "trending", label: "Trending" },
  { key: "new", label: "New" },
  { key: "near_graduation", label: "Near Graduation" },
  { key: "graduated", label: "Recently Graduated" },
  { key: "volume", label: "Highest Volume" },
  { key: "market_cap", label: "Market Cap" },
];

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; q?: string }>;
}) {
  const { sort, q } = await searchParams;
  const activeSort = (TABS.some((t) => t.key === sort) ? sort : "trending") as TokenSort;

  const tokens = q ? await searchTokens(q, 60) : await listTokens({ sort: activeSort, limit: 60 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-neutral-50">{q ? `Search: "${q}"` : "Explore"}</h1>
      </div>

      {!q && (
        <div className="mt-4 flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={`/explore?sort=${tab.key}`}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                activeSort === tab.key ? "bg-lime-400 text-neutral-950" : "bg-neutral-900 text-neutral-400 hover:text-neutral-100"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      )}

      {tokens.length === 0 ? (
        <div className="mt-16 text-center text-sm text-neutral-500">No tokens found. Be the first to launch one.</div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {tokens.map((t) => (
            <TokenCard key={t.address} token={t} />
          ))}
        </div>
      )}
    </div>
  );
}
