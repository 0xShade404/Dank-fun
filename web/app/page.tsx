import Image from "next/image";
import Link from "next/link";
import { listTokens } from "@/lib/db/queries";
import { TokenCard } from "@/components/tokens/token-card";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [trending, fresh, nearGraduation, graduated] = await Promise.all([
    listTokens({ sort: "trending", limit: 10 }),
    listTokens({ sort: "new", limit: 10 }),
    listTokens({ sort: "near_graduation", limit: 10 }),
    listTokens({ sort: "graduated", limit: 10 }),
  ]);

  return <div className="surface-grid pb-12">
    <section className="mx-auto flex max-w-6xl flex-col items-center gap-7 px-4 py-16 text-center sm:py-24">
      <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 font-mono text-xs text-primary"><span className="size-1.5 rounded-full bg-primary animate-pulse-glow" />DRC-20 token factory</div>
      <Image src="/wolf-logo.png" alt="dank.fun wolf logo" width={88} height={88} className="rounded-3xl shadow-2xl shadow-primary/10" />
      <h1 className="max-w-3xl text-balance text-4xl font-black leading-[1.05] tracking-tight text-foreground sm:text-6xl">Launch the next <span className="text-primary">community coin.</span></h1>
      <p className="max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">Create a standardized DRC-20 token, discover its price on a transparent bonding curve, and build momentum toward graduation.</p>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row"><Link href="/create" className="flex min-h-12 items-center justify-center rounded-full bg-primary px-7 font-bold text-primary-foreground transition hover:brightness-110">Create a token</Link><Link href="/explore" className="flex min-h-12 items-center justify-center rounded-full border border-border bg-card px-7 font-semibold text-foreground transition hover:border-primary/50">Explore the market</Link></div>
      <p className="font-mono text-xs text-muted-foreground">Create / Discover / Trade / Graduate</p>
    </section>
    <div className="mx-auto max-w-6xl px-4"><div className="grid gap-3 border-y border-border py-5 sm:grid-cols-3"><div><p className="font-mono text-xs text-primary">01 / SIMPLE</p><p className="mt-1 text-sm text-muted-foreground">No code or AMM setup required.</p></div><div><p className="font-mono text-xs text-primary">02 / TRANSPARENT</p><p className="mt-1 text-sm text-muted-foreground">One curve makes price discovery visible.</p></div><div><p className="font-mono text-xs text-primary">03 / COMMUNITY-LED</p><p className="mt-1 text-sm text-muted-foreground">Momentum moves promising coins forward.</p></div></div></div>
    <TokenRow title="Trending now" href="/explore?sort=trending" tokens={trending} />
    <TokenRow title="New launches" href="/explore?sort=new" tokens={fresh} />
    <TokenRow title="Near graduation" href="/explore?sort=near_graduation" tokens={nearGraduation} />
    <TokenRow title="Recently graduated" href="/explore?sort=graduated" tokens={graduated} />
  </div>;
}

function TokenRow({ title, href, tokens }: { title: string; href: string; tokens: Awaited<ReturnType<typeof listTokens>> }) {
  if (!tokens.length) return null;
  return <section className="mx-auto max-w-6xl px-4 py-7"><div className="mb-4 flex items-end justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Market feed</p><h2 className="mt-1 text-xl font-bold text-foreground">{title}</h2></div><Link href={href} className="text-xs font-semibold text-primary hover:underline">View all</Link></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">{tokens.slice(0, 5).map((token) => <TokenCard key={token.address} token={token} />)}</div></section>;
}
