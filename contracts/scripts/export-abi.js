// Copies compiled ABIs into web/lib/chain/abi so the frontend's contract calls always match
// the currently-compiled contracts. Run after `npm run compile` whenever a contract's
// interface changes.
const fs = require("fs");
const path = require("path");

const CONTRACTS = ["DankFactory", "BondingCurveMarket", "DankToken", "LiquidityManager"];
const outDir = path.join(__dirname, "..", "..", "web", "lib", "chain", "abi");
fs.mkdirSync(outDir, { recursive: true });

for (const name of CONTRACTS) {
  const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", `${name}.sol`, `${name}.json`);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(artifact.abi, null, 2));
  console.log(`Exported ${name} ABI`);
}
