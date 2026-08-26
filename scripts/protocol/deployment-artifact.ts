export interface ProtocolDeploymentArtifact {
  schemaVersion: "2";
  environmentConfigVersion: string;
  environmentConfigHash: string;
  chainId: number;
  deployedAt: string;
  compiler: { version: "0.8.30"; optimizer: true; optimizerRuns: 200; viaIr: true; evmVersion: "shanghai" };
  protocolAdmin: string;
  deployer: string;
  contracts: { registry: string; market: string; vault: string };
  marketId: "1";
  bondPolicy: { rateBps: string; cap: string; denominator: "10000" };
  transactions: {
    registryDeployment: string;
    marketDeployment: string;
    vaultDeployment: string;
    vaultConfiguration: string;
    marketConfiguration: string;
  };
}
