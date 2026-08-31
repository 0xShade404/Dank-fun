"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { DankFactoryAbi } from "@/lib/chain/abi";
import { FACTORY_ADDRESS } from "@/lib/chain/config";

const factoryContract = { address: FACTORY_ADDRESS, abi: DankFactoryAbi } as const;

export function useFactoryConfig() {
  const { data, isLoading } = useReadContracts({
    contracts: [
      { ...factoryContract, functionName: "creationFeeWei" },
      { ...factoryContract, functionName: "curveConfig" },
    ],
  });

  const creationFeeWei = data?.[0]?.result as bigint | undefined;
  const curveConfig = data?.[1]?.result as
    | readonly [bigint, bigint, bigint, bigint, bigint]
    | undefined;

  return {
    isLoading,
    creationFeeWei,
    curveConfig: curveConfig
      ? {
          basePrice: curveConfig[0],
          slope: curveConfig[1],
          curveSupplyCap: curveConfig[2],
          graduationReserve: curveConfig[3],
          protocolFeeBps: curveConfig[4],
        }
      : undefined,
  };
}

export function usePaused() {
  const { data } = useReadContract({ ...factoryContract, functionName: "paused" });
  return Boolean(data);
}
