"use client";

import { useCallback, useState } from "react";
import { useConnection, useWriteContract, usePublicClient } from "wagmi";
import { decodeEventLog } from "viem";
import { DankFactoryAbi } from "@/lib/chain/abi";
import { FACTORY_ADDRESS } from "@/lib/chain/config";

export interface CreateTokenForm {
  name: string;
  symbol: string;
  description: string;
  twitter: string;
  telegram: string;
  website: string;
  image: File | null;
}

type Step = "idle" | "uploading" | "awaiting-signature" | "confirming" | "syncing" | "done" | "error";

export function useCreateToken() {
  const { address } = useConnection();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);

  const create = useCallback(
    async (form: CreateTokenForm, creationFeeWei: bigint) => {
      if (!address) {
        setError("Connect your wallet first");
        setStep("error");
        return;
      }
      setError(null);

      try {
        setStep("uploading");
        const body = new FormData();
        body.set("name", form.name);
        body.set("symbol", form.symbol);
        body.set("description", form.description);
        body.set("twitter", form.twitter);
        body.set("telegram", form.telegram);
        body.set("website", form.website);
        body.set("creatorAddress", address);
        if (form.image) body.set("image", form.image);

        const uploadRes = await fetch("/api/uploads", { method: "POST", body });
        if (!uploadRes.ok) {
          const { error: msg } = await uploadRes.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(msg ?? "Upload failed");
        }
        const { metadataUri } = await uploadRes.json();

        setStep("awaiting-signature");
        const txHash = await writeContractAsync({
          address: FACTORY_ADDRESS,
          abi: DankFactoryAbi,
          functionName: "createToken",
          args: [form.name, form.symbol.toUpperCase(), metadataUri],
          value: creationFeeWei,
        });

        setStep("confirming");
        if (!publicClient) throw new Error("No chain client available");
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

        let createdToken: string | null = null;
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== FACTORY_ADDRESS.toLowerCase()) continue;
          try {
            const decoded = decodeEventLog({ abi: DankFactoryAbi, data: log.data, topics: log.topics });
            if (decoded.eventName === "TokenCreated") {
              createdToken = (decoded.args as unknown as { token: string }).token;
            }
          } catch {
            // not a TokenCreated log, ignore
          }
        }
        if (!createdToken) throw new Error("Could not find TokenCreated event in receipt");

        setStep("syncing");
        await fetch("/api/sync/tx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash }),
        });

        setTokenAddress(createdToken);
        setStep("done");
        return createdToken;
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Something went wrong");
        setStep("error");
      }
    },
    [address, publicClient, writeContractAsync]
  );

  return { create, step, error, tokenAddress };
}
