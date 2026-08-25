export const attestcoinEnvironment = {
  configVersion: "attestcoin-spike-cc3-sepolia-2026-08-25",
  // Live-read-only pin check; receipt-proof completion is tracked separately by the evidence manifest.
  verifiedAt: "2026-08-25T03:32:00.000Z",
  creditcoin: {
    name: "Creditcoin CC3 Testnet",
    chainId: 102031,
    rpcEnv: "CREDITCOIN_RPC_URL",
    explorerUrl: "https://creditcoin-testnet.blockscout.com",
    nativeCurrency: { symbol: "tCTC", decimals: 18 },
  },
  foreign: {
    name: "Ethereum Sepolia",
    chainId: 11155111,
    sourceChainKey: 1,
    rpcEnv: "FOREIGN_RPC_URL",
    explorerUrl: "https://sepolia.etherscan.io",
    finalityOrAttestationRule: {
      kind: "attested-height",
      description:
        "Proof generation is ready only after the CC3 proof builder reports an attested height at or above the source block.",
      pollIntervalMs: 15_000,
    },
  },
  deliveryToken: {
    address: "0x0F24FD9e0524BA53d3f0A4A40350Adf5370b4A53",
    symbol: "TEST",
    decimals: 18,
    fundingMethod:
      "Call mint(uint256) on the official example TestERC20 using the disposable Sepolia account.",
    behavior: "standard-erc20",
  },
  settlementToken: {
    address: "0x914Cf96BF28b7b4921db27b264ecEd71aC91134E",
    symbol: "BTKT",
    decimals: 18,
    fundingMethod:
      "Follow the official Hello Bridge testnet flow; successful verified burns mint BTKT to the disposable CC3 account.",
  },
  attestcoin: {
    architectureVersion: "USC v2 (Attestcoin Protocol Readability)",
    verifierAddress: "0x0000000000000000000000000000000000000FD2",
    chainInfoAddress: "0x0000000000000000000000000000000000000fD3",
    decoderAddress: "0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f",
    contractsPackage: "@gluwa/usc-contracts@0.1.2",
    sdkPackage: "@gluwa/usc-sdk@0.18.0",
    proofBuilderEnv: "ATTESTCOIN_PROOF_BUILDER_URL",
    probeAddressEnv: "ATTESTCOIN_PROBE_ADDRESS",
    interfaceFunctions: [
      "verify(uint64,uint64,bytes,(bytes32,(bytes32,bool)[]),(bytes32,bytes32[]))",
      "verifyAndEmit(uint64,uint64,bytes,(bytes32,(bytes32,bool)[]),(bytes32,bytes32[]))",
      "calculateTxIndex((bytes32,(bytes32,bool)[]))",
    ],
    decoder: "@gluwa/usc-contracts@0.1.2 EvmV1Decoder",
    upstream: {
      repository: "https://github.com/gluwa/usc-testnet-bridge-examples",
      commit: "4ff9a3bf5d7fa8dbfec34ae9726d3f81405dca7b",
    },
  },
  officialSourceRefs: [
    "https://docs.creditcoin.org/environments/testnet",
    "https://docs.creditcoin.org/attestcoin-protocol/attestcoin-protocol-chains-environments",
    "https://docs.creditcoin.org/attestcoin-protocol/dapp-builder-infrastructure/attestcoin-sdk-usc-sdk",
    "https://docs.creditcoin.org/attestcoin-protocol/dapp-builder-infrastructure/attestcoin-smart-contracts",
    "https://github.com/gluwa/usc-testnet-bridge-examples/tree/4ff9a3bf5d7fa8dbfec34ae9726d3f81405dca7b",
  ],
} as const;

export type AttestcoinEnvironment = typeof attestcoinEnvironment;
