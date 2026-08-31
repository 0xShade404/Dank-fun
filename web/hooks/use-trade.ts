"use client";

import { useCallback, useState } from "react";
import { useWriteContract, usePublicClient } from "wagmi";
import { BondingCurveMarketAbi, DankTokenAbi } from "@/lib/chain/abi";

type Step = "idle" | "approving" | "awaiting-signature" | "confirming" | "syncing" | "done" | "error";

async function syncTx(txHash: string) {
  await fetch("/api/sync/tx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txHash }),
  });
}

export function useTrade(marketAddress: `0x${string}`, tokenAddress: `0x${string}`) {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);

  // Both return whether the trade actually succeeded, computed synchronously within this same
  // call rather than left for the caller to infer from `step`/`error` after the fact -- reading
  // those from an event-handler closure after an `await` can observe a stale pre-call snapshot,
  // since this hook's state only updates on the *next* render.
  const buy = useCallback(
    async (tokenAmount: bigint, maxNativeIn: bigint): Promise<boolean> => {
      setError(null);
      try {
        setStep("awaiting-signature");
        const txHash = await writeContractAsync({
          address: marketAddress,
          abi: BondingCurveMarketAbi,
          functionName: "buy",
          args: [tokenAmount, maxNativeIn],
          value: maxNativeIn,
        });
        setStep("confirming");
        await publicClient?.waitForTransactionReceipt({ hash: txHash });
        setStep("syncing");
        await syncTx(txHash);
        setStep("done");
        return true;
      } catch (err) {
        console.error(err);
        setError(readableError(err));
        setStep("error");
        return false;
      }
    },
    [marketAddress, publicClient, writeContractAsync]
  );

  const sell = useCallback(
    async (tokenAmount: bigint, minNativeOut: bigint, currentAllowance: bigint): Promise<boolean> => {
      setError(null);
      try {
        if (currentAllowance < tokenAmount) {
          setStep("approving");
          const approveTx = await writeContractAsync({
            address: tokenAddress,
            abi: DankTokenAbi,
            functionName: "approve",
            args: [marketAddress, tokenAmount],
          });
          await publicClient?.waitForTransactionReceipt({ hash: approveTx });
        }

        setStep("awaiting-signature");
        const txHash = await writeContractAsync({
          address: marketAddress,
          abi: BondingCurveMarketAbi,
          functionName: "sell",
          args: [tokenAmount, minNativeOut],
        });
        setStep("confirming");
        await publicClient?.waitForTransactionReceipt({ hash: txHash });
        setStep("syncing");
        await syncTx(txHash);
        setStep("done");
        return true;
      } catch (err) {
        console.error(err);
        setError(readableError(err));
        setStep("error");
        return false;
      }
    },
    [marketAddress, tokenAddress, publicClient, writeContractAsync]
  );

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
  }, []);

  return { buy, sell, step, error, reset };
}

function readableError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("User rejected") || message.includes("User denied")) return "Transaction rejected.";
  if (message.includes("SlippageExceeded")) return "Price moved beyond your slippage tolerance. Try again.";
  if (message.includes("CurveSupplyExceeded")) return "Not enough tokens left on the curve for that amount.";
  if (message.includes("AlreadyGraduated")) return "This token already graduated — trade it on the DEX instead.";
  return message.length > 160 ? "Transaction failed. Please try again." : message;
}
