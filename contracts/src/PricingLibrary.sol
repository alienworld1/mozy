// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {PricingMode} from "./ProtocolTypes.sol";
import {
    InvalidPrice,
    InvalidTarget,
    InvalidLimitPrice,
    PricingInputOutOfBounds,
    InvalidQuantity,
    QuoteExceedsTarget,
    ZeroPayout
} from "./ProtocolErrors.sol";

/// @notice Canonical buyer-safe acquisition pricing. All token values are integer base units.
library PricingLibrary {
    uint256 internal constant MAX_TARGET_AMOUNT = 1e24;
    uint256 internal constant MAX_PRICE = 1e24;
    uint8 internal constant MAX_TOKEN_DECIMALS = 18;

    function quote(
        PricingMode mode,
        uint256 target,
        uint8 foreignTokenDecimals,
        uint256 startPrice,
        uint256 endPrice,
        uint256 startPosition,
        uint256 quantity
    ) internal pure returns (uint256 payout) {
        validateTerms(mode, target, foreignTokenDecimals, startPrice, endPrice);
        if (quantity == 0) revert InvalidQuantity();
        if (startPosition > target || quantity > target - startPosition) revert QuoteExceedsTarget();

        uint256 unit = 10 ** foreignTokenDecimals;
        if (mode == PricingMode.Limit || startPrice == endPrice) {
            payout = Math.mulDiv(startPrice, quantity, unit);
        } else {
            // Bounds above make each exact rational term and their sum fit uint256.
            // a * (2x + a) is exactly (x+a)^2 - x^2 without squaring positions.
            uint256 baseNumerator = 2 * startPrice * target * quantity;
            uint256 curveNumerator =
                _absoluteDifference(startPrice, endPrice) * quantity * (2 * startPosition + quantity);
            uint256 numerator = endPrice > startPrice ? baseNumerator + curveNumerator : baseNumerator - curveNumerator;
            payout = Math.mulDiv(numerator, 1, 2 * target * unit);
        }

        if (payout == 0) revert ZeroPayout();
    }

    function validateTerms(
        PricingMode mode,
        uint256 target,
        uint8 foreignTokenDecimals,
        uint256 startPrice,
        uint256 endPrice
    ) internal pure {
        if (target == 0) revert InvalidTarget();
        if (startPrice == 0 || endPrice == 0) revert InvalidPrice();
        if (mode == PricingMode.Limit && startPrice != endPrice) revert InvalidLimitPrice();
        if (
            target > MAX_TARGET_AMOUNT || startPrice > MAX_PRICE || endPrice > MAX_PRICE
                || foreignTokenDecimals > MAX_TOKEN_DECIMALS
        ) {
            revert PricingInputOutOfBounds();
        }
    }

    function _absoluteDifference(uint256 a, uint256 b) private pure returns (uint256) {
        return a > b ? a - b : b - a;
    }
}
