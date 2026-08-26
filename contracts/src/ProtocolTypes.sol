// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

enum PricingMode {
    Limit,
    Range
}

enum MandateStatus {
    Funding,
    Open,
    Paused,
    Cancelled,
    Expired,
    Filled,
    Closed
}

enum ReservationStatus {
    Active,
    Expired,
    Settled
}

enum ReservationEligibility {
    Eligible,
    ProtocolPaused,
    MarketDisabled,
    MandateNotOpen,
    InsufficientLifetime,
    InsufficientPayoutBudget
}

struct MarketConfig {
    uint64 sourceChainKey;
    address foreignToken;
    uint8 foreignTokenDecimals;
    address settlementToken;
    uint8 settlementTokenDecimals;
    bool enabled;
}

struct Mandate {
    uint256 id;
    address buyer;
    uint256 marketId;
    address deliveryWallet;
    uint256 targetAmount;
    uint256 acquiredAmount;
    uint256 reservedAmount;
    PricingMode pricingMode;
    uint256 startPrice;
    uint256 endPrice;
    uint256 requiredFunding;
    uint64 mandateExpiry;
    uint64 reservationDuration;
    MandateStatus status;
    uint64 createdAt;
}

struct VaultAccount {
    address token;
    uint256 funded;
    uint256 spent;
    uint256 reserved;
    uint256 free;
    uint256 refunded;
}

struct Reservation {
    uint256 id;
    uint256 mandateId;
    address solver;
    uint256 quantity;
    uint256 lockedPayout;
    uint256 bondAmount;
    uint64 createdAt;
    uint64 deliveryDeadline;
    uint64 sourceStartHeight;
    uint64 sourceEndHeight;
    uint64 expiryEligibleHeight;
    ReservationStatus status;
}

struct ReservationQuote {
    uint256 mandateId;
    uint256 startPosition;
    uint256 quantity;
    uint256 endPosition;
    uint256 payout;
    uint256 bondAmount;
    uint64 reservationDuration;
    uint64 eligibleUntil;
    uint64 sourceChainKey;
    address foreignToken;
    address deliveryWallet;
    address settlementToken;
    ReservationEligibility eligibility;
}

struct BondEscrow {
    address token;
    address solver;
    uint256 amount;
    bool resolved;
}
