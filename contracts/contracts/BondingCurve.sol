// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BondingCurve
/// @notice Pure, deterministic math for a linear bonding curve: price(s) = basePrice + slope * s,
///         where `s` is the number of *whole* tokens already sold on the curve (18-decimal token
///         amounts are converted to whole-token units before being fed into this library).
/// @dev Cost to buy from s0 -> s1 is the definite integral of price(s) over [s0, s1]:
///        cost = basePrice * (s1 - s0) + slope * (s1^2 - s0^2) / 2
///      All settlement-relevant rounding favors the protocol/curve (buyers round up cost,
///      sellers round down payout) so no path lets a caller extract value from rounding.
library BondingCurve {
    uint256 internal constant WAD = 1e18;

    error AmountZero();
    error InsufficientSupply();

    /// @notice Quote the native-currency cost to buy `tokenAmount` (18-decimal) tokens starting
    ///         from `soldTokenAmount` (18-decimal) already sold.
    function quoteBuy(
        uint256 basePrice,
        uint256 slope,
        uint256 soldTokenAmount,
        uint256 tokenAmount
    ) internal pure returns (uint256 cost) {
        if (tokenAmount == 0) revert AmountZero();

        uint256 s0 = soldTokenAmount / WAD;
        uint256 s1 = (soldTokenAmount + tokenAmount) / WAD;

        // Round the whole-token window up so fractional remainders are never sold for free.
        if ((soldTokenAmount + tokenAmount) % WAD != 0) {
            s1 += 1;
        }

        cost = _integralCost(basePrice, slope, s0, s1, true);

        // Round the buyer's cost up in the protocol's favor.
        if (cost == 0 && tokenAmount > 0) {
            cost = 1;
        }
    }

    /// @notice Quote the native-currency payout for selling `tokenAmount` (18-decimal) tokens
    ///         when `soldTokenAmount` (18-decimal) have been sold so far.
    function quoteSell(
        uint256 basePrice,
        uint256 slope,
        uint256 soldTokenAmount,
        uint256 tokenAmount
    ) internal pure returns (uint256 payout) {
        if (tokenAmount == 0) revert AmountZero();
        if (tokenAmount > soldTokenAmount) revert InsufficientSupply();

        uint256 s1 = soldTokenAmount / WAD;
        uint256 s0 = (soldTokenAmount - tokenAmount) / WAD;

        // Floor the payout so the curve never pays out more than the continuous integral.
        payout = _integralCost(basePrice, slope, s0, s1, false);
    }

    /// @dev cost = basePrice * (s1 - s0) + slope * (s1^2 - s0^2) / 2, computed without
    ///      intermediate underflow. `roundUp` controls which way the quadratic term's integer
    ///      division rounds: true for buy costs (protocol never undercharges), false for sell
    ///      payouts (protocol never overpays) -- both directions favor the protocol/curve.
    function _integralCost(
        uint256 basePrice,
        uint256 slope,
        uint256 s0,
        uint256 s1,
        bool roundUp
    ) private pure returns (uint256) {
        uint256 linear = basePrice * (s1 - s0);
        uint256 quadraticNumerator = slope * ((s1 * s1) - (s0 * s0));
        uint256 quadratic = quadraticNumerator / 2;
        if (roundUp && quadraticNumerator % 2 != 0) {
            quadratic += 1;
        }
        return linear + quadratic;
    }

    /// @notice Instantaneous spot price (native per whole token) at a given sold amount.
    function spotPrice(uint256 basePrice, uint256 slope, uint256 soldTokenAmount) internal pure returns (uint256) {
        return basePrice + slope * (soldTokenAmount / WAD);
    }
}
