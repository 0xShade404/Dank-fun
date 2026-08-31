import { formatUnits } from "viem";

export const NATIVE_SYMBOL = "DRC";

export function formatNative(wei: bigint | string, maxDecimals = 5): string {
  const value = Number(formatUnits(typeof wei === "string" ? BigInt(wei) : wei, 18));
  if (value === 0) return "0";
  if (value < 0.00001) return "<0.00001";
  return value.toLocaleString(undefined, { maximumFractionDigits: maxDecimals });
}

export function formatTokenAmount(raw: bigint | string): string {
  const value = Number(formatUnits(typeof raw === "string" ? BigInt(raw) : raw, 18));
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function formatCompactNative(wei: bigint | string): string {
  const value = Number(formatUnits(typeof wei === "string" ? BigInt(wei) : wei, 18));
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M ${NATIVE_SYMBOL}`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K ${NATIVE_SYMBOL}`;
  if (value >= 1) return `${value.toFixed(3)} ${NATIVE_SYMBOL}`;
  return `${value.toFixed(6)} ${NATIVE_SYMBOL}`;
}

export function bpsToPercent(bps: number, decimals = 1): string {
  return `${(bps / 100).toFixed(decimals)}%`;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function relativeTime(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
