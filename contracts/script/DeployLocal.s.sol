// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {MarketRegistry} from "../src/MarketRegistry.sol";
import {MozyMarket} from "../src/MozyMarket.sol";
import {SettlementVault} from "../src/SettlementVault.sol";
import {MozySettlement} from "../src/MozySettlement.sol";
import {MarketConfig} from "../src/ProtocolTypes.sol";
import {LocalSettlementToken} from "./LocalSettlementToken.sol";
import {ClockedChainInfo} from "../test/mocks/ClockedChainInfo.sol";
import {MockAttestcoinVerifier} from "../test/mocks/MockAttestcoinVerifier.sol";

interface ScriptVm {
    function envUint(string calldata name) external returns (uint256);
    function addr(uint256 privateKey) external returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// @notice Local-only deployment for the documented Anvil QA path.
contract DeployLocal {
    uint256 public constant BOND_RATE_BPS = 100;
    uint256 public constant BOND_CAP = 10 ether;
    ScriptVm private constant VM = ScriptVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run()
        external
        returns (
            LocalSettlementToken token,
            MarketRegistry registry,
            MozyMarket market,
            SettlementVault vault,
            MozySettlement settlement
        )
    {
        uint256 privateKey = VM.envUint("MOZY_LOCAL_PRIVATE_KEY");
        address admin = VM.addr(privateKey);
        VM.startBroadcast(privateKey);
        token = new LocalSettlementToken(admin);
        registry = new MarketRegistry(admin, 1, address(0x1234), 18, address(token), 18, keccak256("local-anvil"));
        market = new MozyMarket(admin, registry, new ClockedChainInfo(), 10, 5, BOND_RATE_BPS, BOND_CAP);
        vault = new SettlementVault(address(market));
        settlement = new MozySettlement(market, new MockAttestcoinVerifier());
        market.configureVault(vault);
        market.configureSettlementOperator(address(settlement));
        registry.configureReleaseMarket(
            MarketConfig({
                sourceChainKey: 1,
                foreignToken: address(0x1234),
                foreignTokenDecimals: 18,
                settlementToken: address(token),
                settlementTokenDecimals: 18,
                enabled: true
            })
        );
        VM.stopBroadcast();
    }
}
