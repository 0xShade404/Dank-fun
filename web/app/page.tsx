import Image from "next/image";
import Link from "next/link";
import { listTokens } from "@/lib/db/queries";
import { TokenCard } from "@/components/tokens/token-card";

// This reads live SQLite state on every request (token listings change constantly), so it must
// never be statically prerendered at build time.
export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [trending, fresh, nearGraduation, graduated] = await Promise.all([
    listTokens({ sort: "trending", limit: 10 }),
    listTokens({ sort: "new", limit: 10 }),
    listTokens({ sort: "near_graduation", limit: 10 }),
    listTokens({ sort: "graduated", limit: 10 }),
  ]);

  return (
    <div>
      <section className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-14 text-center sm:py-20">
        <Image src="/wolf-logo.png" alt="dank.fun" width={96} height={96} className="rounded-2xl shadow-lg shadow-lime-500/10" />
        <h1 className="max-w-2xl text-4xl font-black leading-tight text-neutral-50 sm:text-5xl">
          Launch a DRC-20 memecoin in <span className="text-lime-400">seconds</span>.
        </h1>
        <p className="max-w-xl text-neutral-400">
          Connect a wallet, mint a standardized token, and let a simple bonding curve handle price
          discovery and liquidity — no code, no complex AMM setup.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/create" className="rounded-full bg-lime-400 px-6 py-3 text-sm font-bold text-neutral-950 hover:bg-lime-300">
            Create a token
          </Link>
          <Link href="/explore" className="rounded-full border border-neutral-700 px-6 py-3 text-sm font-semibold text-neutral-200 hover:border-neutral-500">
            Explore tokens
          </Link>
        </div>
        <p className="text-xs text-neutral-600">Create → Discover → Trade → Graduate → Share.</p>
      </section>

      <TokenRow title="🔥 Trending" href="/explore?sort=trending" tokens={trending} />
      <TokenRow title="🆕 New Launches" href="/explore?sort=new" tokens={fresh} />
      <TokenRow title="🎯 Near Graduation" href="/explore?sort=near_graduation" tokens={nearGraduation} />
      <TokenRow title="🎓 Recently Graduated" href="/explore?sort=graduated" tokens={graduated} />
    </div>
  );
}

function TokenRow({
  title,
  href,
  tokens,
}: {
  title: string;
  href: string;
  tokens: Awaited<ReturnType<typeof listTokens>>;
}) {
  if (tokens.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-neutral-100">{title}</h2>
        <Link href={href} className="text-xs font-medium text-lime-400 hover:underline">
          View all →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {tokens.slice(0, 5).map((t) => (
          <TokenCard key={t.address} token={t} />
        ))}
      </div>
    </section>
  );
}
