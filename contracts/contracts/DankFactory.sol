// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {DankToken} from "./DankToken.sol";
import {BondingCurveMarket} from "./BondingCurveMarket.sol";
import {ILiquidityManager} from "./ILiquidityManager.sol";

/// @title DankFactory
/// @notice Single entry point for creating standardized DRC-20 memecoins. Every token created
///         through this factory shares the same fixed decimals, supply model, creation fee, and
///         bonding-curve trading configuration at the time of its creation — creators only supply
///         a name, symbol, and metadata URI. There is no per-creator parameter tuning, which keeps
///         every token's behavior predictable for traders and radically simplifies the contract
///         surface (per the MVP's "keep it extremely simple, standardize everything" principle).
contract DankFactory is Ownable, Pausable, ReentrancyGuard {
    struct CurveConfig {
        uint256 basePrice; // wei per whole token at sold = 0
        uint256 slope; // wei per whole token, per whole token sold
        uint256 curveSupplyCap; // 18-decimal tokens sellable via the curve
        uint256 graduationReserve; // 18-decimal tokens reserved for LP at graduation
        uint256 protocolFeeBps; // trading fee, in basis points, applied on both buy and sell
    }

    uint256 public constant MAX_FEE_BPS = 1_000; // 10% hard ceiling, never settable higher

    uint256 public creationFeeWei;
    address public feeRecipient;
    address public liquidityManager;
    CurveConfig public curveConfig;

    address[] public allTokens;
    mapping(address => address) public marketOf; // token => market
    mapping(address => address[]) public tokensByCreator;

    event CurveConfigured(
        uint256 basePrice,
        uint256 slope,
        uint256 curveSupplyCap,
        uint256 graduationReserve,
        uint256 protocolFeeBps
    );
    event CreationFeeUpdated(uint256 creationFeeWei);
    event FeeRecipientUpdated(address feeRecipient);
    event LiquidityManagerUpdated(address liquidityManager);
    event TokenCreated(
        address indexed token,
        address indexed market,
        address indexed creator,
        string name,
        string symbol,
        string metadataURI
    );
    event FeeCollected(address indexed recipient, uint256 amount);

    error IncorrectCreationFee();
    error FeeTooHigh();
    error ZeroAddress();
    error EmptyName();
    error EmptySymbol();

    constructor(
        address initialOwner,
        uint256 creationFeeWei_,
        address feeRecipient_,
        address liquidityManager_,
        CurveConfig memory curveConfig_
    ) Ownable(initialOwner) {
        if (feeRecipient_ == address(0) || liquidityManager_ == address(0)) revert ZeroAddress();
        if (curveConfig_.protocolFeeBps > MAX_FEE_BPS) revert FeeTooHigh();

        creationFeeWei = creationFeeWei_;
        feeRecipient = feeRecipient_;
        liquidityManager = liquidityManager_;
        curveConfig = curveConfig_;

        emit CurveConfigured(
            curveConfig_.basePrice,
            curveConfig_.slope,
            curveConfig_.curveSupplyCap,
            curveConfig_.graduationReserve,
            curveConfig_.protocolFeeBps
        );
    }

    // ---------------------------------------------------------------------
    // Governance (protocol-controlled, standardized parameters)
    // ---------------------------------------------------------------------

    function configureCurve(CurveConfig calldata newConfig) external onlyOwner {
        if (newConfig.protocolFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        curveConfig = newConfig;
        emit CurveConfigured(
            newConfig.basePrice,
            newConfig.slope,
            newConfig.curveSupplyCap,
            newConfig.graduationReserve,
            newConfig.protocolFeeBps
        );
    }

    function setCreationFee(uint256 newFeeWei) external onlyOwner {
        creationFeeWei = newFeeWei;
        emit CreationFeeUpdated(newFeeWei);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(newRecipient);
    }

    function setLiquidityManager(address newManager) external onlyOwner {
        if (newManager == address(0)) revert ZeroAddress();
        liquidityManager = newManager;
        emit LiquidityManagerUpdated(newManager);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ---------------------------------------------------------------------
    // Token creation
    // ---------------------------------------------------------------------

    function createToken(
        string calldata name,
        string calldata symbol,
        string calldata metadataURI
    ) external payable whenNotPaused nonReentrant returns (address token, address market) {
        if (bytes(name).length == 0) revert EmptyName();
        if (bytes(symbol).length == 0) revert EmptySymbol();
        if (msg.value != creationFeeWei) revert IncorrectCreationFee();

        CurveConfig memory cfg = curveConfig;

        BondingCurveMarket newMarket = new BondingCurveMarket(
            address(this),
            owner(),
            cfg.basePrice,
            cfg.slope,
            cfg.curveSupplyCap,
            cfg.graduationReserve,
            cfg.protocolFeeBps,
            feeRecipient,
            liquidityManager
        );

        DankToken newToken = new DankToken(
            name,
            symbol,
            metadataURI,
            msg.sender,
            address(newMarket),
            cfg.curveSupplyCap + cfg.graduationReserve
        );

        newMarket.initialize(address(newToken));

        token = address(newToken);
        market = address(newMarket);

        allTokens.push(token);
        marketOf[token] = market;
        tokensByCreator[msg.sender].push(token);

        _collectCreationFee();

        emit TokenCreated(token, market, msg.sender, name, symbol, metadataURI);
    }

    function _collectCreationFee() internal {
        if (msg.value == 0) return;
        (bool sent, ) = feeRecipient.call{value: msg.value}("");
        require(sent, "fee transfer failed");
        emit FeeCollected(feeRecipient, msg.value);
    }

    function totalTokens() external view returns (uint256) {
        return allTokens.length;
    }

    function creatorTokenCount(address creator) external view returns (uint256) {
        return tokensByCreator[creator].length;
    }
}
