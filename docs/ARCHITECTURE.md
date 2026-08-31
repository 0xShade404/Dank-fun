# Architecture & scope notes

This is a working MVP, built end-to-end and verified locally (contracts + full web flow: connect
wallet → sign in → create token → buy → sell → graduate → discover → leaderboard → alerts). It
follows the trust-domain split from the product spec:

```
CLIENT (wallet, signing)  →  BACKEND (indexing, discovery, metadata)  →  BLOCKCHAIN (settlement)
```

Anything involving ownership, balances, trade settlement, supply, or fees is enforced on-chain by
the contracts in `contracts/`. The web app's database is derived, disposable indexer state — it
can be wiped and rebuilt from chain history (see `npm run db:push` + a fresh `syncTransaction`
pass) and is never a source of truth.

## What's real

- **Contracts** (`contracts/`): `DankFactory`, `DankToken`, `BondingCurveMarket`,
  `BondingCurve` (pure math library), `LiquidityManager`. Fixed 18-decimal supply, standardized
  protocol-controlled curve config, reentrancy guards, pausability, checked arithmetic, custom
  errors, events for every state transition. 15 Hardhat tests cover creation, the curve's
  quote math, buy/sell/refund/slippage paths, graduation, and access control.
- **Bonding curve settlement**: linear curve, `price(s) = basePrice + slope * s`. `buy()` is
  exact-output (caller picks a token amount, contract computes exact cost via a closed-form
  integral, refunds any overpayment) so there's no on-chain inverse/sqrt in the hot path.
  `quoteBuy`/`quoteSell` are on-chain view functions and are the only quotes ever used for
  settlement — `lib/curve.ts` on the frontend duplicates the same math only for keystroke-level
  UI previews and is always re-verified against the contract before a transaction is sent.
- **Wallet auth**: nonce + signature (SIWE-style), verified server-side with `viem`'s
  `recoverMessageAddress`, session issued as a signed HTTP-only cookie.
- **Trading UX**: wallet-signed `buy`/`sell`/`createToken` calls via `wagmi`, slippage controls,
  live quote refresh, live curve-progress/stats polling, an SSE trade feed and SSE alert feed.
- **Alerts**: generated synchronously off decoded on-chain events (new token, first buy, large
  buy/sell, rapid volume, graduation, liquidity migration) — see `lib/chain/sync.ts`.

## What's simplified for this MVP (and the production swap-in)

| Area | MVP approach | Production swap-in |
|---|---|---|
| Indexer | Client calls `POST /api/sync/tx` right after its own transaction confirms; decodes that tx's logs and upserts SQLite. Catches everything traded through this UI, not txs submitted elsewhere. | An always-on worker subscribing to contract events (or a dedicated indexing service), independent of any client request. |
| Realtime | `lib/sse.ts` polls SQLite every 2s per connection. | Redis pub/sub fed by the indexer worker, fanned out over SSE/WebSockets across many app instances. |
| Database | SQLite via Drizzle (`web/lib/db`), single file, single instance. | Postgres for durable relational state + Redis for hot/cached reads, per the original spec. |
| Image/metadata storage | Uploaded images land in `web/public/uploads`; metadata JSON is served from `/api/metadata/[draftId]`, backed by a `token_drafts` table. | IPFS/Arweave for content-addressed metadata + an S3-compatible bucket for original uploads, with resizing/moderation. |
| Liquidity graduation | `LiquidityManager.migrateLiquidity` escrows the migrated tokens + native currency in the contract itself; `withdrawToRouter` is a governance-only escape hatch. | A real DEX router integration specific to the target DRC-20 chain, called automatically (or by a keeper) instead of sitting in escrow. |
| Chain target | Local Hardhat node (chain id 31337), addresses hardcoded as dev defaults in `web/lib/chain/config.ts`, overridable via `NEXT_PUBLIC_*` env vars. | A real DRC-20 / EVM-compatible testnet or mainnet RPC, with failover endpoints. |
| Solidity toolchain | Hardhat 2 + a locally-vendored solc build (see `contracts/scripts/_offline-solc-setup.js`) because this sandbox's network egress doesn't allow `binaries.soliditylang.org`. | Any environment with normal network access should just let Hardhat download the real, checksum-verified compiler — don't run the offline shim there. |
| Leaderboards / rankings | Computed live from `trades`/`tokens` in JS (BigInt-safe; see note below), no snapshot table. | Fine to keep simple per the spec ("avoid overly complicated ranking logic in v1"); add a `leaderboard_snapshots` table only if live computation becomes a bottleneck. |
| Contract review | Unit-tested, not audited. | Independent audit, fuzz/invariant tests, multisig ownership, testnet soak before mainnet. |

## A specific correctness note worth flagging

Token and native-currency amounts are 18-decimal integers stored as `TEXT` in SQLite (values up
to ~10^27), which comfortably exceed SQLite's 64-bit `INTEGER` range. `CAST(x AS INTEGER)` on a
value that large **clamps** to `INT64_MAX` rather than erroring, which would silently corrupt any
`ORDER BY`/`SUM` built on it. `web/lib/db/queries.ts` deliberately avoids SQL-level numeric casts
on these columns and does all such sorting/aggregation in JS with `BigInt` instead.

## Repository layout

```
contracts/   Hardhat project: DankFactory, DankToken, BondingCurveMarket, BondingCurve,
             LiquidityManager, tests, deploy script, ABI export script.
web/         Next.js (App Router) app: pages, API routes, SQLite/Drizzle indexer state,
             wagmi/viem chain integration, wallet auth.
docs/        This file.
```

## Running it locally

```bash
# 1. Contracts: compile, test, deploy to a local chain
cd contracts
npm install
npm run setup:offline-solc   # only needed where binaries.soliditylang.org is blocked
npm run compile
npm test
npx hardhat node             # in one terminal
npm run deploy:local         # in another; note the printed factory/liquidityManager addresses

# 2. Web app
cd ../web
npm install
npm run db:push              # creates ./data/dank.db from lib/db/schema.ts
npm run dev
```

If you redeploy the contracts, update `NEXT_PUBLIC_FACTORY_ADDRESS` /
`NEXT_PUBLIC_LIQUIDITY_MANAGER_ADDRESS` (or the defaults in `web/lib/chain/config.ts`) to match,
and re-run `contracts && npm run export-abi` if any contract's interface changed.
