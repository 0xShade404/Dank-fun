import Link from "next/link";
import { listTokens, searchTokens, type TokenSort } from "@/lib/db/queries";
import { TokenCard } from "@/components/tokens/token-card";

export const dynamic = "force-dynamic";

const TABS: { key: TokenSort; label: string }[] = [
  { key: "trending", label: "Trending" }, { key: "new", label: "New" }, { key: "near_graduation", label: "Near graduation" }, { key: "graduated", label: "Graduated" }, { key: "volume", label: "Highest volume" }, { key: "market_cap", label: "Market cap" },
];

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ sort?: string; q?: string }> }) {
  const { sort, q } = await searchParams;
  const activeSort = (TABS.some((tab) => tab.key === sort) ? sort : "trending") as TokenSort;
  const tokens = q ? await searchTokens(q, 60) : await listTokens({ sort: activeSort, limit: 60 });
  return <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
    <div className="flex flex-col gap-2"><p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Market explorer</p><h1 className="text-3xl font-black tracking-tight text-foreground">{q ? <>Results for <span className="text-primary">&quot;{q}&quot;</span></> : "Explore tokens"}</h1><p className="max-w-xl text-sm leading-6 text-muted-foreground">Find new launches, follow the curve, and discover which communities are gaining momentum.</p></div>
    {!q && <div className="mobile-scroll mt-7 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Token sorting"><div className="flex min-w-max gap-2">{TABS.map((tab) => <Link key={tab.key} href={`/explore?sort=${tab.key}`} aria-current={activeSort === tab.key ? "page" : undefined} className={`flex min-h-11 items-center rounded-full border px-4 text-xs font-semibold transition ${activeSort === tab.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}>{tab.label}</Link>)}</div></div>}
    <div className="mt-8 flex items-center justify-between border-b border-border pb-3"><p className="text-xs text-muted-foreground">{tokens.length} {tokens.length === 1 ? "token" : "tokens"} found</p>{q && <Link href="/explore" className="text-xs font-semibold text-primary hover:underline">Clear search</Link>}</div>
    {tokens.length === 0 ? <div className="flex flex-col items-center gap-3 py-20 text-center"><div className="rounded-2xl border border-border bg-card px-6 py-5"><p className="font-semibold text-foreground">No tokens found</p><p className="mt-1 text-sm text-muted-foreground">Be the first community to launch one.</p></div><Link href="/create" className="text-sm font-semibold text-primary hover:underline">Create a token</Link></div> : <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{tokens.map((token) => <TokenCard key={token.address} token={token} />)}</div>}
  </div>;
}
