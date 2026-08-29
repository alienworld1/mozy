# Attestcoin receipt-proof validation

The receipt-proof validation is an operator-only integration gate. It sends one ordinary ERC-20 transfer on Ethereum Sepolia, obtains the current official Attestcoin proof, and verifies and decodes that receipt on Creditcoin CC3 Testnet. It does not add a web screen or deploy any Mozy contract on Sepolia.

The committed evidence manifest is backed by a real Sepolia receipt and CC3 verification transaction. Revalidate it with `pnpm attestcoin:evidence:check`; a manual marker is not accepted.

## Pinned environment

The single source of public configuration is `config/attestcoin-environment.ts`.

| Role | Pin |
| --- | --- |
| Creditcoin execution chain | CC3 Testnet, EVM chain ID `102031` |
| Creditcoin RPC variable | `CREDITCOIN_RPC_URL` |
| Creditcoin explorer | `https://creditcoin-testnet.blockscout.com` |
| Foreign source chain | Ethereum Sepolia, EVM chain ID `11155111` |
| Attestcoin source chain key | `1`, independently checked through ChainInfo |
| Foreign RPC variable | `FOREIGN_RPC_URL` |
| Foreign explorer | `https://sepolia.etherscan.io` |
| Delivery token | Official example TEST at `0x0F24FD9e0524BA53d3f0A4A40350Adf5370b4A53`, 18 decimals |
| Settlement token pin | Official example BTKT at `0x914Cf96BF28b7b4921db27b264ecEd71aC91134E`, 18 decimals |
| Block Prover / Native Query Verifier | `0x0000000000000000000000000000000000000FD2` |
| ChainInfo precompile | `0x0000000000000000000000000000000000000fD3` |
| Deployed EVM v1 decoder | `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` |
| Proof builder variable | `ATTESTCOIN_PROOF_BUILDER_URL` |
| Official contracts | `@gluwa/usc-contracts@0.1.2` |
| Official SDK | `@gluwa/usc-sdk@0.18.0` |
| Official example revision | `4ff9a3bf5d7fa8dbfec34ae9726d3f81405dca7b` |

These values were reconciled on 2026-08-25 against the current Creditcoin Testnet, Attestcoin environment, SDK, smart-contract documentation, and the official Gluwa example revision. Preflight still checks live chain IDs, ChainInfo, attestation state, deployed code, token metadata, proof-service readiness, and balances before a transaction can be sent.

Official references:

