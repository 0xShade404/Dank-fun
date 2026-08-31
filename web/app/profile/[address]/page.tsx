import { notFound } from "next/navigation";
import { isAddress } from "viem";
import { getPortfolio, getCreatorStats, getUserByAddress } from "@/lib/db/profile";
import { computeBadges } from "@/lib/badges";
import { ProfileHeader } from "@/components/profile/profile-header";
import { PortfolioTable } from "@/components/profile/portfolio-table";
import { TokenCard } from "@/components/tokens/token-card";
import { formatCompactNative, formatSignedCompactNative, nowSeconds } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) notFound();

  const lower = address.toLowerCase();
  const [user, portfolio, creatorStats] = await Promise.all([
    getUserByAddress(lower),
    getPortfolio(lower),
    getCreatorStats(lower),
  ]);

  const now = nowSeconds();
  const badges = computeBadges({
    accountAgeSeconds: user ? now - user.createdAt : 0,
    tokensCreated: creatorStats.tokenCount,
    tokensGraduated: creatorStats.graduatedCount,
    tradeCount: portfolio.tradeCount,
    hasProfile: Boolean(user?.displayName || user?.bio),
    portfolioValueNative: Number(portfolio.totalCurrentValueNative) / 1e18,
  });

  const unrealized = BigInt(portfolio.totalUnrealizedPnlNative);
  const realized = BigInt(portfolio.totalRealizedPnlNative);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <ProfileHeader
        address={lower}
        displayName={user?.displayName ?? null}
        avatarUrl={user?.avatarUrl ?? null}
        bio={user?.bio ?? null}
        twitter={user?.twitter ?? null}
        telegram={user?.telegram ?? null}
        website={user?.website ?? null}
        memberSince={user?.createdAt ?? null}
        badges={badges}
      />

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Portfolio Value" value={formatCompactNative(portfolio.totalCurrentValueNative)} />
        <Stat
          label="Unrealized PnL"
          value={formatSignedCompactNative(portfolio.totalUnrealizedPnlNative)}
          tone={unrealized >= 0n ? "pos" : "neg"}
        />
        <Stat
          label="Realized PnL"
          value={formatSignedCompactNative(portfolio.totalRealizedPnlNative)}
          tone={realized >= 0n ? "pos" : "neg"}
        />
        <Stat label="Trades" value={String(portfolio.tradeCount)} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-neutral-200">Portfolio</h2>
        <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40">
          <PortfolioTable positions={portfolio.positions} />
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-neutral-200">
            Created Tokens <span className="text-neutral-500">({creatorStats.tokenCount})</span>
          </h2>
          {creatorStats.tokenCount > 0 && (
            <span className="text-xs text-neutral-500">
              {creatorStats.graduatedCount} graduated &middot; {formatCompactNative(creatorStats.totalMarketCapNative)} combined mcap
            </span>
          )}
        </div>
        {creatorStats.tokens.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 text-center text-sm text-neutral-500">
            Hasn&apos;t launched a token yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {creatorStats.tokens.map((t) => (
              <TokenCard key={t.address} token={t} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`mt-1 font-semibold ${tone === "pos" ? "text-lime-400" : tone === "neg" ? "text-red-400" : "text-neutral-100"}`}>
        {value}
      </div>
    </div>
  );
}
