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
