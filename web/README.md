# dank.fun web

Next.js (App Router) frontend + API for the dank.fun MVP. See `../docs/ARCHITECTURE.md` for the
full picture; this file is just the local dev quick start.

## Setup

```bash
npm install
npm run db:push        # creates ./data/dank.db from lib/db/schema.ts
npm run dev            # http://localhost:3000
```

Point a wallet at the local Hardhat chain (`../contracts`, chain id `31337`,
`http://127.0.0.1:8545`) after running its `npm run deploy:local`, or set the
`NEXT_PUBLIC_CHAIN_ID` / `NEXT_PUBLIC_RPC_URL` / `NEXT_PUBLIC_FACTORY_ADDRESS` /
`NEXT_PUBLIC_LIQUIDITY_MANAGER_ADDRESS` / `DATABASE_PATH` / `SESSION_SECRET` env vars to target
something else.

## Scripts

- `npm run dev` / `npm run build` / `npm run start` — standard Next.js.
- `npm run lint` — ESLint.
- `npm run db:push` — sync `lib/db/schema.ts` to the local SQLite file (dev-only; this database
  is derived indexer state, never a source of truth — see `../docs/ARCHITECTURE.md`).

## Layout

- `app/` — pages (`/`, `/create`, `/explore`, `/leaderboard`, `/alerts`, `/dank/[address]`,
  `/creator/[address]`) and API routes (`app/api/**`).
- `components/` — UI, split into `wallet/`, `trading/`, `tokens/`, `alerts/`, `layout/`.
- `lib/chain/` — wagmi/viem config, contract ABIs (exported from `../contracts`), the on-chain
  event indexer (`sync.ts`).
- `lib/db/` — Drizzle schema and query layer (SQLite).
- `lib/curve.ts` — client-side bonding-curve math mirror, used only for UI previews; every trade
  is re-quoted against the contract before submission.
- `lib/auth.ts` — nonce/signature wallet auth + signed session cookies.
