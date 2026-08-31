# dank.fun

DRC-20 meme launchpad, built for degens who ship memecoins and trade for hype.

A lightweight, working MVP of a memecoin factory: connect a wallet, launch a standardized
DRC-20/ERC-20 token in seconds, trade it on a deterministic bonding curve, watch it graduate to
migrated liquidity, and discover/trade other launches — with live sniper alerts along the way.

**Create → Discover → Trade → Graduate → Share.**

## What's here

- **`contracts/`** — Solidity contracts (Hardhat): `DankFactory`, `DankToken`,
  `BondingCurveMarket`, `BondingCurve` (pricing library), `LiquidityManager`. 15 passing tests
  covering creation, curve math, trading, graduation, and access control.
- **`web/`** — Next.js (App Router) app: wallet connect + wallet-signed auth, token creation,
  meme pages with buy/sell trading, discovery, leaderboards, and an event-driven alerts feed.
  Indexes on-chain events into a local SQLite database that stands in for this MVP's
  Postgres/Redis layer.
- **`docs/ARCHITECTURE.md`** — what's real vs. simplified for this MVP, and the specific
  production swap-ins (real indexer worker, Redis pub/sub, Postgres, IPFS/S3, a real DEX router
  integration, contract audit) for each simplification.

## Quick start

```bash
cd contracts && npm install && npm run compile && npm test
npx hardhat node              # separate terminal
npm run deploy:local          # note the printed addresses

cd ../web && npm install
npm run db:push
npm run dev                   # http://localhost:3000
```

Connect a wallet pointed at the local Hardhat chain (chain id `31337`, RPC `http://127.0.0.1:8545`)
to try the full flow. See `docs/ARCHITECTURE.md` for details, env vars, and scope notes.

## Status

This has been built and verified end-to-end locally (contract test suite + a full browser-driven
run of connect → sign in → create → buy → sell → graduate → discover/leaderboard/alerts). It is
an MVP: no external security audit, no live DRC-20 chain deployment, and several backend pieces
(indexer, realtime fanout, image storage) are intentionally simplified for a single-instance demo
— see `docs/ARCHITECTURE.md` for exactly what and why.
