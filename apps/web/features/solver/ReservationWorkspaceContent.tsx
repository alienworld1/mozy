"use client";

import { releaseConfig } from "@mozy/chain-config";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getAddress, type Hash } from "viem";
import { useConnection, useSwitchChain } from "wagmi";
import { TransactionState } from "@/components/states/TransactionState";
import { RequiredNetworkMessage } from "@/components/wallet/RequiredNetworkMessage";
import { formatTokenAmount } from "@/features/acquisitions/format";
import { reservationStatuses } from "@/features/acquisitions/types";
import { classifyWalletError } from "@/lib/wallet-errors";
import type { CandidateRecord } from "./candidate-record";
import { DeadlineDisplay } from "./DeadlineDisplay";
import { DeliverySpecification } from "./DeliverySpecification";
import { ExternalTransactionForm } from "./ExternalTransactionForm";
import { CopyableValue } from "./CopyableValue";
import { useCandidateRecords } from "./useCandidateRecords";
import { useCandidateRegistration } from "./useCandidateRegistration";
import { useDeliveryTransaction } from "./useDeliveryTransaction";
import { useReservationWorkspace } from "./useReservationWorkspace";

export function ReservationWorkspaceContent({
  data,
  onRefresh,
}: {
  data: NonNullable<ReturnType<typeof useReservationWorkspace>["data"]>;
  onRefresh: () => void;
}) {
  const connection = useConnection();
  const { switchChainAsync } = useSwitchChain();
  const [switching, setSwitching] = useState(false);
  const [switchMessage, setSwitchMessage] = useState<string>();
  const [manualOpen, setManualOpen] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState<string>();
  const connectedSolver =
    !!connection.address &&
    getAddress(connection.address) === getAddress(data.reservation.solver);
  const candidates = useCandidateRecords(
    releaseConfig.configVersion,
    data.reservation.id.toString(),
    data.reservation.solver,
    connectedSolver,
  );
  const registration = useCandidateRegistration(data.reservation);
  const delivery = useDeliveryTransaction(data);
  const refreshDeliveryBalance = delivery.refreshBalance;
  const active = data.reservation.status === 0;
  const onForeignNetwork = connection.chainId === releaseConfig.foreign.id;
  const amount = formatTokenAmount(
    data.reservation.quantity,
    releaseConfig.deliveryToken.decimals,
  );
  const payout = formatTokenAmount(
    data.reservation.lockedPayout,
    releaseConfig.settlementToken.decimals,
  );
  const bond = formatTokenAmount(
    data.reservation.bondAmount,
    releaseConfig.settlementToken.decimals,
  );

  useEffect(() => {
    if (onForeignNetwork && connectedSolver) void refreshDeliveryBalance();
  }, [connectedSolver, onForeignNetwork, refreshDeliveryBalance]);

  async function switchToSepolia() {
    setSwitching(true);
    setSwitchMessage(undefined);
    try {
      await switchChainAsync({ chainId: releaseConfig.foreign.id });
    } catch (error) {
      setSwitchMessage(
        classifyWalletError(error) === "user_rejected"
          ? "Network switch cancelled. Your reservation is still active."
          : `Switch your wallet to ${releaseConfig.foreign.name}, then try again.`,
      );
    } finally {
      setSwitching(false);
    }
  }

  function candidate(
    state: CandidateRecord["localState"],
    hash: Hash,
    extras: Partial<CandidateRecord> = {},
  ): CandidateRecord {
    return {
      configVersion: releaseConfig.configVersion,
      reservationId: data.reservation.id.toString(),
      solver: getAddress(data.reservation.solver),
      foreignChainId: releaseConfig.foreign.id,
      transactionHash: hash,
      source: "composer",
      localState: state,
      submittedAt: new Date().toISOString(),
      ...extras,
    };
  }

  async function sendDelivery() {
    setRegistrationMessage(undefined);
    const outcome = await delivery.send((hash) =>
      candidates.upsert(candidate("submitted", hash)),
    );
    if (outcome.status === "confirmed") {
      candidates.upsert(
        candidate("confirmed", outcome.hash, {
          receiptBlockNumber: outcome.blockNumber.toString(),
        }),
      );
      try {
        const registered = await registration.register(
          outcome.hash,
          "composer",
          candidates.current?.transactionHash as Hash | undefined,
        );
        candidates.upsert({
          ...registered,
          receiptBlockNumber: outcome.blockNumber.toString(),
        });
        setRegistrationMessage(
          "Transaction registered for verification. Registration is not verification.",
        );
      } catch (error) {
        candidates.upsert(
          candidate("registration_rejected", outcome.hash, {
            receiptBlockNumber: outcome.blockNumber.toString(),
            failureMessage: "registration_unavailable",
          }),
        );
        setRegistrationMessage(
          error instanceof Error
            ? error.message
            : "We couldn’t register this transaction. The foreign transfer is unchanged.",
        );
      }
    } else if (outcome.status === "uncertain")
      candidates.upsert(
        candidate("submitted", outcome.hash, {
          failureMessage: "status_uncertain",
        }),
      );
    else if (outcome.hash)
      candidates.upsert(
        candidate("failed", outcome.hash, {
          failureMessage: "transaction_failed",
        }),
      );
  }

  async function registerExternal(hash: Hash, replacesHash?: Hash) {
    setRegistrationMessage(undefined);
    const record = await registration.register(hash, "external", replacesHash);
    candidates.upsert(record);
    setRegistrationMessage(
      "Transaction registered for verification. Registration does not verify delivery or release payment.",
    );
  }

  const activeCandidate =
    candidates.current?.localState === "failed"
      ? undefined
      : candidates.current;
  const deliveryDisabled =
    !active ||
    !connectedSolver ||
    !onForeignNetwork ||
    delivery.pending ||
    delivery.balance === undefined ||
    delivery.balance < data.reservation.quantity ||
    activeCandidate?.failureMessage === "status_uncertain";
  let disabledReason: string | undefined;
  if (!active)
    disabledReason =
      "This reservation is no longer accepting delivery transactions.";
  else if (!connection.address)
    disabledReason = `Connect ${data.reservation.solver.slice(0, 6)}…${data.reservation.solver.slice(-4)} to deliver.`;
  else if (!connectedSolver)
    disabledReason = `Connect ${data.reservation.solver.slice(0, 6)}…${data.reservation.solver.slice(-4)} to deliver or register a transaction for this reservation.`;
  else if (delivery.balance === undefined || delivery.checkingBalance)
    disabledReason = `Checking ${releaseConfig.deliveryToken.symbol} balance.`;
  else if (delivery.balance < data.reservation.quantity)
    disabledReason = `This wallet needs at least ${amount} ${releaseConfig.deliveryToken.symbol} to make the delivery.`;
  else if (activeCandidate?.failureMessage === "status_uncertain")
    disabledReason = "Check the current transaction hash before sending again.";

  return (
    <>
      <Link
        href="/solver"
        className="mb-6 inline-flex min-h-11 items-center text-sm text-ink-secondary underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal"
      >
        Back to solver
      </Link>
      <header className="border-b border-line pb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-ink-tertiary">
              RESERVATION R{data.reservation.id.toString()} · M
              {data.reservation.mandateId.toString()}
            </p>
            <h1 className="mt-2 text-[30px] leading-9 font-medium tracking-tight">
              Delivery workspace
            </h1>
          </div>
          <span className="border-l-2 border-signal pl-3 text-sm font-medium uppercase tracking-wide">
            {reservationStatuses[data.reservation.status] ?? "Unknown"}
          </span>
        </div>
        <p className="mt-4 text-[15px] text-ink-secondary">
          This same wallet sends {releaseConfig.deliveryToken.symbol} directly
          to the buyer on {releaseConfig.foreign.name}.
        </p>
      </header>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <main className="min-w-0">
          <section className="pb-8" aria-labelledby="deadline-title">
            <p className="font-mono text-[10px] tracking-wide text-ink-tertiary">
              EXACT COMMITMENT
            </p>
            <h2 id="deadline-title" className="mt-2 text-xl font-medium">
              {amount} {releaseConfig.deliveryToken.symbol} by the canonical
              deadline
            </h2>
            <div className="mt-5">
              <DeadlineDisplay deadline={data.reservation.deliveryDeadline} />
            </div>
          </section>
          <DeliverySpecification data={data} />
          <details className="mt-8 border-y border-line py-5">
            <summary className="min-h-11 cursor-pointer content-center text-sm font-medium outline-none focus-visible:outline-2 focus-visible:outline-signal">
              Technical reservation details
            </summary>
            <dl className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ink-tertiary">
                  Source-height window
                </dt>
                <dd className="mt-1 font-mono text-xs">
                  {data.reservation.sourceStartHeight.toString()}–
                  {data.reservation.sourceEndHeight.toString()}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-tertiary">
                  Expiry-eligible height
                </dt>
                <dd className="mt-1 font-mono text-xs">
                  {data.reservation.expiryEligibleHeight.toString()}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-tertiary">Source chain key</dt>
                <dd className="mt-1 font-mono text-xs">
                  {data.requirements.market.sourceChainKey.toString()}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-tertiary">
                  Creditcoin snapshot
                </dt>
                <dd className="mt-1 font-mono text-xs">
                  {data.snapshotBlock.toString()}
                </dd>
              </div>
            </dl>
          </details>
        </main>
        <aside
          className="border-t border-line pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8"
          aria-label="Delivery action and status"
        >
          <p className="font-mono text-[10px] tracking-wide text-ink-tertiary">
            LOCKED ECONOMICS
          </p>
          <dl className="mt-4 divide-y divide-line border-y border-line">
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-xs text-ink-tertiary">Payout</dt>
              <dd className="font-mono text-sm tabular-nums">
                {payout} {releaseConfig.settlementToken.symbol}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-xs text-ink-tertiary">Bond</dt>
              <dd className="font-mono text-sm tabular-nums">
                {bond} {releaseConfig.settlementToken.symbol}
              </dd>
            </div>
          </dl>
          {activeCandidate ? (
            <div className="mt-6 border-l-2 border-pending pl-4">
              <p className="text-sm font-medium uppercase tracking-wide">
                Delivery submitted
              </p>
              <CopyableValue
                label="Candidate hash"
                value={activeCandidate.transactionHash}
              />
              <a
                href={`${releaseConfig.foreign.blockExplorers.default.url}/tx/${activeCandidate.transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center text-xs underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal"
              >
                View on Ethereum Sepolia
              </a>
              <p className="text-xs leading-5 text-ink-secondary">
                This transaction has not been verified or paid yet.
              </p>
            </div>
          ) : null}
          {active && connectedSolver && !onForeignNetwork ? (
            <div className="mt-6">
              <RequiredNetworkMessage
                requiredChainId={releaseConfig.foreign.id}
                currentChainId={connection.chainId}
                switching={switching}
                onSwitch={() => void switchToSepolia()}
              />
              {switchMessage ? (
                <p className="mt-3 text-sm text-error" role="alert">
                  {switchMessage}
                </p>
              ) : null}
            </div>
          ) : null}
          {active && connectedSolver && onForeignNetwork && !activeCandidate ? (
            <div className="mt-6">
              <button
                type="button"
                disabled={deliveryDisabled}
                onClick={() => void sendDelivery()}
                className="min-h-11 w-full rounded-control bg-signal px-4 text-sm font-medium text-paper-raised outline-none hover:bg-signal-strong disabled:cursor-not-allowed disabled:bg-line-emphasis focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              >
                Send {amount} {releaseConfig.deliveryToken.symbol}
              </button>
              {disabledReason ? (
                <p className="mt-2 text-xs leading-5 text-ink-tertiary">
                  {disabledReason}
                </p>
              ) : null}
              {delivery.balance !== undefined && delivery.balance < data.reservation.quantity ? (
                <Link href="/test-funds" className="mt-2 inline-flex min-h-11 items-center text-xs font-medium underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal">Get demo funds</Link>
              ) : null}
            </div>
          ) : null}
          {!connectedSolver || !active ? (
            <p className="mt-6 border-l-2 border-line-strong pl-4 text-sm leading-6 text-ink-secondary">
              {disabledReason}
            </p>
          ) : null}
          <div className="mt-6">
            <TransactionState
              phase={delivery.phase}
              chainId={releaseConfig.foreign.id}
              transactionHash={delivery.hash}
              message={delivery.message}
            />
          </div>
          {registrationMessage ? (
            <p
              className={`mt-4 border-l-2 pl-4 text-sm leading-6 ${registrationMessage.startsWith("Transaction registered") ? "border-success text-success" : "border-error text-error"}`}
              role="status"
            >
              {registrationMessage}
            </p>
          ) : null}
          <button
            type="button"
            disabled={!active || !connectedSolver}
            onClick={() => setManualOpen((open) => !open)}
            className="mt-7 min-h-11 text-sm font-medium underline underline-offset-4 outline-none disabled:text-ink-tertiary focus-visible:outline-2 focus-visible:outline-signal"
          >
            I already sent this transfer
          </button>
          {manualOpen ? (
            <ExternalTransactionForm
              current={candidates.current}
              disabled={!active || !connectedSolver}
              onRegister={registerExternal}
            />
          ) : null}
          {candidates.records.length > 1 ? (
            <section
              className="mt-8 border-t border-line pt-6"
              aria-labelledby="candidate-history-title"
            >
              <h2 id="candidate-history-title" className="text-sm font-medium">
                Candidate history
              </h2>
              <ul className="mt-4 space-y-4">
                {[...candidates.records].reverse().map((record) => (
                  <li
                    key={record.transactionHash}
                    className="border-l-2 border-line-strong pl-3"
                  >
                    <span className="block text-xs font-medium uppercase">
                      {record.localState.replace("_", " ")}
                    </span>
                    <a
                      href={`${releaseConfig.foreign.blockExplorers.default.url}/tx/${record.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block truncate font-mono text-xs underline underline-offset-4"
                    >
                      {record.transactionHash}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <button
            type="button"
            onClick={onRefresh}
            className="mt-8 min-h-11 text-xs text-ink-tertiary underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal"
          >
            Refresh Creditcoin status
          </button>
        </aside>
      </div>
    </>
  );
}
