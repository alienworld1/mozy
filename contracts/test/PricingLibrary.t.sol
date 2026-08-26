// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {TestBase} from "./TestBase.sol";
import {PricingLibrary} from "../src/PricingLibrary.sol";
import {PricingMode} from "../src/ProtocolTypes.sol";
import {InvalidQuantity, QuoteExceedsTarget, ZeroPayout} from "../src/ProtocolErrors.sol";

contract PricingHarness {
    function quote(
        PricingMode mode,
        uint256 target,
        uint8 decimals,
        uint256 startPrice,
        uint256 endPrice,
        uint256 start,
        uint256 quantity
    ) external pure returns (uint256) {
        return PricingLibrary.quote(mode, target, decimals, startPrice, endPrice, start, quantity);
    }
}

contract PricingLibraryTest is TestBase {
    PricingHarness private pricing = new PricingHarness();
    uint256 private constant UNIT = 1e18;

    function testReferenceFixtures() external view {
        assertEq(pricing.quote(PricingMode.Limit, 3 * UNIT, 18, 2 * UNIT, 2 * UNIT, 0, 1), 2);
        assertEq(pricing.quote(PricingMode.Limit, 3 * UNIT, 18, 2 * UNIT, 2 * UNIT, 0, 3 * UNIT), 6 * UNIT);
        assertEq(pricing.quote(PricingMode.Range, 4 * UNIT, 18, 2 * UNIT, 6 * UNIT, 0, 4 * UNIT), 16 * UNIT);
        assertEq(pricing.quote(PricingMode.Range, 4 * UNIT, 18, 2 * UNIT, 6 * UNIT, 0, UNIT), 5 * UNIT / 2);
        assertEq(pricing.quote(PricingMode.Range, 4 * UNIT, 18, 2 * UNIT, 6 * UNIT, 3 * UNIT, UNIT), 11 * UNIT / 2);
        assertEq(pricing.quote(PricingMode.Range, 4 * UNIT, 18, 2 * UNIT, 6 * UNIT, UNIT, 2 * UNIT), 8 * UNIT);
        assertEq(pricing.quote(PricingMode.Range, 4 * UNIT, 18, 6 * UNIT, 2 * UNIT, 0, UNIT), 11 * UNIT / 2);
        assertEq(pricing.quote(PricingMode.Range, 4 * UNIT, 18, 6 * UNIT, 2 * UNIT, 3 * UNIT, UNIT), 5 * UNIT / 2);
        assertEq(pricing.quote(PricingMode.Range, 3, 0, 2, 5, 1, 1), 3);
        assertEq(pricing.quote(PricingMode.Range, 1e24, 18, 1e24, 1, 0, 1e24), 500000000000000000000000500000);
    }

    function testRejectsInvalidIntervals() external {
        vm.expectRevert(InvalidQuantity.selector);
        pricing.quote(PricingMode.Range, 10, 0, 1, 2, 0, 0);
        vm.expectRevert(QuoteExceedsTarget.selector);
        pricing.quote(PricingMode.Range, 10, 0, 1, 2, 9, 2);
        vm.expectRevert(ZeroPayout.selector);
        pricing.quote(PricingMode.Range, 10, 18, 1, 1, 0, 1);
    }

    function testFuzzEqualRangeMatchesLimit(uint96 rawTarget, uint96 rawPrice, uint96 rawStart, uint96 rawQuantity)
        external
        view
    {
        uint256 target = uint256(rawTarget) % 1e24 + 1;
        uint256 price = uint256(rawPrice) % (1e24 - 1e18) + 1e18;
        uint256 start = uint256(rawStart) % target;
        uint256 quantity = uint256(rawQuantity) % (target - start) + 1;
        uint256 limit = pricing.quote(PricingMode.Limit, target, 18, price, price, start, quantity);
        uint256 range = pricing.quote(PricingMode.Range, target, 18, price, price, start, quantity);
        assertEq(range, limit);
    }
}
