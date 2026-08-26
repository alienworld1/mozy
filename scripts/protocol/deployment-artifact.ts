export interface ProtocolDeploymentArtifact {
  schemaVersion: "1";
  environmentConfigVersion: string;
  environmentConfigHash: string;
  chainId: number;
  deployedAt: string;
  compiler: { version: "0.8.30"; optimizer: true; optimizerRuns: 200; viaIr: true; evmVersion: "shanghai" };
  protocolAdmin: string;
  deployer: string;
  contracts: { registry: string; market: string; vault: string };
  marketId: "1";
  transactions: {
    registryDeployment: string;
    marketDeployment: string;
    vaultDeployment: string;
    vaultConfiguration: string;
    marketConfiguration: string;
  };
}
