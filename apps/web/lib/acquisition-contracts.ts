import { parseAbi, parseAbiItem } from "viem";

export const mandateCreatedEvent = parseAbiItem("event MandateCreated(uint256 indexed mandateId, address indexed buyer, uint256 indexed marketId, address deliveryWallet, uint256 targetAmount, uint8 pricingMode, uint256 startPrice, uint256 endPrice, uint256 requiredFunding, uint64 mandateExpiry, uint64 reservationDuration)");

export const reservationCreatedEvent = parseAbiItem("event ReservationCreated(uint256 indexed reservationId, uint256 indexed mandateId, address indexed solver, uint256 quantity, uint256 lockedPayout, uint256 bondAmount, uint64 deliveryDeadline, uint64 sourceStartHeight, uint64 sourceEndHeight, uint64 expiryEligibleHeight)");

export const marketAbi = parseAbi([
  "event MandateCreated(uint256 indexed mandateId, address indexed buyer, uint256 indexed marketId, address deliveryWallet, uint256 targetAmount, uint8 pricingMode, uint256 startPrice, uint256 endPrice, uint256 requiredFunding, uint64 mandateExpiry, uint64 reservationDuration)",
  "event ReservationCreated(uint256 indexed reservationId, uint256 indexed mandateId, address indexed solver, uint256 quantity, uint256 lockedPayout, uint256 bondAmount, uint64 deliveryDeadline, uint64 sourceStartHeight, uint64 sourceEndHeight, uint64 expiryEligibleHeight)",
  "function previewMandateFunding(uint256 marketId,address deliveryWallet,uint256 targetAmount,uint8 pricingMode,uint256 startPrice,uint256 endPrice,uint64 mandateExpiry,uint64 reservationDuration) view returns (uint256 requiredFunding)",
  "function createMandate(uint256 marketId,address deliveryWallet,uint256 targetAmount,uint8 pricingMode,uint256 startPrice,uint256 endPrice,uint64 mandateExpiry,uint64 reservationDuration) returns (uint256 mandateId)",
  "function getMandate(uint256 mandateId) view returns ((uint256 id,address buyer,uint256 marketId,address deliveryWallet,uint256 targetAmount,uint256 acquiredAmount,uint256 reservedAmount,uint8 pricingMode,uint256 startPrice,uint256 endPrice,uint256 requiredFunding,uint64 mandateExpiry,uint64 reservationDuration,uint8 status,uint64 createdAt))",
  "function getReservation(uint256 reservationId) view returns ((uint256 id,uint256 mandateId,address solver,uint256 quantity,uint256 lockedPayout,uint256 bondAmount,uint64 createdAt,uint64 deliveryDeadline,uint64 sourceStartHeight,uint64 sourceEndHeight,uint64 expiryEligibleHeight,uint8 status))",
  "function quoteMandate(uint256 mandateId,uint256 quantity) view returns (uint256 startPosition,uint256 payout,uint256 endPosition)",
  "function protocolPaused() view returns (bool)",
  "function fundMandate(uint256 mandateId,uint256 amount)",
  "function pauseMandate(uint256 mandateId)",
  "function resumeMandate(uint256 mandateId)",
  "function cancelMandate(uint256 mandateId)",
  "function expireMandate(uint256 mandateId)",
  "function refundMandate(uint256 mandateId,uint256 amount)",
  "function closeMandate(uint256 mandateId)",
]);

export const registryAbi = parseAbi([
  "function getMarket(uint256 marketId) view returns ((uint64 sourceChainKey,address foreignToken,uint8 foreignTokenDecimals,address settlementToken,uint8 settlementTokenDecimals,bool enabled))",
]);

export const vaultAbi = parseAbi([
  "function getAccount(uint256 mandateId) view returns ((address token,uint256 funded,uint256 spent,uint256 reserved,uint256 free,uint256 refunded))",
]);

export const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
]);
