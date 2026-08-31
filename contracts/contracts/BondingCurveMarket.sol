// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BondingCurve} from "./BondingCurve.sol";
import {ILiquidityManager} from "./ILiquidityManager.sol";

/// @title BondingCurveMarket
/// @notice One instance per token, deployed by DankFactory. Holds the token's entire curve +
///         graduation-reserve supply and is the sole venue for buying/selling that token until it
///         graduates, at which point remaining liquidity migrates to the LiquidityManager and the
///         curve stops accepting trades (the token becomes DEX-tradable instead). Curve pricing
///         parameters are a snapshot taken at deployment time from the factory's global config, so
///         a later `DankFactory.configureCurve` call never retroactively changes an already-live
///         token's curve — every token's trading configuration is standardized and fixed for its
///         lifetime, per the "no arbitrary changes after launch" principle.
contract BondingCurveMarket is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    uint256 internal constant WAD = 1e18;
    uint256 internal constant BPS_DENOMINATOR = 10_000;

    address public immutable factory;
    address public token;

    uint256 public immutable basePrice; // wei per whole token at sold = 0
    uint256 public immutable slope; // wei per whole token, per whole token sold
    uint256 public immutable curveSupplyCap; // 18-decimal tokens sellable via the curve
    uint256 public immutable graduationReserve; // 18-decimal tokens reserved for LP at graduation
    uint256 public immutable protocolFeeBps;
    address public immutable feeRecipient;
    ILiquidityManager public immutable liquidityManager;

    uint256 public sold; // cumulative 18-decimal tokens sold via the curve
    uint256 public reserveBalance; // native currently held by the curve, backing `sold`
    bool public graduated;

    event Initialized(address indexed token);
    event TradeExecuted(
        address indexed trader,
        bool indexed isBuy,
        uint256 tokenAmount,
        uint256 nativeAmount,
        uint256 fee,
        uint256 newSold,
        uint256 newSpotPrice
    );
    event TokenGraduated(address indexed token, uint256 nativeToLiquidity, uint256 tokensToLiquidity);
    event FeeCollected(address indexed recipient, uint256 amount);

    error AlreadyInitialized();
    error NotFactory();
    error NotInitialized();
    error AlreadyGraduated();
    error CurveSupplyExceeded();
    error SlippageExceeded();
    error InsufficientPayment();
    error ZeroAmount();

    modifier onlyFactory() {
        if (msg.sender != factory) revert NotFactory();
        _;
    }

    modifier notGraduated() {
        if (graduated) revert AlreadyGraduated();
        _;
    }

    constructor(
        address factory_,
        address admin_,
        uint256 basePrice_,
        uint256 slope_,
        uint256 curveSupplyCap_,
        uint256 graduationReserve_,
        uint256 protocolFeeBps_,
        address feeRecipient_,
        address liquidityManager_
    ) Ownable(admin_) {
        factory = factory_;
        basePrice = basePrice_;
        slope = slope_;
        curveSupplyCap = curveSupplyCap_;
        graduationReserve = graduationReserve_;
        protocolFeeBps = protocolFeeBps_;
        feeRecipient = feeRecipient_;
        liquidityManager = ILiquidityManager(liquidityManager_);
    }

    /// @notice One-time wiring of the token address, called by the factory right after it
    ///         deploys the DankToken that mints its full supply to this market.
    function initialize(address token_) external onlyFactory {
        if (token != address(0)) revert AlreadyInitialized();
        token = token_;
        emit Initialized(token_);
    }

    // ---------------------------------------------------------------------
    // Quotes
    // ---------------------------------------------------------------------

    /// @notice Exact on-chain cost to buy `tokenAmount` at the current curve state.
    function quoteBuy(uint256 tokenAmount) public view returns (uint256 cost, uint256 fee, uint256 totalCost) {
        cost = BondingCurve.quoteBuy(basePrice, slope, sold, tokenAmount);
        fee = (cost * protocolFeeBps) / BPS_DENOMINATOR;
        totalCost = cost + fee;
    }

    /// @notice Exact on-chain payout for selling `tokenAmount` at the current curve state.
    function quoteSell(uint256 tokenAmount) public view returns (uint256 payout, uint256 fee, uint256 netPayout) {
        payout = BondingCurve.quoteSell(basePrice, slope, sold, tokenAmount);
        fee = (payout * protocolFeeBps) / BPS_DENOMINATOR;
        netPayout = payout - fee;
    }

    function spotPrice() public view returns (uint256) {
        return BondingCurve.spotPrice(basePrice, slope, sold);
    }

    function remainingCurveSupply() public view returns (uint256) {
        return curveSupplyCap - sold;
    }

    function curveProgressBps() public view returns (uint256) {
        if (curveSupplyCap == 0) return 0;
        return (sold * BPS_DENOMINATOR) / curveSupplyCap;
    }

    // ---------------------------------------------------------------------
    // Trading
    // ---------------------------------------------------------------------

    /// @notice Buy an exact `tokenAmount` of tokens. Caller must send >= the exact quoted total
    ///         cost as `msg.value`; any excess is refunded. `maxNativeIn` is redundant slippage
    ///         protection against a stale quote (curve moved between quote and submission).
    function buy(
        uint256 tokenAmount,
        uint256 maxNativeIn
    ) external payable nonReentrant whenNotPaused notGraduated {
        if (token == address(0)) revert NotInitialized();
        if (tokenAmount == 0) revert ZeroAmount();
        if (tokenAmount > remainingCurveSupply()) revert CurveSupplyExceeded();

        (uint256 cost, uint256 fee, uint256 totalCost) = quoteBuy(tokenAmount);
        if (totalCost > maxNativeIn) revert SlippageExceeded();
        if (msg.value < totalCost) revert InsufficientPayment();

        sold += tokenAmount;
        reserveBalance += cost;

        IERC20(token).safeTransfer(msg.sender, tokenAmount);

        if (fee > 0) {
            (bool feeSent, ) = feeRecipient.call{value: fee}("");
            require(feeSent, "fee transfer failed");
            emit FeeCollected(feeRecipient, fee);
        }

        uint256 refund = msg.value - totalCost;
        if (refund > 0) {
            (bool refunded, ) = msg.sender.call{value: refund}("");
            require(refunded, "refund failed");
        }

        emit TradeExecuted(msg.sender, true, tokenAmount, cost, fee, sold, spotPrice());

        if (sold == curveSupplyCap) {
            _graduate();
        }
    }

    /// @notice Sell an exact `tokenAmount` of tokens back to the curve. Requires prior
    ///         `token.approve(market, tokenAmount)`.
    function sell(
        uint256 tokenAmount,
        uint256 minNativeOut
    ) external nonReentrant whenNotPaused notGraduated {
        if (token == address(0)) revert NotInitialized();
        if (tokenAmount == 0) revert ZeroAmount();

        (uint256 payout, uint256 fee, uint256 netPayout) = quoteSell(tokenAmount);
        if (netPayout < minNativeOut) revert SlippageExceeded();

        sold -= tokenAmount;
        reserveBalance -= payout;

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);

        if (fee > 0) {
            (bool feeSent, ) = feeRecipient.call{value: fee}("");
            require(feeSent, "fee transfer failed");
            emit FeeCollected(feeRecipient, fee);
        }

        (bool sent, ) = msg.sender.call{value: netPayout}("");
        require(sent, "payout failed");

        emit TradeExecuted(msg.sender, false, tokenAmount, payout, fee, sold, spotPrice());
    }

    function _graduate() internal {
        graduated = true;

        uint256 nativeToLiquidity = reserveBalance;
        uint256 tokensToLiquidity = graduationReserve;
        reserveBalance = 0;

        IERC20(token).forceApprove(address(liquidityManager), tokensToLiquidity);
        liquidityManager.migrateLiquidity{value: nativeToLiquidity}(token, tokensToLiquidity, nativeToLiquidity);

        emit TokenGraduated(token, nativeToLiquidity, tokensToLiquidity);
    }

    /// @notice Emergency pause for new trades, controlled by protocol governance (the admin
    ///         address the factory deployed this market with — a multisig in production).
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
