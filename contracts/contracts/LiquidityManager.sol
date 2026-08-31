// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ILiquidityManager} from "./ILiquidityManager.sol";

/// @title LiquidityManager
/// @notice MVP graduation target for BondingCurveMarket. Holds the migrated token + native
///         liquidity for a graduated token in escrow and emits the events the indexer needs.
/// @dev This intentionally does NOT deploy a live DEX pair: DRC-20's canonical DEX/router is
///      chain-specific and out of scope for this MVP. In production, `withdrawToRouter` is the
///      integration point where a governance multisig seeds the real DEX pool (e.g. via a
///      router's addLiquidity call) using the escrowed balances recorded here. Until that
///      happens, funds are neither lost nor tradable elsewhere — they sit in this contract under
///      the same access control as the rest of the protocol.
contract LiquidityManager is ILiquidityManager, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct MigratedLiquidity {
        uint256 tokenAmount;
        uint256 nativeAmount;
        bool withdrawn;
    }

    /// @notice The DankFactory address allowed to authorize new markets. Set once, after both
    ///          contracts exist (see deploy script), which avoids a constructor-time circular
    ///          dependency between the two.
    address public factory;

    /// @notice Markets DankFactory has actually deployed and vouched for via authorizeMarket.
    ///          This is the real authorization record -- migrateLiquidity trusts *this*, never a
    ///          value a caller reports about itself (a self-reported `factory()` claim can be
    ///          implemented by any contract, authorized or not).
    mapping(address => bool) public authorizedMarkets;

    mapping(address => MigratedLiquidity) public migratedLiquidityOf;

    event FactorySet(address indexed factory);
    event MarketAuthorized(address indexed market);
    event LiquidityMigrated(address indexed token, address indexed market, uint256 tokenAmount, uint256 nativeAmount);
    event LiquidityWithdrawn(address indexed token, address indexed to, uint256 tokenAmount, uint256 nativeAmount);

    error NotAuthorizedMarket();
    error NotFactory();
    error AlreadyMigrated();
    error AlreadyWithdrawn();
    error NothingToWithdraw();
    error NativeMismatch();
    error FactoryAlreadySet();
    error ZeroAddress();

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice One-time wiring of the trusted factory, called by protocol governance right
    ///         after DankFactory is deployed with this contract's address.
    function setFactory(address factory_) external onlyOwner {
        if (factory != address(0)) revert FactoryAlreadySet();
        if (factory_ == address(0)) revert ZeroAddress();
        factory = factory_;
        emit FactorySet(factory_);
    }

    /// @notice Called once per token by DankFactory immediately after it deploys that token's
    ///         BondingCurveMarket, so authorization comes from the factory's own deployment
    ///         record instead of anything the market (or an impersonator) claims about itself.
    function authorizeMarket(address market) external {
        if (msg.sender != factory) revert NotFactory();
        authorizedMarkets[market] = true;
        emit MarketAuthorized(market);
    }

    /// @inheritdoc ILiquidityManager
    function migrateLiquidity(
        address token,
        uint256 tokenAmount,
        uint256 nativeAmount
    ) external payable override nonReentrant {
        if (!authorizedMarkets[msg.sender]) revert NotAuthorizedMarket();
        if (msg.value != nativeAmount) revert NativeMismatch();
        if (migratedLiquidityOf[token].tokenAmount != 0 || migratedLiquidityOf[token].nativeAmount != 0) {
            revert AlreadyMigrated();
        }

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);

        migratedLiquidityOf[token] = MigratedLiquidity({
            tokenAmount: tokenAmount,
            nativeAmount: nativeAmount,
            withdrawn: false
        });

        emit LiquidityMigrated(token, msg.sender, tokenAmount, nativeAmount);
    }

    /// @notice Governance-only escape hatch to seed the real DEX pool once one exists for the
    ///         target chain. Left as an owner (multisig in production) action rather than
    ///         automated, since the router/pair address is chain-specific and not yet wired up.
    function withdrawToRouter(address token, address to) external onlyOwner nonReentrant {
        MigratedLiquidity storage liquidity = migratedLiquidityOf[token];
        if (liquidity.withdrawn) revert AlreadyWithdrawn();
        if (liquidity.tokenAmount == 0 && liquidity.nativeAmount == 0) revert NothingToWithdraw();

        liquidity.withdrawn = true;
        uint256 tokenAmount = liquidity.tokenAmount;
        uint256 nativeAmount = liquidity.nativeAmount;

        IERC20(token).safeTransfer(to, tokenAmount);
        (bool sent, ) = to.call{value: nativeAmount}("");
        require(sent, "native transfer failed");

        emit LiquidityWithdrawn(token, to, tokenAmount, nativeAmount);
    }

    receive() external payable {}
}
