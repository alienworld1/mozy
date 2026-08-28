"use client";

import { releaseConfig } from "@mozy/chain-config";
import { m, useReducedMotion } from "motion/react";
import { formatEther } from "viem";
import { WalletScopedEmptyState } from "@/components/states/WalletScopedEmptyState";
import { formatTokenAmount } from "@/features/acquisitions/format";
import { getTestFundsReadiness } from "./claim";
import { ReadinessRow } from "./ReadinessRow";
import type { TestFundsAssetResult } from "./types";
import { useTestFunds } from "./useTestFunds";

function tokenState(ready: boolean, result?: TestFundsAssetResult) {
  if (ready) return "ready" as const;
  if (result?.status === "submitted" || result?.status === "uncertain") return "pending" as const;
  if (result?.status === "unavailable") return "unavailable" as const;
  return "needed" as const;
}

function tokenDetail(fallback: string, result?: TestFundsAssetResult) {
  return result?.message ?? fallback;
}

export function TestFundsWorkspace() {
  const reduceMotion = useReducedMotion();
  const funds = useTestFunds();
  if (!funds.address) {
    return <WalletScopedEmptyState connectedMessage="Reconnect your wallet to check its demo funds." disconnectedMessage="Connect a wallet to receive testnet-only funds on both supported networks." />;
  }
  if (funds.balances.isLoading) {
    return <div className="mt-10 h-80 animate-pulse border-y border-line bg-wash motion-reduce:animate-none" aria-label="Checking demo-fund readiness" />;
  }
  if (funds.balances.isError || !funds.balances.data) {
    return (
      <div className="mt-10 border-l-2 border-error pl-4" role="alert">
        <p className="text-sm text-ink-secondary">Mozy couldn’t read this wallet on both test networks.</p>
        <button type="button" onClick={() => void funds.balances.refetch()} className="mt-3 min-h-11 text-sm font-medium underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal">Retry balance check</button>
      </div>
    );
  }

  const balances = funds.balances.data;
  const readiness = getTestFundsReadiness(balances);
  const testState = tokenState(readiness.testReady, funds.claim?.assets.test);
  const btktState = tokenState(readiness.btktReady, funds.claim?.assets.btkt);
  const testHash = funds.claim?.assets.test.transactionHash;
  const btktHash = funds.claim?.assets.btkt.transactionHash;
  const tokensReady = readiness.testReady && readiness.btktReady;
  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
      <section aria-labelledby="readiness-title">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-5">
          <div>
            <p className="font-mono text-[10px] tracking-wide text-ink-tertiary">CONNECTED WALLET</p>
            <h2 id="readiness-title" className="mt-2 text-2xl font-medium">Demo readiness</h2>
          </div>
          <div className="text-right">
            <p className="max-w-48 truncate font-mono text-xs text-ink-tertiary" title={funds.address}>{funds.address}</p>
            <button type="button" onClick={() => void funds.balances.refetch()} disabled={funds.balances.isFetching} className="mt-2 min-h-11 text-xs font-medium underline underline-offset-4 outline-none disabled:text-ink-tertiary focus-visible:outline-2 focus-visible:outline-signal">{funds.balances.isFetching ? "Refreshing" : "Refresh readiness"}</button>
          </div>
        </div>
        <ul className="divide-y divide-line border-b border-line">
          <ReadinessRow label="Sepolia gas" network={releaseConfig.foreign.name} value={`${Number(formatEther(balances.sepoliaGas)).toLocaleString(undefined, { maximumFractionDigits: 5 })} ETH`} state={balances.sepoliaGas > 0n ? "ready" : "needed"} detail="Pays for the solver’s direct TEST delivery." href={balances.sepoliaGas === 0n ? releaseConfig.demoFunding.sepoliaGasFaucetUrl : undefined} hrefLabel="Open Sepolia faucet" />
          <ReadinessRow label={`${releaseConfig.deliveryToken.symbol} delivery token`} network={releaseConfig.foreign.name} value={`${formatTokenAmount(balances.test, releaseConfig.deliveryToken.decimals)} ${releaseConfig.deliveryToken.symbol}`} state={testState} detail={tokenDetail(`Mozy tops this wallet up to ${formatTokenAmount(releaseConfig.demoFunding.deliveryTokenTarget, releaseConfig.deliveryToken.decimals)} ${releaseConfig.deliveryToken.symbol}.`, funds.claim?.assets.test)} href={testHash ? `${releaseConfig.foreign.blockExplorers.default.url}/tx/${testHash}` : undefined} hrefLabel="View TEST transfer" />
          <ReadinessRow label="Creditcoin gas" network={releaseConfig.creditcoin.name} value={`${Number(formatEther(balances.creditcoinGas)).toLocaleString(undefined, { maximumFractionDigits: 5 })} ${releaseConfig.creditcoin.nativeCurrency.symbol}`} state={balances.creditcoinGas > 0n ? "ready" : "needed"} detail="Pays for acquisitions, reservations, and approvals." href={balances.creditcoinGas === 0n ? releaseConfig.demoFunding.creditcoinGasFaucetUrl : undefined} hrefLabel="Open Creditcoin faucet" />
          <ReadinessRow label={`${releaseConfig.settlementToken.symbol} settlement token`} network={releaseConfig.creditcoin.name} value={`${formatTokenAmount(balances.btkt, releaseConfig.settlementToken.decimals)} ${releaseConfig.settlementToken.symbol}`} state={btktState} detail={tokenDetail(`Mozy tops this wallet up to ${formatTokenAmount(releaseConfig.demoFunding.settlementTokenTarget, releaseConfig.settlementToken.decimals)} ${releaseConfig.settlementToken.symbol}.`, funds.claim?.assets.btkt)} href={btktHash ? `${releaseConfig.creditcoin.blockExplorers.default.url}/tx/${btktHash}` : undefined} hrefLabel="View BTKT transfer" />
        </ul>
        {readiness.ready ? (
          <m.div initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} className="mt-6 border-l-2 border-success pl-4" role="status">
            <p className="font-medium text-success">Ready to test Mozy</p>
            <p className="mt-1 text-sm text-ink-secondary">This wallet has both demo tokens and gas on both networks.</p>
          </m.div>
        ) : (
          <div className="mt-6">
            <button type="button" disabled={funds.pending || tokensReady} onClick={() => void funds.request()} className="min-h-11 rounded-control bg-signal px-5 text-sm font-medium text-paper-raised outline-none hover:bg-signal-strong disabled:cursor-not-allowed disabled:bg-line-emphasis focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
              {funds.pending ? "Waiting for wallet or dispenser" : tokensReady ? "Demo tokens ready" : "Get demo funds"}
            </button>
            <p className="mt-3 text-xs leading-5 text-ink-secondary">You’ll sign a request only. Mozy pays the token-transfer gas, and nothing leaves your wallet.</p>
          </div>
        )}
        {funds.message ? <p className={`mt-5 border-l-2 pl-4 text-sm leading-6 ${funds.claim?.ok ? "border-success text-ink-secondary" : "border-error text-error"}`} role="status">{funds.message}</p> : null}
        {funds.claim?.retryAt ? <p className="mt-2 text-xs text-ink-tertiary">Try again after {new Date(funds.claim.retryAt).toLocaleString()}.</p> : null}
        {!readiness.gasReady && tokensReady ? <p className="mt-5 border-l-2 border-pending pl-4 text-sm leading-6 text-ink-secondary">Your demo tokens are ready. Add the missing network gas above before starting transactions.</p> : null}
      </section>
      <aside className="border-t border-line pt-7 lg:border-t-0 lg:border-l lg:pl-8">
        <p className="font-mono text-[10px] tracking-wide text-ink-tertiary">TESTNET CONVENIENCE</p>
        <h2 className="mt-2 text-xl font-medium">What this dispenser does</h2>
        <p className="mt-4 text-sm leading-6 text-ink-secondary">These tokens have no real-world value. The dispenser only transfers inventory from dedicated testnet wallets; it is not part of Mozy delivery or settlement.</p>
        <p className="mt-4 text-sm leading-6 text-ink-secondary">BTKT inventory is sourced through the official verified Hello Bridge flow, then allocated here so reviewers can start quickly.</p>
        <a href="https://github.com/gluwa/usc-testnet-bridge-examples/blob/main/hello-bridge/README.md" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center text-sm font-medium underline decoration-line-strong underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal">How BTKT is sourced</a>
      </aside>
    </div>
  );
}
