import { id } from "ethers";

export const TRANSFER_TOPIC = id("Transfer(address,address,uint256)");
export const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
  "event Transfer(address indexed from,address indexed to,uint256 value)",
] as const;

export const PROBE_ABI = [
  "function verifyReceipt(uint64 chainKey,uint64 blockHeight,bytes encodedTransaction,(bytes32 root,(bytes32 hash,bool isLeft)[] siblings) merkleProof,(bytes32 lowerEndpointDigest,bytes32[] roots) continuityProof,uint64 expectedChainKey,address expectedToken,address expectedSender,address expectedRecipient,uint256 minimumAmount) returns (bytes32 replayIdentity)",
  "event ReceiptSemanticsAuthenticated(uint64 indexed sourceChainKey,uint64 indexed blockHeight,uint64 transactionIndex,bytes32 indexed replayIdentity,address token,address sender,address recipient,uint256 amount,uint64 transferLogIndex)",
  "error CryptographicVerificationFailed()",
  "error SourceChainMismatch(uint64 actual,uint64 expected)",
  "error UnsuccessfulReceipt()",
  "error TransactionTargetMismatch(address actual,address expected)",
  "error TransactionSenderMismatch(address actual,address expected)",
  "error TransferCallMismatch()",
  "error TransferSenderMismatch()",
  "error TransferRecipientMismatch()",
  "error TransferAmountBelowMinimum()",
  "error AmbiguousTransfer(uint256 matchingLogs)",
] as const;
