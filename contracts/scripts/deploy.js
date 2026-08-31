const hre = require("hardhat");
const { ethers } = hre;

// Default protocol-standardized curve configuration. All values are wei-denominated and use
// 18-decimal token amounts unless noted otherwise. These are the same defaults the web app's
// local dev database seeds against (see web/lib/chain/config.ts) -- keep them in sync when
// changing either side.
const CREATION_FEE = ethers.parseEther("0.01");
const BASE_PRICE = 1_500_000_000n; // 1.5 gwei per whole token at sold = 0
const SLOPE = 90n; // wei per whole token, per whole token sold (~30 native total to graduate)
const CURVE_SUPPLY_CAP = ethers.parseUnits("800000000", 18); // 800M tokens sellable on the curve
const GRADUATION_RESERVE = ethers.parseUnits("200000000", 18); // 200M tokens migrated to LP
const PROTOCOL_FEE_BPS = 100n; // 1%

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
  // Owner is set to the deployer for now; DankFactory is authorized as a market-admin caller
  // via setMarketAuthorized happening per-token, but ownership itself (for withdrawToRouter)
  // stays with protocol governance, not the factory.
  const liquidityManager = await LiquidityManager.deploy(deployer.address);
  await liquidityManager.waitForDeployment();
  console.log("LiquidityManager:", await liquidityManager.getAddress());

  const DankFactory = await ethers.getContractFactory("DankFactory");
  const factory = await DankFactory.deploy(
    deployer.address,
    CREATION_FEE,
    deployer.address, // feeRecipient
    await liquidityManager.getAddress(),
    {
      basePrice: BASE_PRICE,
      slope: SLOPE,
      curveSupplyCap: CURVE_SUPPLY_CAP,
      graduationReserve: GRADUATION_RESERVE,
      protocolFeeBps: PROTOCOL_FEE_BPS,
    }
  );
  await factory.waitForDeployment();
  console.log("DankFactory:", await factory.getAddress());

  // One-time wiring so LiquidityManager trusts BondingCurveMarket instances deployed by this
  // factory (checked via each market's own immutable `factory` pointer). Ownership of
  // LiquidityManager stays with the deployer/governance multisig for `withdrawToRouter`.
  const setFactoryTx = await liquidityManager.setFactory(await factory.getAddress());
  await setFactoryTx.wait();
  console.log("LiquidityManager wired to trust DankFactory");

  console.log("\nDeployment summary:");
  console.log(
    JSON.stringify(
      {
        factory: await factory.getAddress(),
        liquidityManager: await liquidityManager.getAddress(),
        creationFeeWei: CREATION_FEE.toString(),
        curveConfig: {
          basePrice: BASE_PRICE.toString(),
          slope: SLOPE.toString(),
          curveSupplyCap: CURVE_SUPPLY_CAP.toString(),
          graduationReserve: GRADUATION_RESERVE.toString(),
          protocolFeeBps: PROTOCOL_FEE_BPS.toString(),
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
