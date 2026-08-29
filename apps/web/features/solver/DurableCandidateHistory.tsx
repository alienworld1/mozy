"use client";

import { releaseConfig } from "@mozy/chain-config";
import type { VerificationCandidate } from "./verification";
import { scheduleAnnotation } from "./verification";

export function DurableCandidateHistory({
  candidates,
}: {
  candidates: VerificationCandidate[];
}) {
  if (candidates.length < 2) return null;
  return (
    <section
      className="mt-8 border-t border-line pt-6"
      aria-labelledby="candidate-history-title"
    >
      <h2 id="candidate-history-title" className="text-sm font-medium">
        Candidate history
      </h2>
      <ul className="mt-4 space-y-4">
        {candidates.map((candidate, index) => (
          <li
            key={candidate.id}
            className={`border-l-2 pl-3 ${index === 0 ? "border-signal" : "border-line-strong"}`}
          >
            <span className="block text-xs font-medium uppercase">
              {index === 0 ? scheduleAnnotation(candidate) : "Superseded"}
            </span>
            <a
              href={`${releaseConfig.foreign.blockExplorers.default.url}/tx/${candidate.transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block min-h-11 content-center truncate font-mono text-xs underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal"
              title={candidate.transactionHash}
            >
              {candidate.transactionHash}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
