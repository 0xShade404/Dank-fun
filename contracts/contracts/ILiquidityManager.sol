// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILiquidityManager {
    /// @notice Called exactly once per token by its BondingCurveMarket when the curve graduates.
    /// @dev The caller must have already transferred `tokenAmount` of `token` and sent
    ///      `msg.value` == nativeAmount alongside the call.
    function migrateLiquidity(
        address token,
        uint256 tokenAmount,
        uint256 nativeAmount
    ) external payable;
}
