const { expect } = require("chai");
const { ethers } = require("hardhat");

const CREATION_FEE = ethers.parseEther("0.01");
const BASE_PRICE = 1_500_000_000n; // 1.5 gwei per whole token at sold = 0
const SLOPE = 90n; // wei per whole token, per whole token sold (~30 native total to graduate)
const CURVE_SUPPLY_CAP = ethers.parseUnits("800000000", 18);
const GRADUATION_RESERVE = ethers.parseUnits("200000000", 18);
const PROTOCOL_FEE_BPS = 100n; // 1%
const BPS_DENOMINATOR = 10_000n;

async function deployProtocol() {
  const [owner, feeRecipient, creator, buyer, buyer2] = await ethers.getSigners();

  const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
  const liquidityManager = await LiquidityManager.deploy(owner.address);

  const DankFactory = await ethers.getContractFactory("DankFactory");
  const factory = await DankFactory.deploy(
    owner.address,
    CREATION_FEE,
    feeRecipient.address,
    await liquidityManager.getAddress(),
    {
      basePrice: BASE_PRICE,
      slope: SLOPE,
      curveSupplyCap: CURVE_SUPPLY_CAP,
      graduationReserve: GRADUATION_RESERVE,
      protocolFeeBps: PROTOCOL_FEE_BPS,
    }
  );

  await liquidityManager.setFactory(await factory.getAddress());

  return { owner, feeRecipient, creator, buyer, buyer2, factory, liquidityManager };
}

