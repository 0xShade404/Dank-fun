// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BondingCurve} from "../BondingCurve.sol";

/// @notice Test-only external wrapper around the internal BondingCurve library functions, so
///         its rounding behavior can be exercised directly without deploying a full market.
///         Not deployed in production.
contract BondingCurveHarness {
    function quoteBuy(
        uint256 basePrice,
        uint256 slope,
        uint256 soldTokenAmount,
        uint256 tokenAmount
    ) external pure returns (uint256) {
        return BondingCurve.quoteBuy(basePrice, slope, soldTokenAmount, tokenAmount);
    }

    function quoteSell(
        uint256 basePrice,
        uint256 slope,
        uint256 soldTokenAmount,
        uint256 tokenAmount
    ) external pure returns (uint256) {
        return BondingCurve.quoteSell(basePrice, slope, soldTokenAmount, tokenAmount);
    }
}
