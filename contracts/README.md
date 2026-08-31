# dank.fun contracts

Hardhat project for the DRC-20 memecoin factory contracts. See `../docs/ARCHITECTURE.md` for how
this fits into the rest of the app.

## Contracts

- **`DankFactory.sol`** — `createToken(name, symbol, metadataURI)` deploys a `DankToken` +
  `BondingCurveMarket` pair using the current protocol-standardized `curveConfig` (owner-only
  `configureCurve`/`setCreationFee`/`setFeeRecipient` govern future launches; already-launched
  tokens keep the config snapshot they were created with). Pausable, reentrancy-guarded.
- **`DankToken.sol`** — fixed 18-decimal ERC20. The constructor mints the entire fixed supply to
  its `BondingCurveMarket` in one shot; there is no mint function afterward.
- **`BondingCurveMarket.sol`** — one instance per token. Holds that token's full supply and is
  the only venue for trading it pre-graduation. `buy(tokenAmount, maxNativeIn)` is exact-output
  (computes exact cost via `BondingCurve`, refunds overpayment); `sell(tokenAmount, minNativeOut)`
  requires a prior `approve`. Auto-graduates when `sold == curveSupplyCap`, migrating the
  graduation-reserve tokens + all raised native currency to `LiquidityManager`.
- **`BondingCurve.sol`** — pure math library: linear curve `price(s) = basePrice + slope*s`,
  `quoteBuy`/`quoteSell` compute the exact definite-integral cost/payout, rounding in the
  protocol's favor.
- **`LiquidityManager.sol`** — escrows migrated liquidity per token. `migrateLiquidity` only
  accepts calls from a `BondingCurveMarket` whose immutable `factory` pointer matches the
  `factory` this contract was wired to via the one-time `setFactory` (see `scripts/deploy.js`).
  `withdrawToRouter` is an owner-only (governance/multisig) escape hatch for seeding a real DEX
  pool once one exists for the target chain — see `docs/ARCHITECTURE.md`.

## Commands

```bash
npm install
npm run setup:offline-solc   # only if your network blocks binaries.soliditylang.org
npm run compile
npm test
npx hardhat node             # separate terminal
npm run deploy:local
npm run export-abi           # re-sync ABIs into ../web/lib/chain/abi after an interface change
```

## Why `setup:offline-solc` exists

Hardhat normally downloads a checksum-verified `solc` build from
`binaries.soliditylang.org`. In a sandboxed environment where that host isn't reachable,
`scripts/_offline-solc-setup.js` pre-populates Hardhat's compiler cache from the `solc` npm
package (fetched from the npm registry instead) so `hardhat compile`/`test` work offline. This is
a dev-environment workaround, not something to wire into CI or a normal machine with real network
access — there, just let Hardhat download the real compiler.