async function createToken(factory, creator, overrides = {}) {
  const tx = await factory
    .connect(creator)
    .createToken("Dank Coin", "DANK", "ipfs://metadata", { value: CREATION_FEE, ...overrides });
  const receipt = await tx.wait();
  const event = receipt.logs
    .map((log) => {
      try {
        return factory.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed) => parsed && parsed.name === "TokenCreated");

  const token = await ethers.getContractAt("DankToken", event.args.token);
  const market = await ethers.getContractAt("BondingCurveMarket", event.args.market);
  return { token, market, event };
}

describe("DankFactory", function () {
  it("deploys with the configured curve and fee parameters", async function () {
    const { factory } = await deployProtocol();
    expect(await factory.creationFeeWei()).to.equal(CREATION_FEE);
    const cfg = await factory.curveConfig();
    expect(cfg.basePrice).to.equal(BASE_PRICE);
    expect(cfg.slope).to.equal(SLOPE);
    expect(cfg.curveSupplyCap).to.equal(CURVE_SUPPLY_CAP);
    expect(cfg.graduationReserve).to.equal(GRADUATION_RESERVE);
    expect(cfg.protocolFeeBps).to.equal(PROTOCOL_FEE_BPS);
  });

  it("rejects token creation with an incorrect fee", async function () {
    const { factory, creator } = await deployProtocol();
    await expect(
      factory.connect(creator).createToken("Dank Coin", "DANK", "ipfs://x", { value: CREATION_FEE - 1n })
    ).to.be.revertedWithCustomError(factory, "IncorrectCreationFee");
  });

  it("rejects empty name/symbol", async function () {
    const { factory, creator } = await deployProtocol();
    await expect(
      factory.connect(creator).createToken("", "DANK", "ipfs://x", { value: CREATION_FEE })
    ).to.be.revertedWithCustomError(factory, "EmptyName");
    await expect(
      factory.connect(creator).createToken("Dank Coin", "", "ipfs://x", { value: CREATION_FEE })
    ).to.be.revertedWithCustomError(factory, "EmptySymbol");
  });

  it("creates a token + market, mints the full fixed supply to the market, and forwards the fee", async function () {
    const { factory, feeRecipient, creator } = await deployProtocol();

    const before = await ethers.provider.getBalance(feeRecipient.address);
    const { token, market, event } = await createToken(factory, creator);
    const after = await ethers.provider.getBalance(feeRecipient.address);

    expect(event.args.creator).to.equal(creator.address);
    expect(await token.creator()).to.equal(creator.address);
    expect(await token.decimals()).to.equal(18);
    expect(await token.totalSupply()).to.equal(CURVE_SUPPLY_CAP + GRADUATION_RESERVE);
    expect(await token.balanceOf(await market.getAddress())).to.equal(CURVE_SUPPLY_CAP + GRADUATION_RESERVE);
    expect(await market.token()).to.equal(await token.getAddress());
    expect(after - before).to.equal(CREATION_FEE);

    expect(await factory.totalTokens()).to.equal(1n);
    expect(await factory.marketOf(await token.getAddress())).to.equal(await market.getAddress());
  });

  it("only the owner can update creation fee / curve config / pause", async function () {
    const { factory, creator } = await deployProtocol();
    await expect(factory.connect(creator).setCreationFee(1)).to.be.revertedWithCustomError(
      factory,
      "OwnableUnauthorizedAccount"
    );
    await expect(factory.connect(creator).pause()).to.be.revertedWithCustomError(
      factory,
      "OwnableUnauthorizedAccount"
    );
  });

  it("blocks new token creation while paused", async function () {
    const { factory, owner, creator } = await deployProtocol();
    await factory.connect(owner).pause();
    await expect(
      factory.connect(creator).createToken("Dank Coin", "DANK", "ipfs://x", { value: CREATION_FEE })
    ).to.be.revertedWithCustomError(factory, "EnforcedPause");
  });
});

describe("BondingCurveMarket", function () {
  it("quotes buy cost matching the linear-curve integral", async function () {
    const { factory, creator } = await deployProtocol();
    const { market } = await createToken(factory, creator);

    const oneToken = ethers.parseUnits("1", 18);
    const [cost, fee, total] = await market.quoteBuy(oneToken);

    // First whole token: cost = basePrice*1 + slope*(1-0)/2 rounded up
    const expectedCost = BASE_PRICE + SLOPE / 2n + (SLOPE % 2n === 0n ? 0n : 1n);
    expect(cost).to.equal(expectedCost);
    expect(fee).to.equal((cost * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR);
    expect(total).to.equal(cost + fee);
  });

  it("lets a buyer purchase tokens for the exact quoted cost and refunds overpayment", async function () {
    const { factory, creator, buyer, feeRecipient } = await deployProtocol();
    const { token, market } = await createToken(factory, creator);

    const amount = ethers.parseUnits("1000", 18);
    const [, fee, total] = await market.quoteBuy(amount);

    const overpay = total + ethers.parseEther("1");
    const feeRecipientBefore = await ethers.provider.getBalance(feeRecipient.address);
    const buyerBalBefore = await ethers.provider.getBalance(buyer.address);

    const tx = await market.connect(buyer).buy(amount, total, { value: overpay });
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;

    expect(await token.balanceOf(buyer.address)).to.equal(amount);
    expect(await ethers.provider.getBalance(feeRecipient.address)).to.equal(feeRecipientBefore + fee);

    const buyerBalAfter = await ethers.provider.getBalance(buyer.address);
    // Buyer only actually spent `total` + gas, the rest of `overpay` was refunded.
    expect(buyerBalBefore - buyerBalAfter - gasCost).to.equal(total);

    expect(await market.sold()).to.equal(amount);
  });

  it("reverts a buy when the quoted cost exceeds the caller's maxNativeIn", async function () {
    const { factory, creator, buyer } = await deployProtocol();
    const { market } = await createToken(factory, creator);

    const amount = ethers.parseUnits("1000", 18);
    const [, , total] = await market.quoteBuy(amount);

    await expect(
      market.connect(buyer).buy(amount, total - 1n, { value: total })
    ).to.be.revertedWithCustomError(market, "SlippageExceeded");
  });

  it("lets a seller sell back tokens after approving the market", async function () {
    const { factory, creator, buyer } = await deployProtocol();
    const { token, market } = await createToken(factory, creator);

    const amount = ethers.parseUnits("1000", 18);
    const [, , total] = await market.quoteBuy(amount);
    await market.connect(buyer).buy(amount, total, { value: total });

    const sellAmount = ethers.parseUnits("400", 18);
    const [, , netPayout] = await market.quoteSell(sellAmount);

    await token.connect(buyer).approve(await market.getAddress(), sellAmount);
    const balBefore = await ethers.provider.getBalance(buyer.address);
    const tx = await market.connect(buyer).sell(sellAmount, netPayout);
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;
    const balAfter = await ethers.provider.getBalance(buyer.address);

    expect(balAfter - balBefore + gasCost).to.equal(netPayout);
    expect(await market.sold()).to.equal(amount - sellAmount);
    expect(await token.balanceOf(buyer.address)).to.equal(amount - sellAmount);
  });

  it("prices rise monotonically with supply sold (spot price increases after a buy)", async function () {
    const { factory, creator, buyer } = await deployProtocol();
    const { market } = await createToken(factory, creator);

    const priceBefore = await market.spotPrice();
    const amount = ethers.parseUnits("10000", 18);
    const [, , total] = await market.quoteBuy(amount);
    await market.connect(buyer).buy(amount, total, { value: total });
    const priceAfter = await market.spotPrice();

    expect(priceAfter).to.be.greaterThan(priceBefore);
  });

  it("graduates when the curve supply cap is fully sold and migrates liquidity", async function () {
    const { factory, creator, buyer, liquidityManager } = await deployProtocol();
    const { token, market } = await createToken(factory, creator);

    const [, , total] = await market.quoteBuy(CURVE_SUPPLY_CAP);
    await expect(market.connect(buyer).buy(CURVE_SUPPLY_CAP, total, { value: total }))
      .to.emit(market, "TokenGraduated");

    expect(await market.graduated()).to.equal(true);
    expect(await market.reserveBalance()).to.equal(0);
    expect(await token.balanceOf(await liquidityManager.getAddress())).to.equal(GRADUATION_RESERVE);

    const migrated = await liquidityManager.migratedLiquidityOf(await token.getAddress());
    expect(migrated.tokenAmount).to.equal(GRADUATION_RESERVE);
    expect(migrated.nativeAmount).to.be.greaterThan(0);

    // Trading halts on the curve after graduation.
    await expect(market.connect(buyer).buy(1, total, { value: total })).to.be.revertedWithCustomError(
      market,
      "AlreadyGraduated"
    );
  });

  it("rejects a buy that would exceed the remaining curve supply", async function () {
    const { factory, creator, buyer } = await deployProtocol();
    const { market } = await createToken(factory, creator);

    await expect(
      market.connect(buyer).buy(CURVE_SUPPLY_CAP + 1n, ethers.MaxUint256, { value: ethers.parseEther("40") })
    ).to.be.revertedWithCustomError(market, "CurveSupplyExceeded");
  });

  it("rejects migrateLiquidity calls from unauthorized callers", async function () {
    const { liquidityManager, buyer, creator } = await deployProtocol();
    await expect(
      liquidityManager.connect(buyer).migrateLiquidity(creator.address, 0, 0)
    ).to.be.reverted;
  });

  it("only the market's owner (protocol admin) can pause trading", async function () {
    const { factory, creator, buyer } = await deployProtocol();
    const { market } = await createToken(factory, creator);
    await expect(market.connect(buyer).pause()).to.be.revertedWithCustomError(
      market,
      "OwnableUnauthorizedAccount"
    );
  });
});
