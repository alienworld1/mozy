// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MarketConfig} from "./ProtocolTypes.sol";
import {
    MarketNotConfigured,
    MarketNotEnabled,
    MarketAlreadyConfigured,
    MarketConfigurationMismatch,
    SettlementTokenHasNoCode,
    ZeroAddress
} from "./ProtocolErrors.sol";

/// @notice Curates the single immutable market definition supported by the release.
contract MarketRegistry is Ownable {
    uint256 public constant RELEASE_MARKET_ID = 1;

    uint64 public immutable pinnedSourceChainKey;
    address public immutable pinnedForeignToken;
    uint8 public immutable pinnedForeignTokenDecimals;
    address public immutable pinnedSettlementToken;
    uint8 public immutable pinnedSettlementTokenDecimals;
    bytes32 public immutable environmentConfigHash;

    bool public marketConfigured;
    MarketConfig private _market;

    event MarketConfigured(
        uint256 indexed marketId,
        uint64 sourceChainKey,
        address indexed foreignToken,
        address indexed settlementToken,
        uint8 foreignTokenDecimals,
        uint8 settlementTokenDecimals,
        bool enabled
    );
    event MarketStatusChanged(uint256 indexed marketId, bool enabled, address indexed admin);

    constructor(
        address protocolAdmin,
        uint64 sourceChainKey,
        address foreignToken,
        uint8 foreignTokenDecimals,
        address settlementToken,
        uint8 settlementTokenDecimals,
        bytes32 configHash
    ) Ownable(protocolAdmin) {
        if (protocolAdmin == address(0) || foreignToken == address(0) || settlementToken == address(0)) {
            revert ZeroAddress();
        }
        pinnedSourceChainKey = sourceChainKey;
        pinnedForeignToken = foreignToken;
        pinnedForeignTokenDecimals = foreignTokenDecimals;
        pinnedSettlementToken = settlementToken;
        pinnedSettlementTokenDecimals = settlementTokenDecimals;
        environmentConfigHash = configHash;
    }

    function configureReleaseMarket(MarketConfig calldata config) external onlyOwner returns (uint256 marketId) {
        if (marketConfigured) revert MarketAlreadyConfigured();
        if (
            config.sourceChainKey != pinnedSourceChainKey || config.foreignToken != pinnedForeignToken
                || config.foreignTokenDecimals != pinnedForeignTokenDecimals
                || config.settlementToken != pinnedSettlementToken
                || config.settlementTokenDecimals != pinnedSettlementTokenDecimals
        ) revert MarketConfigurationMismatch();
        if (config.settlementToken.code.length == 0) revert SettlementTokenHasNoCode();

        marketConfigured = true;
        _market = config;
        marketId = RELEASE_MARKET_ID;
        emit MarketConfigured(
            marketId,
            config.sourceChainKey,
            config.foreignToken,
            config.settlementToken,
            config.foreignTokenDecimals,
            config.settlementTokenDecimals,
            config.enabled
        );
    }

    function setMarketEnabled(uint256 marketId, bool enabled) external onlyOwner {
        MarketConfig storage config = _requireMarket(marketId);
        config.enabled = enabled;
        emit MarketStatusChanged(marketId, enabled, msg.sender);
    }

    function getMarket(uint256 marketId) external view returns (MarketConfig memory) {
        return _requireMarket(marketId);
    }

    function requireEnabledMarket(uint256 marketId) external view returns (MarketConfig memory config) {
        config = _requireMarket(marketId);
        if (!config.enabled) revert MarketNotEnabled();
    }

    function _requireMarket(uint256 marketId) private view returns (MarketConfig storage config) {
        if (!marketConfigured || marketId != RELEASE_MARKET_ID) revert MarketNotConfigured();
        return _market;
    }
}
