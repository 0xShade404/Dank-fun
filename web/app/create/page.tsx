"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useConnection } from "wagmi";
import { useSession } from "@/components/wallet/session-context";
import { useCreateToken } from "@/hooks/use-create-token";
import { useFactoryConfig } from "@/hooks/use-factory-config";
import { formatCompactNative, formatTokenAmount } from "@/lib/format";

const STEP_LABEL: Record<string, string> = {
  uploading: "Uploading image & metadata…",
  "awaiting-signature": "Confirm in your wallet…",
  confirming: "Waiting for on-chain confirmation…",
  syncing: "Indexing your new token…",
};

export default function CreatePage() {
  const router = useRouter();
  const { isConnected } = useConnection();
  const { sessionAddress, signIn, isSigningIn } = useSession();
  const { creationFeeWei, curveConfig, isLoading } = useFactoryConfig();
  const { create, step, error, tokenAddress } = useCreateToken();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [website, setWebsite] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const busy = step !== "idle" && step !== "error" && step !== "done";

  useEffect(() => {
    if (step === "done" && tokenAddress) {
      router.push(`/dank/${tokenAddress}`);
    }
  }, [step, tokenAddress, router]);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-black text-neutral-50">Launch a memecoin</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Fixed 18 decimals, a fixed supply, and a standardized bonding curve — every token created
        here behaves identically. No arbitrary minting, ever.
      </p>

      {!isConnected && (
        <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-300">
          Connect your wallet from the top bar to create a token.
        </div>
      )}
      {isConnected && !sessionAddress && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-300">
          <span>Sign in with your wallet to continue.</span>
          <button
            onClick={() => signIn()}
            disabled={isSigningIn}
            className="rounded-full bg-lime-400 px-3 py-1.5 text-xs font-semibold text-neutral-950"
          >
            {isSigningIn ? "Check wallet…" : "Sign In"}
          </button>
        </div>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (creationFeeWei === undefined) return;
          await create(
            { name, symbol, description, twitter, telegram, website, image },
            creationFeeWei
          );
        }}
        className="mt-6 space-y-4"
      >
        <div className="flex items-center gap-4">
          <label className="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-700 bg-neutral-900 text-xs text-neutral-500 hover:border-lime-400">
            {imagePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagePreview} alt="preview" className="h-full w-full object-cover" />
            ) : (
              "Image"
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setImage(file);
                setImagePreview(file ? URL.createObjectURL(file) : null);
              }}
            />
          </label>
          <div className="flex-1 space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Token name (e.g. Dank Coin)"
              maxLength={64}
              required
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-lime-400 focus:outline-none"
            />
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="Symbol (e.g. DANK)"
              maxLength={16}
              required
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-lime-400 focus:outline-none"
            />
          </div>
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          maxLength={1000}
          rows={3}
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-lime-400 focus:outline-none"
        />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            value={twitter}
            onChange={(e) => setTwitter(e.target.value)}
            placeholder="Twitter/X (optional)"
            className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-lime-400 focus:outline-none"
          />
          <input
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
            placeholder="Telegram (optional)"
            className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-lime-400 focus:outline-none"
          />
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="Website (optional)"
            className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-lime-400 focus:outline-none"
          />
        </div>

        {curveConfig && (
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-xs text-neutral-400 sm:grid-cols-4">
            <div>
              <div className="text-neutral-500">Creation fee</div>
              <div className="font-semibold text-neutral-200">
                {creationFeeWei !== undefined ? formatCompactNative(creationFeeWei) : "…"}
              </div>
            </div>
            <div>
              <div className="text-neutral-500">Curve supply</div>
              <div className="font-semibold text-neutral-200">{formatTokenAmount(curveConfig.curveSupplyCap)}</div>
            </div>
            <div>
              <div className="text-neutral-500">LP reserve</div>
              <div className="font-semibold text-neutral-200">{formatTokenAmount(curveConfig.graduationReserve)}</div>
            </div>
            <div>
              <div className="text-neutral-500">Trade fee</div>
              <div className="font-semibold text-neutral-200">{Number(curveConfig.protocolFeeBps) / 100}%</div>
            </div>
          </div>
        )}

        {error && <div className="rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">{error}</div>}

        <button
          type="submit"
          disabled={!sessionAddress || busy || isLoading || creationFeeWei === undefined}
          className="w-full rounded-full bg-lime-400 py-3 text-sm font-bold text-neutral-950 transition hover:bg-lime-300 disabled:opacity-50"
        >
          {busy ? STEP_LABEL[step] ?? "Working…" : "Create token"}
        </button>
      </form>
    </div>
  );
}
