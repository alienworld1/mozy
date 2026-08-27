export interface ProtocolDeploymentArtifact {
  schemaVersion: "3";
  environmentConfigVersion: string;
  environmentConfigHash: string;
  chainId: number;
  deployedAt: string;
  compiler: { version: "0.8.30"; optimizer: true; optimizerRuns: 200; viaIr: true; evmVersion: "shanghai" };
  protocolAdmin: string;
  deployer: string;
  contracts: {
    registry: string;
    market: string;
    vault: string;
    settlement: string;
    verifier: string;
    chainInfo: string;
    decoder: string;
  };
  marketId: "1";
  deploymentBlock: string;
  bondPolicy: { rateBps: string; cap: string; denominator: "10000" };
  sourceWindowPolicy: { acceptedBlocks: string; settlementGraceBlocks: string; bounds: "inclusive" };
  transactions: {
    registryDeployment: string;
    marketDeployment: string;
    vaultDeployment: string;
    settlementDeployment: string;
    vaultConfiguration: string;
    settlementConfiguration: string;
    marketConfiguration: string;
  };
}
