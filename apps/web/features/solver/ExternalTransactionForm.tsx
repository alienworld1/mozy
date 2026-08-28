"use client";

import { useRef, useState } from "react";
import type { Hash } from "viem";
import type { CandidateRecord } from "./candidate-record";
import { transactionHashSchema } from "./candidate-record";
import { CandidateReplacementDialog } from "./CandidateReplacementDialog";

export function ExternalTransactionForm({
  current,
  disabled,
  onRegister,
}: {
  current?: CandidateRecord;
  disabled: boolean;
  onRegister: (hash: Hash, replacesHash?: Hash) => Promise<void>;
}) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [confirmingReplacement, setConfirmingReplacement] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const parsed = transactionHashSchema.safeParse(input);
  async function submit(replace = false) {
    if (!parsed.success) {
      setError("Enter a complete Ethereum Sepolia transaction hash.");
      inputRef.current?.focus();
      return;
    }
    if (
      current &&
      current.transactionHash.toLowerCase() !== parsed.data.toLowerCase() &&
      !replace
    ) {
      setConfirmingReplacement(true);
      return;
    }
    setPending(true);
    setError(undefined);
    setConfirmingReplacement(false);
    try {
      await onRegister(
        parsed.data as Hash,
        replace ? (current?.transactionHash as Hash) : undefined,
      );
      setInput("");
    } catch (registrationError) {
      setError(
        registrationError instanceof Error
          ? registrationError.message
          : "We couldn’t register this transaction. The foreign transfer is unchanged.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="mt-6 border-t border-line pt-6"
      >
        <label
          htmlFor="foreign-transaction-hash"
          className="block text-sm font-medium"
        >
          Ethereum Sepolia transaction hash
        </label>
        <input
          ref={inputRef}
          id="foreign-transaction-hash"
          value={input}
          onChange={(event) => {
            setInput(event.target.value.trim());
            setError(undefined);
          }}
          disabled={disabled || pending}
          aria-invalid={error ? true : undefined}
          aria-describedby="foreign-hash-help foreign-hash-error"
          autoComplete="off"
          spellCheck={false}
          className="mt-2 min-h-12 w-full border border-line-strong bg-paper-raised px-3 font-mono text-xs outline-none focus:border-signal disabled:bg-wash"
          placeholder="0x…"
        />
        <p
          id="foreign-hash-help"
          className="mt-3 text-xs leading-5 text-ink-secondary"
        >
          Register a transfer sent from the reserved wallet. Registration does
          not verify delivery or release payment.
        </p>
        {error ? (
          <p
            id="foreign-hash-error"
            className="mt-3 border-l-2 border-error pl-3 text-sm text-error"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <button
          ref={submitRef}
          type="submit"
          disabled={disabled || pending || input.length === 0}
          className="mt-5 min-h-11 rounded-control border border-line-strong px-4 text-sm font-medium outline-none hover:bg-wash disabled:cursor-not-allowed disabled:text-ink-tertiary focus-visible:outline-2 focus-visible:outline-signal"
        >
          {pending
            ? "Waiting for wallet"
            : current
              ? "Use replacement transaction"
              : "Register transaction"}
        </button>
      </form>
      {confirmingReplacement && current ? (
        <CandidateReplacementDialog
          currentHash={current.transactionHash}
          onKeep={() => {
            setConfirmingReplacement(false);
            requestAnimationFrame(() => submitRef.current?.focus());
          }}
          onReplace={() => void submit(true)}
        />
      ) : null}
    </>
  );
}
