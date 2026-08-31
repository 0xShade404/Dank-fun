import { WAD } from "@/lib/chain/config";

/**
 * Client-side mirror of contracts/contracts/BondingCurve.sol, used ONLY for instant UI feedback
 * (typing a native amount and seeing an estimated token count before the exact on-chain quote
 * comes back). Every value here is re-verified against BondingCurveMarket.quoteBuy /
 * .quoteSell (an on-chain view call) before a trade is submitted -- see
 * components/trading/buy-sell-panel.tsx. Nothing computed here is used for settlement.
 */

export interface CurveParams {
  basePrice: bigint;
  slope: bigint;
}

function integralCost(basePrice: bigint, slope: bigint, s0: bigint, s1: bigint): bigint {
  const linear = basePrice * (s1 - s0);
  const quadraticNumerator = slope * (s1 * s1 - s0 * s0);
  let quadratic = quadraticNumerator / 2n;
  if (quadraticNumerator % 2n !== 0n) quadratic += 1n;
  return linear + quadratic;
}

export function quoteBuyCost(params: CurveParams, soldTokenAmount: bigint, tokenAmount: bigint): bigint {
  if (tokenAmount <= 0n) return 0n;
  const s0 = soldTokenAmount / WAD;
  let s1 = (soldTokenAmount + tokenAmount) / WAD;
  if ((soldTokenAmount + tokenAmount) % WAD !== 0n) s1 += 1n;
  const cost = integralCost(params.basePrice, params.slope, s0, s1);
  return cost === 0n && tokenAmount > 0n ? 1n : cost;
}

export function quoteSellPayout(params: CurveParams, soldTokenAmount: bigint, tokenAmount: bigint): bigint {
  if (tokenAmount <= 0n || tokenAmount > soldTokenAmount) return 0n;
  const s1 = soldTokenAmount / WAD;
  const s0 = (soldTokenAmount - tokenAmount) / WAD;
  return integralCost(params.basePrice, params.slope, s0, s1);
}

export function spotPrice(params: CurveParams, soldTokenAmount: bigint): bigint {
  return params.basePrice + params.slope * (soldTokenAmount / WAD);
}

/**
 * Estimate how many whole tokens `nativeBudget` buys, via binary search over quoteBuyCost.
 * UI-preview only (see module docstring) -- capped at `maxTokens` (remaining curve supply).
 */
export function estimateTokensForNative(
  params: CurveParams,
  soldTokenAmount: bigint,
  nativeBudget: bigint,
  maxTokens: bigint
): bigint {
  if (nativeBudget <= 0n || maxTokens <= 0n) return 0n;

  let lo = 0n;
  let hi = maxTokens;

  // maxTokens can be large (hundreds of millions of whole tokens); 64 iterations of bigint
  // arithmetic is negligible client-side work and converges well past whole-token precision.
  for (let i = 0; i < 64; i++) {
    if (lo >= hi) break;
    const mid = lo + (hi - lo + 1n) / 2n;
    const cost = quoteBuyCost(params, soldTokenAmount, mid * WAD);
    if (cost <= nativeBudget) {
      lo = mid;
    } else {
      hi = mid - 1n;
    }
  }

  return lo * WAD;
}

export function curveProgressBps(sold: bigint, curveSupplyCap: bigint): number {
  if (curveSupplyCap === 0n) return 0;
  return Number((sold * 10_000n) / curveSupplyCap);
}
