import { hardhat } from "viem/chains";
import type { Chain } from "viem";

/**
 * Chain + contract wiring for the dApp.
 *
 * This MVP targets a local Hardhat chain (id 31337) by default, matching the contracts
 * package's `npm run deploy:local`. To point at a real DRC-20 / EVM-compatible testnet or
 * mainnet, set NEXT_PUBLIC_CHAIN_ID / NEXT_PUBLIC_RPC_URL / NEXT_PUBLIC_FACTORY_ADDRESS /
 * NEXT_PUBLIC_LIQUIDITY_MANAGER_ADDRESS and redeploy the contracts package there first.
 */

const DEFAULT_FACTORY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as const;
const DEFAULT_LIQUIDITY_MANAGER_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const;

export const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ??
  DEFAULT_FACTORY_ADDRESS) as `0x${string}`;

export const LIQUIDITY_MANAGER_ADDRESS = (process.env.NEXT_PUBLIC_LIQUIDITY_MANAGER_ADDRESS ??
  DEFAULT_LIQUIDITY_MANAGER_ADDRESS) as `0x${string}`;

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";

export const appChain: Chain = {
  ...hardhat,
  id: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? hardhat.id),
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
};

/**
 * Protocol-standardized curve defaults. These MUST match `contracts/scripts/deploy.js` for the
 * network this app is pointed at -- they're used only for client-side quote *previews* (instant
 * feedback while typing) and demo-data seeding. Every real trade re-fetches the authoritative
 * quote from the deployed BondingCurveMarket contract before submission; nothing here is trusted
 * for settlement.
 */
export const CURVE_DEFAULTS = {
  creationFeeWei: 10_000_000_000_000_000n, // 0.01 native
  basePrice: 1_500_000_000n, // wei per whole token at sold = 0
  slope: 90n, // wei per whole token, per whole token sold
  curveSupplyCap: 800_000_000n * 10n ** 18n, // 800M tokens, 18 decimals
  graduationReserve: 200_000_000n * 10n ** 18n, // 200M tokens, 18 decimals
  protocolFeeBps: 100n, // 1%
} as const;

export const TOTAL_SUPPLY = CURVE_DEFAULTS.curveSupplyCap + CURVE_DEFAULTS.graduationReserve;
export const WAD = 10n ** 18n;