- [Creditcoin Testnet](https://docs.creditcoin.org/environments/testnet)
- [Attestcoin chains and environments](https://docs.creditcoin.org/attestcoin-protocol/attestcoin-protocol-chains-environments)
- [Attestcoin SDK](https://docs.creditcoin.org/attestcoin-protocol/dapp-builder-infrastructure/attestcoin-sdk-usc-sdk)
- [Attestcoin smart contracts](https://docs.creditcoin.org/attestcoin-protocol/dapp-builder-infrastructure/attestcoin-smart-contracts)
- [Pinned official example](https://github.com/gluwa/usc-testnet-bridge-examples/tree/4ff9a3bf5d7fa8dbfec34ae9726d3f81405dca7b)

## Setup

Requirements: Node 24, pnpm, and Foundry. Run `pnpm install` at the repository root.

Copy `.env.example` to `.env`. Use a newly generated disposable EVM account that has never held real assets. Put the same testnet-only private key in `ATTESTCOIN_DISPOSABLE_PRIVATE_KEY`; the validation process uses the same address on both chains. Use a reliable Sepolia RPC in `FOREIGN_RPC_URL`. Never commit `.env`, a seed phrase, a private key, provider credentials, or `.attestcoin/`.

Fund the disposable account with:

1. Sepolia ETH from a reputable current testnet faucet.
2. CC3 tCTC from the [Creditcoin testnet faucet instructions](https://docs.creditcoin.org/wallets/using-testnet-faucet).
3. TEST by calling the official example token's public `mint(uint256)` on Sepolia. For example, after loading `.env` locally:

   ```sh
   cast send 0x0F24FD9e0524BA53d3f0A4A40350Adf5370b4A53 \
     "mint(uint256)" 1000000000000000000 \
     --rpc-url "$FOREIGN_RPC_URL" \
     --private-key "$ATTESTCOIN_DISPOSABLE_PRIVATE_KEY"
   ```

4. BTKT through the official Hello Bridge testnet flow. The configured token is minted by the official CC3 minter after a successful verified burn; it is not freely mintable. Follow the pinned example's `hello-bridge` guide and keep the resulting public transaction hashes. This funding requirement proves the settlement asset is real and obtainable.

The source TEST contract is the official example's OpenZeppelin ERC-20 with an inherited standard `transfer`. The validation process additionally requires exact sender debit and recipient credit equal to the requested amount, excluding gas. The BTKT contract is a fixed-18-decimal OpenZeppelin ERC-20 whose mint authority belongs to the example's verified minter path.

## Deploy the semantic probe

`ReceiptSemanticProbe` is a stateless, non-production CC3 validation contract. It has no custody, admin, reservation, payout, or replay-consumption storage. It links the officially deployed EVM v1 decoder and calls the Block Prover precompile synchronously.

After loading `.env`, deploy it to CC3 Testnet:

```sh
forge create contracts/spike/ReceiptSemanticProbe.sol:ReceiptSemanticProbe \
  --broadcast \
  --rpc-url "$CREDITCOIN_RPC_URL" \
  --private-key "$ATTESTCOIN_DISPOSABLE_PRIVATE_KEY" \
  --libraries node_modules/@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol:EvmV1Decoder:0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f
```

Set the deployed address as `ATTESTCOIN_PROBE_ADDRESS`. Confirm it on the configured Creditcoin explorer before continuing.

## Run the gate

Every command supports `--help`; every operational command also supports `--json`. Human output never prints a private key, complete proof, or credential-bearing RPC URL.

1. Run `pnpm attestcoin:preflight`. It is read-only and must pass before any transaction is sent. It checks both chain IDs, the independently reported Sepolia chain key, advancing attestation state, all contract code and interfaces, token metadata, proof-builder height, exact package pins, and all four required balances.
2. Run `pnpm attestcoin:transfer --recipient <distinct-buyer-address> --amount <small-positive-base-unit-amount>`. This sends exactly one direct `transfer(address,uint256)` to the configured TEST contract. It never auto-retries. Save the printed hash even if receipt waiting fails.
3. Open the printed Sepolia explorer link. Confirm the transaction sender is the disposable solver, `to` is `0x0F24...4A53`, status is successful, and the canonical Transfer recipient is the buyer. No Mozy contract or adapter should appear.
4. Run `pnpm attestcoin:inspect --tx <foreign-hash>`. The command reloads the locally recorded expectation and checks the exact target, status, token emitter, sender, recipient, amount, and unambiguous log index.
5. Run `pnpm attestcoin:prove --tx <foreign-hash>`. If the block is not ready, the command returns `waiting_for_attestation`, exit code `2`, the last observed height, and a retry instruction. Re-run the same command later. It never resends delivery. On success it writes the official SDK response without renaming proof fields to `.attestcoin/proofs/<hash>.json`.
6. Run `pnpm attestcoin:verify --tx <foreign-hash>`. It first performs the official read-only proof verification and derives the transaction index twice through the precompile. It then simulates and submits the stateless probe. Only a successful probe event writes `artifacts/attestcoin/evidence.json`.
7. Open the generated Creditcoin explorer link and confirm the transaction targets the recorded probe and succeeded.
8. Run `pnpm attestcoin:evidence:check`. It validates every semantic check and compares the committed receipt with fresh source and Creditcoin receipts.

To emit machine-readable output, append `--json`, for example:

```sh
pnpm attestcoin:inspect --tx 0x<full-32-byte-hash> --json
```

## Required negative check

After a normal proof has been saved, use a valid address different from the real buyer:

```sh
pnpm attestcoin:verify --tx <foreign-hash> --expect-recipient <different-address>
```

The command first confirms the cryptographic proof through the official verifier, then simulates the Creditcoin probe with the wrong semantic expectation. It must exit non-zero with `Transfer recipient does not match the expected delivery wallet.` It does not send a Creditcoin transaction, overwrite success evidence, or send another foreign transfer.

## Authenticated semantic mapping

| Mozy requirement | Authenticated source |
| --- | --- |
| Source chain | `chainKey` supplied to and verified by the Block Prover; checked against live ChainInfo |
| Source occurrence | `headerNumber` in the verified proof |
| Receipt success | `EvmV1Decoder.decodeReceiptFields(...).receiptStatus == 1` |
| Direct token target | `EvmV1Decoder.decodeCommonTxFields(...).to` |
| Direct transfer call | Exact `transfer(address,uint256)` calldata, recipient, and amount |
| Token | Exact decoded log emitter |
| Sender and recipient | Common transaction sender plus indexed canonical Transfer topics |
| Amount | Canonical Transfer data decoded as `uint256`; compared as bigint/base-unit string |
| Log selection | Exactly one qualifying decoded receipt log; its receipt-array index is recorded |
| Transaction index | `BlockProver.calculateTxIndex(merkleProof)` and the proof builder's `txIndex` must agree |
| Replay identity | `keccak256(abi.encodePacked(uint256(chainKey), uint64(blockHeight), uint256(transactionIndex)))` |
| Source timing | Authenticated source block height only |

The current EVM v1 decoded receipt fields contain status, gas used, logs, and bloom, but no source timestamp. Local time, proof generation time, browser time, and an RPC-fetched block timestamp are not substituted. Settlement uses the authenticated source-height window and ChainInfo expiry rule documented in `docs/settlement-model.md`.

The replay identity is derived twice through the current official precompile transaction-index rule and compared with the source receipt index. Persistent one-time consumption belongs to later settlement work; this validation only authenticates and records the stable identity.

## Recovery and restart behavior

- Chain ID, ChainInfo, bytecode, token metadata, credentials, or funding mismatch: preflight stops before gas spend. Reconcile the pin; do not guess.
- Source receipt pending: retain the printed hash and rerun `inspect`. Never rerun `transfer` automatically.
- Attestation pending: retain the hash and rerun `prove` later. The official example observes roughly 8–10 minutes for recent Sepolia blocks, but this validation process promises no fixed wait.
- Proof API unavailable or rate-limited: the command uses three bounded exponential-backoff attempts with jitter, then preserves all prior artifacts and exits retryably.
- Creditcoin submission failure: retain `.attestcoin/proofs/<hash>.json` and rerun only `verify`.
- Process stopped after proof creation: a new shell can run `verify` using the saved artifact. Deleting the local proof and regenerating it must produce the same replay identity.
- Semantic mismatch: the exact field is reported and no success evidence is written.
- Missing committed evidence: `attestcoin:evidence:check` reports `No verified receipt evidence found` and the next command. It never invents a sample success.

Raw proof caches and transfer expectations are operational artifacts and remain gitignored. The success manifest contains only public addresses, hashes, decoded receipt fields, version pins, and source links. This validation process is testnet-only, is not audited, and is not production key-management or settlement code.

## Release settlement integration

The workflow above proves the pinned receipt path through `ReceiptSemanticProbe`. That contract is deliberately stateless economic-wise: it authenticates receipt semantics and emits evidence, but it has no Acquisition Mandate, reservation, locked payout, bond, or vault authority. The supported product path uses `MozySettlement` at `0x6A25220617faF467f9F83cb5162CBE69BD09ea4b`; it consumes the same official proof shape and additionally binds the authenticated receipt to canonical reservation economics.

The release remains pinned to configuration `attestcoin-spike-cc3-sepolia-2026-08-25`:

| Component | Pin |
|---|---|
| Creditcoin | CC3 Testnet, chain `102031` |
| Source | Ethereum Sepolia, chain `11155111`, source key `1` |
| Verifier | `0x0000000000000000000000000000000000000FD2` |
| ChainInfo | `0x0000000000000000000000000000000000000fD3` |
| EVM v1 decoder | `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` |
| Contracts package | `@gluwa/usc-contracts@0.1.2` |
| SDK package | `@gluwa/usc-sdk@0.18.0` |
| TEST | `0x0F24FD9e0524BA53d3f0A4A40350Adf5370b4A53`, 18 decimals |
| BTKT | `0x914Cf96BF28b7b4921db27b264ecEd71aC91134E`, 18 decimals |

Attestcoin is the product name. `USC v2` remains in package/interface names and the pinned architecture label; it does not identify a second verification system.

### Readiness and authenticated height

Proof readiness is determined by attested source height, not elapsed time. The proof builder must report an attested height at or above the TEST transaction’s Ethereum Sepolia block. A receipt may therefore be discovered successfully while proof generation still returns a waiting condition. There is no fixed ETA.

At reservation creation, `MozyMarket` reads the official ChainInfo boundary and stores the inclusive source window `[H + 1, H + 256]`. Eligible unresolved expiry additionally requires the authenticated head to reach the stored end plus `64` grace blocks and the Creditcoin delivery deadline to have passed. Source RPC timestamps and relayer input do not set these bounds.

### Candidate inspection and persistence

Candidate registration records a transaction hash against an immutable reservation. The worker re-reads the Ethereum transaction and receipt. It treats temporary RPC/source-confirmation failures as retryable, and rejects a terminal semantic mismatch rather than searching for a convenient interpretation.

Before requesting a proof, candidate inspection requires:

1. Ethereum Sepolia chain identity and a successful receipt;
2. transaction target equal to TEST;
3. direct `transfer(address,uint256)` calldata;
4. TEST as the qualifying log emitter;
5. the stored solver as sender and buyer delivery wallet as recipient;
6. delivered amount at least equal to reserved quantity;
7. a source block inside the reservation’s inclusive range; and
8. one unambiguous qualifying transfer/log identity.

Overdelivery is observable but does not alter locked quantity or payout. A source transaction is never resent by the worker.

The worker persists validated proof JSON, version `@gluwa/usc-sdk@0.18.0`, and a checksum in the private database. Local CLI proof files remain under ignored `.attestcoin/proofs/`. Raw proof arrays are not returned through product APIs or printed during settlement.

### On-chain verification and settlement

`MozySettlement.settle` accepts a reservation ID plus the official verifier arguments: chain key, header number, encoded transaction, Merkle proof, and continuity proof. Submission is permissionless. The caller only supplies gas; payout always goes to the solver stored by `MozyMarket`.

The official verifier authenticates source chain, height, inclusion, and receipt material. The EVM v1 decoder exposes the transaction and receipt fields. `MozySettlement` then repeats the economically decisive semantic checks on-chain: chain, successful receipt, token target, direct transfer selector and recipient/amount, token log emitter, solver sender, buyer recipient, minimum amount, source window, transaction/log identity, active reservation, and unused replay identity.

Replay identity is derived from authenticated chain key, source height, and transaction index. The settlement contract records the reservation consuming that identity before releasing value. A repeated receipt or competing submission cannot pay another reservation.

After proof verification and semantic acceptance, `MozyMarket`/`SettlementVault` spend the exact locked payout to the stored solver, return the exact isolated bond, update mandate quantity/accounting, and emit the canonical settlement event. The worker and database cannot bypass this transition.

### Retry, restart, and terminal failures

The durable job sequence is `DETECTED`, `WAITING_SOURCE_CONFIRMATION`, `WAITING_ATTESTATION`, `PROOF_READY`, `SUBMITTING`, then `CONFIRMED`; retryable infrastructure failures retain a resumable phase, while semantic failures become `TERMINAL_REJECTED`. Jobs use 60-second expiring leases and bounded backoff. Restarting the process reclaims expired work and reconciles a known Creditcoin hash before another submission.

Retry the same read/proof identity after an RPC timeout, unavailable proof builder, pending source confirmation, unattested block, or transient database failure. Preserve and inspect a submitted transaction hash before retrying any write. Do not retry invalid token/sender/recipient/amount, failed receipt, out-of-window height, malformed proof, consumed replay identity, expired reservation, or rejected settlement simulation as though time could make the semantics valid.

### Release evidence

The stateless spike is checked with:

```bash
pnpm attestcoin:evidence:check
```

The production settlement path is inspected and reconciled with:

```bash
pnpm protocol:inspect --reservation 1
pnpm protocol:inspect --receipt <replay-identity>
pnpm protocol:evidence:check
```

The public artifacts are [`../artifacts/attestcoin/evidence.json`](../artifacts/attestcoin/evidence.json), [`../artifacts/protocol/cc3-settlement.json`](../artifacts/protocol/cc3-settlement.json), and [`../artifacts/protocol/cc3-settlement-evidence.json`](../artifacts/protocol/cc3-settlement-evidence.json). The first proves the probe path; the latter two identify and verify the economic settlement deployment. See [`architecture.md`](architecture.md), [`security.md`](security.md), and [`runbook.md`](runbook.md) for authority and operations.

### Direct-delivery invariant

There is no Mozy contract or adapter on Ethereum Sepolia. The source transaction targets TEST and moves the token directly from solver to buyer. Attestcoin authenticates evidence of that receipt; it does not move the token. This statement describes the release design. For a completed settlement, the committed evidence check must also confirm the actual transaction target and decoded transfer fields before that transaction is presented as proof of the invariant.
