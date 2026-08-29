import { createHash } from "node:crypto";
import { Contract, Wallet } from "ethers";
import { releaseConfig } from "@mozy/chain-config";
import {
  claimDueJob,
  foreignTransactions,
  getCandidateForJob,
  getDatabase,
  releaseJob,
  renewJobLease,
  retryDelayMs,
  settlementReceipts,
} from "@mozy/db";
import { and, eq } from "drizzle-orm";
import {
  createExpectation,
  inspectReceipt,
} from "../../../scripts/attestcoin/receipt.js";
import { fetchProof } from "../../../scripts/attestcoin/proof.js";
import {
  createCreditcoinProvider,
  createForeignProvider,
} from "../../../scripts/attestcoin/providers.js";
import { readProofBuilderHeight } from "../../../scripts/attestcoin/preflight.js";
import type { StoredProof } from "../../../scripts/attestcoin/types.js";
import { loadContractArtifact } from "../../../scripts/protocol/artifacts.js";
import { classifyJobError } from "./errors.js";
import type { workerConfig } from "./config.js";

type Config = ReturnType<typeof workerConfig>;

export async function processOneJob(config: Config) {
  const db = getDatabase();
  const job = await claimDueJob(db, config.MOZY_WORKER_ID);
  if (!job) return false;
  const candidate = await getCandidateForJob(db, job.foreignTransactionId);
  if (!candidate) {
    await releaseJob(db, job.id, config.MOZY_WORKER_ID, {
      status: "TERMINAL_REJECTED",
      lastErrorClass: "candidate_missing",
      lastErrorDetailSafe: "Candidate not accepted.",
    });
    return true;
  }
  const renewal = setInterval(() => {
    void renewJobLease(db, job.id, config.MOZY_WORKER_ID).catch(
      () => undefined,
    );
  }, 30_000);
  renewal.unref();
  try {
    const creditcoin = createCreditcoinProvider(config.CREDITCOIN_RPC_URL);
    const foreign = createForeignProvider(config.FOREIGN_RPC_URL);
    const [marketArtifact, settlementArtifact] = await Promise.all([
      loadContractArtifact("MozyMarket"),
      loadContractArtifact("MozySettlement"),
    ]);
    const market = new Contract(
      releaseConfig.contracts.market,
      marketArtifact.abi,
      creditcoin,
    );
    const reservation = (await market.getReservation(
      BigInt(candidate.reservationId),
    )) as readonly unknown[];
    const requirements = (await market.getReservationRequirements(
      BigInt(candidate.reservationId),
    )) as readonly unknown[];
    const marketRequirements = requirements[0] as readonly unknown[];
    if (
      BigInt(String(marketRequirements[0])) !== candidate.sourceChainKey ||
      String(marketRequirements[1]).toLowerCase() !==
        releaseConfig.deliveryToken.address.toLowerCase()
    )
      throw new Error("reservation_environment_mismatch");
    if (Number(reservation[11]) === 2) {
      const event = await db.query.settlementReceipts.findFirst({
        where: and(
          eq(settlementReceipts.reservationId, candidate.reservationId),
          eq(settlementReceipts.foreignTransactionId, candidate.id),
        ),
      });
      await releaseJob(
        db,
        job.id,
        config.MOZY_WORKER_ID,
        event
          ? {
              status: "CONFIRMED",
              resumeStatus: null,
              confirmedAt: new Date(),
              nextAttemptAt: new Date(),
              lastErrorClass: null,
              lastErrorDetailSafe: null,
            }
          : {
              status: "RETRYABLE",
              resumeStatus: "SUBMITTING",
              nextAttemptAt: new Date(Date.now() + 15_000),
              lastErrorClass: "settlement_event_pending",
              lastErrorDetailSafe:
                "Settlement status is being checked. Do not submit another delivery.",
            },
      );
      return true;
    }
    if (Number(reservation[11]) !== 0) throw new Error("reservation_inactive");

    if (
      ["DETECTED", "WAITING_SOURCE_CONFIRMATION", "RETRYABLE"].includes(
        job.status,
      ) &&
      !job.proofPayload
    ) {
      const evidence = await inspectReceipt(
        foreign,
        candidate.transactionHash as `0x${string}`,
        createExpectation({
          sender: reservation[2] as string,
          recipient: requirements[1] as string,
          amount: reservation[3] as bigint,
        }),
        false,
      );
      const height = BigInt(evidence.blockNumber);
      if (
        height < (reservation[8] as bigint) ||
        height > (reservation[9] as bigint)
      )
        throw new Error("source_height_outside_window");
      await db
        .update(foreignTransactions)
        .set({
          observedBlockNumber: height,
          observedBlockHash: evidence.blockHash.toLowerCase(),
          transactionIndex: BigInt(evidence.transactionIndex),
          receiptStatus: evidence.receiptStatus,
          transactionTo: evidence.transactionTo.toLowerCase(),
          transferFrom: evidence.transferFrom.toLowerCase(),
          transferTo: evidence.transferTo.toLowerCase(),
          transferAmount: evidence.transferAmount,
          transferLogIndex: BigInt(evidence.transferLogIndex),
          semanticStatus: "accepted",
          observedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(foreignTransactions.id, candidate.id));
      await releaseJob(db, job.id, config.MOZY_WORKER_ID, {
        status: "WAITING_ATTESTATION",
        attemptCount: 0,
        nextAttemptAt: new Date(Date.now() + 15_000),
        lastErrorClass: null,
        lastErrorDetailSafe: null,
      });
      return true;
    }

    if (
      job.status === "WAITING_ATTESTATION" ||
      (job.status === "RETRYABLE" && !job.proofPayload)
    ) {
      const evidence = await inspectReceipt(
        foreign,
        candidate.transactionHash as `0x${string}`,
        createExpectation({
          sender: reservation[2] as string,
          recipient: requirements[1] as string,
          amount: reservation[3] as bigint,
        }),
        false,
      );
      const observedHeight = BigInt(evidence.blockNumber);
      if (
        observedHeight < (reservation[8] as bigint) ||
        observedHeight > (reservation[9] as bigint)
      )
        throw new Error("source_height_outside_window");
      if (observedHeight > BigInt(Number.MAX_SAFE_INTEGER))
        throw new Error("source_height_unsupported");
      if (candidate.observedBlockHash !== evidence.blockHash.toLowerCase()) {
        await db
          .update(foreignTransactions)
          .set({
            observedBlockNumber: observedHeight,
            observedBlockHash: evidence.blockHash.toLowerCase(),
            transactionIndex: BigInt(evidence.transactionIndex),
            transferLogIndex: BigInt(evidence.transferLogIndex),
            updatedAt: new Date(),
          })
          .where(eq(foreignTransactions.id, candidate.id));
      }
      const height = Number(observedHeight);
      const attestedHeight = await readProofBuilderHeight(
        config.ATTESTCOIN_PROOF_BUILDER_URL,
      );
      const proof = await fetchProof({
        hash: candidate.transactionHash as `0x${string}`,
        blockNumber: height,
        proofBuilderUrl: config.ATTESTCOIN_PROOF_BUILDER_URL,
        attestedHeight,
      });
      const serialized = JSON.stringify(proof);
      await releaseJob(db, job.id, config.MOZY_WORKER_ID, {
        status: "PROOF_READY",
        proofVersion: "@gluwa/usc-sdk@0.18.0",
        proofPayload: proof,
        proofChecksum: `0x${createHash("sha256").update(serialized).digest("hex")}`,
        attemptCount: 0,
        nextAttemptAt: new Date(),
      });
      return true;
    }

    const proof = job.proofPayload as StoredProof;
    const relayer = new Wallet(config.MOZY_RELAYER_PRIVATE_KEY, creditcoin);
    const settlement = new Contract(
      releaseConfig.contracts.settlement,
      settlementArtifact.abi,
      relayer,
    );
    const args = settlementArguments(BigInt(candidate.reservationId), proof);
    if (
      (job.status === "SUBMITTING" || job.resumeStatus === "SUBMITTING") &&
      job.creditcoinSettlementTxHash
    ) {
      const receipt = await creditcoin.getTransactionReceipt(
        job.creditcoinSettlementTxHash,
      );
      if (!receipt) {
        await releaseJob(db, job.id, config.MOZY_WORKER_ID, {
          status: "SUBMITTING",
          nextAttemptAt: new Date(Date.now() + 15_000),
          lastErrorDetailSafe:
            "Settlement status is being checked. Do not submit another delivery.",
        });
        return true;
      }
      const canonical = (await market.getReservation(
        BigInt(candidate.reservationId),
      )) as readonly unknown[];
      const event =
        Number(canonical[11]) === 2
          ? await db.query.settlementReceipts.findFirst({
              where: and(
                eq(settlementReceipts.reservationId, candidate.reservationId),
                eq(settlementReceipts.foreignTransactionId, candidate.id),
                eq(
                  settlementReceipts.creditcoinSettlementTxHash,
                  job.creditcoinSettlementTxHash,
                ),
              ),
            })
          : undefined;
      await releaseJob(
        db,
        job.id,
        config.MOZY_WORKER_ID,
        event
          ? {
              status: "CONFIRMED",
              resumeStatus: null,
              confirmedAt: new Date(),
              nextAttemptAt: new Date(),
              lastErrorClass: null,
              lastErrorDetailSafe: null,
            }
          : Number(canonical[11]) === 2
            ? {
                status: "RETRYABLE",
                resumeStatus: "SUBMITTING",
                nextAttemptAt: new Date(Date.now() + 15_000),
                lastErrorClass: "settlement_event_pending",
                lastErrorDetailSafe:
                  "Settlement status is being checked. Do not submit another delivery.",
              }
            : {
                status: "TERMINAL_REJECTED",
                nextAttemptAt: new Date(),
                lastErrorClass: "settlement_failed",
                lastErrorDetailSafe: "Candidate not accepted.",
              },
      );
      return true;
    }
    await settlement.settle.staticCall(...args);
    const transaction = await settlement.settle(...args);
    await releaseJob(db, job.id, config.MOZY_WORKER_ID, {
      status: "SUBMITTING",
      creditcoinSettlementTxHash: transaction.hash.toLowerCase(),
      attemptCount: 0,
      nextAttemptAt: new Date(Date.now() + 15_000),
    });
    return true;
  } catch (error) {
    const classified = classifyJobError(error);
    const attempt =
      job.attemptCount + (classified.kind === "retryable" ? 1 : 0);
    const status =
      classified.kind === "waiting_source"
        ? "WAITING_SOURCE_CONFIRMATION"
        : classified.kind === "waiting_attestation"
          ? "WAITING_ATTESTATION"
          : classified.kind === "terminal"
            ? "TERMINAL_REJECTED"
            : "RETRYABLE";
    if (classified.kind === "terminal") {
      await db
        .update(foreignTransactions)
        .set({
          semanticStatus: "rejected",
          rejectionClass: classified.errorClass,
          rejectionDetailSafe: classified.safeDetail,
          updatedAt: new Date(),
        })
        .where(eq(foreignTransactions.id, candidate.id));
    }
    await releaseJob(db, job.id, config.MOZY_WORKER_ID, {
      status,
      resumeStatus: classified.kind === "retryable" ? job.status : null,
      attemptCount: attempt,
      nextAttemptAt: new Date(
        Date.now() +
          (classified.kind === "retryable"
            ? retryDelayMs(job.attemptCount)
            : 15_000),
      ),
      lastErrorClass: classified.errorClass,
      lastErrorDetailSafe: classified.safeDetail,
    });
    return true;
  } finally {
    clearInterval(renewal);
  }
}

function settlementArguments(reservationId: bigint, proof: StoredProof) {
  return [
    reservationId,
    proof.chainKey,
    proof.headerNumber,
    proof.txBytes,
    [
      proof.merkleProof.root,
      proof.merkleProof.siblings.map((entry) => [entry.hash, entry.isLeft]),
    ],
    [proof.continuityProof.lowerEndpointDigest, proof.continuityProof.roots],
  ] as const;
}
