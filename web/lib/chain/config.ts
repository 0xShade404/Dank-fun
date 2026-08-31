import type { Chain } from "viem";

function configuredEnv(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

export function validateDogechainConfig() {
  const required = ["NEXT_PUBLIC_RPC_URL", "NEXT_PUBLIC_FACTORY_ADDRESS", "NEXT_PUBLIC_LIQUIDITY_MANAGER_ADDRESS"];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length) throw new Error(`Missing Dogechain configuration: ${missing.join(", ")}`);
}

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 2000);
if (!Number.isInteger(chainId) || chainId <= 0) throw new Error("NEXT_PUBLIC_CHAIN_ID must be a positive integer");

export const RPC_URL = configuredEnv("NEXT_PUBLIC_RPC_URL", "http://127.0.0.1:8545");
export const FACTORY_ADDRESS = configuredEnv("NEXT_PUBLIC_FACTORY_ADDRESS", "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const LIQUIDITY_MANAGER_ADDRESS = configuredEnv("NEXT_PUBLIC_LIQUIDITY_MANAGER_ADDRESS", "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const EXPLORER_URL = (process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://explorer.dogechain.dog").replace(/\/$/, "");

export const appChain: Chain = {
  id: chainId,
  name: chainId === 20001 ? "Dogechain Testnet" : "Dogechain",
  nativeCurrency: { name: "WDOGE", symbol: "WDOGE", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "Dogechain Explorer", url: EXPLORER_URL } },
} as const;

export const CURVE_DEFAULTS = {
  creationFeeWei: 10_000_000_000_000_000n,
  basePrice: 1_500_000_000n,
  slope: 90n,
  curveSupplyCap: 800_000_000n * 10n ** 18n,
  graduationReserve: 200_000_000n * 10n ** 18n,
  protocolFeeBps: 100n,
} as const;

export const TOTAL_SUPPLY = CURVE_DEFAULTS.curveSupplyCap + CURVE_DEFAULTS.graduationReserve;
export const WAD = 10n ** 18n;

export function explorerTxUrl(hash: string) { return `${EXPLORER_URL}/tx/${hash}`; }
export function explorerAddressUrl(address: string) { return `${EXPLORER_URL}/address/${address}`; }
