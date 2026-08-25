import { FetchRequest, JsonRpcProvider } from "ethers";
import { attestcoinEnvironment as config } from "../../config/attestcoin-environment.js";

const providerOptions = {
  batchMaxCount: 1,
  staticNetwork: true,
} as const;

export function createCreditcoinProvider(rpcUrl: string): JsonRpcProvider {
  return createProvider(rpcUrl, config.creditcoin.chainId);
}

export function createForeignProvider(rpcUrl: string): JsonRpcProvider {
  return createProvider(rpcUrl, config.foreign.chainId);
}

function createProvider(rpcUrl: string, chainId: number): JsonRpcProvider {
  const request = new FetchRequest(rpcUrl);
  request.timeout = 15_000;
  return new JsonRpcProvider(request, chainId, providerOptions);
}
