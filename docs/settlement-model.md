# Mandate settlement model

Module 2 establishes one funded Acquisition Mandate on Creditcoin. It does not create reservations, verify foreign receipts, or settle a solver. Those transitions begin in Modules 3 and 4.

## Pricing units and rounding

All values are unsigned integer base units. For the release market, both TEST and BTKT use 18 decimals.

- `Q`: target TEST base units
- `u`: `10 ^ foreignTokenDecimals`
- `x`: acquired plus actively reserved TEST base units before an interval
- `a`: interval quantity in TEST base units
- `Ps`, `Pe`: BTKT base units paid per one whole TEST at positions zero and `Q`

Limit pricing requires `Ps == Pe` and returns `floor(Ps * a / u)`.

Range pricing follows the marginal line `P(q) = Ps + (Pe - Ps) * q / Q`. The contract calculates the exact interval area in one rational expression:

```text
floor((2 * Ps * Q * a + (Pe - Ps) * a * (2 * x + a)) / (2 * Q * u))
```

Increasing and decreasing ranges use separate unsigned branches. There is one final downward rounding operation; marginal prices are never rounded first. Equal Range endpoints produce the same result as Limit pricing. A positive interval whose payout rounds to zero is rejected.

Targets and endpoint prices are each capped at `10^24`; foreign-token decimals are capped at 18. At those bounds, every exact Range numerator term and their sum fit within `uint256`. Division uses OpenZeppelin `Math.mulDiv`. The independent TypeScript implementation uses `bigint` and shares no production arithmetic helper.

The mandate's `requiredFunding` is the full-target quote from position zero. There is no protocol fee in Module 2.

## Canonical accounting

`SettlementVault` owns custody and mandate-level budget state. `funded`, `spent`, and `refunded` are cumulative history. `reserved` and `free` are currently held capital.

```text
funded = spent + reserved + free + refunded
vault token balance >= sum(reserved + free) for that token
```

Funding measures the vault balance before and after `transferFrom` and accepts only the exact requested increase. Refund and the future-only spend seam update accounting before transferring and verify exact decreases and recipient increases. Fee-on-transfer, short-transfer, false-return, and incompatible callback behavior revert the complete transaction.

Direct token transfers to the vault remain unaccounted and cannot fund a mandate. There is deliberately no admin sweep or balance override.

## Ownership and lifecycle

Only the mandate buyer may fund, pause, resume, cancel, or request a refund. Refunds always return to the stored buyer. Closing is permissionless only after a terminal mandate has no reserved quantity, reserved budget, or refundable free budget.

```text
Funding -> Open -> Paused -> Open
   |         |        |
   +---------+--------+-> Cancelled -> Closed
   +--------------------> Expired   -> Closed
```

Expiry is permissionless after the deadline. Cancellation and expiry expose only free capital for refund. Disabling the market or pausing the protocol blocks new risk—creation, further funding, and resume—but never blocks cancellation, eligible refund, closing, or reads.

The registry definition, mandate immutable terms, lifecycle state, and vault accounts are all on-chain sources of truth. The deployment artifact and TypeScript math are verification aids only.
