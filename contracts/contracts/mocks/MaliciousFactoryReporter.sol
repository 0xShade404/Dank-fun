// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILiquidityManagerLike {
    function migrateLiquidity(address token, uint256 tokenAmount, uint256 nativeAmount) external payable;
}

/// @notice Test-only contract that reproduces the LiquidityManager authorization bypass this
///         repo's contracts previously had: it self-reports whatever `factory` address it was
///         constructed with, exactly like a real BondingCurveMarket does, but was never actually
///         deployed or authorized by DankFactory. Used to prove migrateLiquidity() now rejects
///         callers based on DankFactory's own authorizeMarket() record, not a self-reported
///         claim. Not deployed in production.
contract MaliciousFactoryReporter {
    address public factory;

    constructor(address factory_) {
        factory = factory_;
    }

    function attack(address liquidityManager, address token, uint256 tokenAmount, uint256 nativeAmount) external payable {
        ILiquidityManagerLike(liquidityManager).migrateLiquidity{value: msg.value}(token, tokenAmount, nativeAmount);
    }
}
