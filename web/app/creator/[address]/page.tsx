import { listTokens } from "@/lib/db/queries";
import { TokenCard } from "@/components/tokens/token-card";
import { shortAddress } from "@/lib/format";

export default async function CreatorPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const tokens = await listTokens({ sort: "new", creator: address, limit: 100 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-black text-neutral-50">Tokens by {shortAddress(address)}</h1>
      {tokens.length === 0 ? (
        <div className="mt-16 text-center text-sm text-neutral-500">This wallet hasn&apos;t launched any tokens yet.</div>
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
