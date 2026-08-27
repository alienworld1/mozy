import { releaseConfig } from "@mozy/chain-config";

export function getNetworkName(chainId?: number) {
  if (chainId === releaseConfig.creditcoin.id) return releaseConfig.creditcoin.name;
  if (chainId === releaseConfig.foreign.id) return releaseConfig.foreign.name;
  return chainId ? `chain ID ${chainId}` : "your current network";
}

export function getSupportedNetwork(chainId?: number) {
  if (chainId === releaseConfig.creditcoin.id) return releaseConfig.creditcoin;
  if (chainId === releaseConfig.foreign.id) return releaseConfig.foreign;
  return undefined;
}
