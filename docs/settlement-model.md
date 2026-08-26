# Mandate settlement model

The Mozy protocol establishes a funded Acquisition Mandate and an exclusive solver reservation on Creditcoin. They do not verify foreign receipts or settle a solver; those transitions begin soon.

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

The mandate's `requiredFunding` is the full-target quote from position zero. There is no protocol fee as of now.

## Canonical accounting

`SettlementVault` owns custody and mandate-level budget state. `funded`, `spent`, and `refunded` are cumulative history. `reserved` and `free` are currently held capital.

```text
funded = spent + reserved + free + refunded
vault token balance >= sum(reserved + free) + unresolved solver bonds for that token
```

Funding measures the vault balance before and after `transferFrom` and accepts only the exact requested increase. Refund and the future-only spend seam update accounting before transferring and verify exact decreases and recipient increases. Fee-on-transfer, short-transfer, false-return, and incompatible callback behavior revert the complete transaction.

Direct token transfers to the vault remain unaccounted and cannot fund a mandate. There is deliberately no admin sweep or balance override.

## Reservation and bond accounting

A reservation prices the interval beginning at `acquiredAmount + reservedAmount`. Creation recomputes that price on-chain and requires the solver's reviewed `expectedPayout` to match. It then moves the exact payout from `free` to `reserved`, increases mandate `reservedAmount`, and pulls a solver bond in the same transaction.

The deployed bond policy is immutable:

```text
bond = min(floor(lockedPayout * rateBps / 10,000), cap)
```

The current reservation bond policy is 100 basis points with a 10 BTKT cap. A result of zero is rejected. Bonds use the mandate settlement token but remain in reservation-isolated escrow; they never enter `funded`, `free`, `reserved`, `spent`, or `refunded`.

Anyone may expire an unresolved reservation once its Creditcoin deadline has passed and the authenticated source head has reached its immutable expiry-eligibility height. Expiry atomically subtracts its quantity, moves its payout from `reserved` back to `free`, and transfers its bond to the stored mandate buyer. This works while the mandate is open, paused, cancelled, or expired and never changes the parent mandate status.

`accountedTokenBalance(token)` includes both mandate custody and unresolved bonds. `unresolvedBondBalance(token)` exposes the bond portion independently. Direct transfers remain outside both figures.

## Authenticated delivery timing decision

The protocol uses source heights exclusively for delivery authority. The pinned
`INativeQueryVerifier.verify` call authenticates the proof's `chainKey` and `height`, while
ChainInfo's official `get_latest_attestation_height_and_hash(uint64)` precompile call supplies
the latest authenticated source boundary. No source RPC timestamp, average block-time
conversion, relayer value, or Creditcoin/source clock comparison participates in settlement.

When a reservation is mined, `MozyMarket` reads the latest attested height `H` for its immutable
source chain. The accepted source window is `[H + 1, H + W]`, inclusive at both ends, where `W`
is the deployment's immutable positive source-window span. This defines “on time” in the only
ordering domain authenticated on Creditcoin: the receipt must be beyond the attested history
captured by the reservation and no later than its stored upper source boundary. The solver
cannot supply or edit any boundary.

The Creditcoin `deliveryDeadline` remains a displayed minimum commitment deadline, but it is
not compared to a source occurrence. Permissionless expiry requires both:

- Creditcoin block time at or after `deliveryDeadline`; and
- the latest officially attested source height at or beyond `sourceEndHeight + G`.

`G` is an immutable positive settlement-grace span. Once the attested head reaches the source
window's end, every accepted source height is within the official proof boundary; the added
grace range then provides a deterministic proof-submission interval. A proof at either source
boundary can settle during that interval even after the displayed deadline. A proof above the
upper boundary always fails. At expiry eligibility, EVM serialization makes expiry and
settlement mutually exclusive: exactly one terminal transition can succeed, with no double
payout, bond resolution, or receipt consumption.

This policy required a fresh deployment. Reservations now store `sourceStartHeight`,
`sourceEndHeight`, and `expiryEligibleHeight`; expiry reads ChainInfo instead of relying on the
Creditcoin deadline alone. The policy spans, ChainInfo address, verifier, and decoder are fixed
at deployment and recorded publicly. Earlier deployments are historical only and cannot be
treated as proof-settlement capable.

## Ownership and lifecycle

Only the mandate buyer may fund, pause, resume, cancel, or request a refund. Refunds always return to the stored buyer. Closing is permissionless only after a terminal mandate has no reserved quantity, reserved budget, or refundable free budget.

```text
Funding -> Open -> Paused -> Open
   |         |        |
   +---------+--------+-> Cancelled -> Closed
   +--------------------> Expired   -> Closed
```

Expiry is permissionless after both authenticated eligibility conditions pass. Cancellation and expiry expose only free capital for refund. Disabling the market or pausing the protocol blocks new risk—creation, further funding, and resume—but never blocks cancellation, eligible refund, closing, settlement, or reads.

The registry definition, mandate immutable terms, lifecycle state, and vault accounts are all on-chain sources of truth. The deployment artifact and TypeScript math are verification aids only.
