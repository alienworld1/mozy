import { solidityPackedKeccak256 } from "ethers";

export function deriveReplayIdentity(chainKey: bigint, blockHeight: bigint, transactionIndex: bigint): `0x${string}` {
  return solidityPackedKeccak256(
    ["uint256", "uint64", "uint256"],
    [chainKey, blockHeight, transactionIndex],
  ) as `0x${string}`;
}
