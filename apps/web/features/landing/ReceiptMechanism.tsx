"use client";

import Link from "next/link";
import {
  m,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { useRef, useState } from "react";
import {
  mechanismStages,
  resolveMechanismStage,
} from "./scroll-stages";

export function ReceiptMechanism() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const [activeStage, setActiveStage] = useState(0);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const deliveryScale = useTransform(scrollYProgress, [0.22, 0.44], [0, 1]);
  const assetOpacity = useTransform(scrollYProgress, [0.34, 0.43], [0, 1]);
  const receiptOpacity = useTransform(
    scrollYProgress,
    [0.42, 0.5, 0.77, 0.86],
    [0, 1, 1, 0.35],
  );
  const receiptY = useTransform(scrollYProgress, [0.44, 0.76], [-70, 80]);
  const verificationScale = useTransform(scrollYProgress, [0.56, 0.76], [0, 1]);
  const payoutScale = useTransform(scrollYProgress, [0.82, 0.98], [0, 1]);

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    const nextStage = resolveMechanismStage(progress);
    setActiveStage((currentStage) =>
      currentStage === nextStage ? currentStage : nextStage,
    );
  });

  const displayedStage = reduceMotion ? 3 : activeStage;

  return (
    <section
      ref={sectionRef}
      id="mechanism"
      aria-labelledby="landing-title"
      className="scroll-mt-16 lg:h-[360vh]"
    >
      <div className="mx-auto max-w-360 px-4 sm:px-8 lg:sticky lg:top-16 lg:flex lg:min-h-[calc(100svh-4rem)] lg:items-center lg:px-12">
        <div className="grid w-full gap-14 py-14 lg:grid-cols-12 lg:gap-12 lg:py-8">
          <div className="lg:col-span-5 lg:self-center">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.13em] text-ink-tertiary">
              Live testnet · Ethereum Sepolia → Creditcoin CC3
            </p>
            <h1
              id="landing-title"
              className="mt-7 max-w-xl text-[48px] leading-[0.96] font-medium tracking-[-0.055em] text-ink sm:text-[68px] lg:text-[76px]"
            >
              Buy there.
              <br />
              Pay here.
            </h1>
            <p className="mt-8 max-w-xl text-[16px] leading-7 text-ink-secondary sm:text-[17px]">
              Fund an acquisition on Creditcoin. A solver delivers directly to
              your existing wallet. Their reserved payment unlocks after that
              ordinary transfer is verified.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href="/markets"
                className="inline-flex min-h-11 items-center justify-center rounded-control bg-signal px-5 text-sm font-medium text-paper-raised outline-none transition-colors hover:bg-signal-strong focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-signal"
              >
                Explore markets
              </Link>
              <Link
                href="/how-mozy-works"
                className="inline-flex min-h-11 items-center text-sm font-medium underline decoration-line-strong underline-offset-4 outline-none hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              >
                How Mozy works
              </Link>
            </div>

            <div className="mt-12 hidden border-t border-line pt-5 lg:block">
              <p className="font-mono text-[10px] text-ink-tertiary">
                {mechanismStages[displayedStage].reference} ·{" "}
                {mechanismStages[displayedStage].label.toUpperCase()}
              </p>
              <p className="mt-3 text-xl font-medium">
                {mechanismStages[displayedStage].title}
              </p>
              <p className="mt-2 max-w-md text-sm leading-6 text-ink-secondary">
                {mechanismStages[displayedStage].detail}
              </p>
            </div>
          </div>

          <div className="hidden lg:col-span-7 lg:block lg:self-center">
            <div
              aria-hidden="true"
              className="relative min-h-[560px] border-y border-line"
            >
              <div className="absolute inset-x-0 top-7 flex justify-between font-mono text-[10px] text-ink-tertiary">
                <span>DELIVERY LEDGER</span>
                <span>ETHEREUM SEPOLIA · CHAIN 11155111</span>
              </div>
              <div className="absolute inset-x-0 top-28 h-px bg-line-strong">
                <span className="absolute -top-5 left-0 font-mono text-[10px] text-ink-secondary">
                  SOLVER
                </span>
                <span className="absolute -top-5 right-0 font-mono text-[10px] text-ink-secondary">
                  TREASURY WALLET
                </span>
                <m.span
                  className="absolute inset-y-0 left-0 block w-full origin-left bg-ink"
                  style={{ scaleX: reduceMotion ? 1 : deliveryScale }}
                />
                <m.span
                  className="absolute -top-1.5 right-0 block h-3 w-3 border border-ink bg-paper"
                  style={{ opacity: reduceMotion ? 1 : assetOpacity }}
                />
              </div>

              <m.div
                className="absolute top-[39%] left-1/2 z-10 w-52 -translate-x-1/2 border border-line-emphasis bg-paper px-4 py-3"
                style={{
                  opacity: reduceMotion ? 1 : receiptOpacity,
                  y: reduceMotion ? 80 : receiptY,
                }}
              >
                <p className="font-mono text-[9px] tracking-[0.12em] text-ink-tertiary">
                  ORDINARY TRANSFER RECEIPT
                </p>
                <div className="mt-3 border-t border-line pt-3">
                  <p className="text-sm font-medium">TEST → buyer wallet</p>
                  <p className="mt-1 font-mono text-[10px] text-ink-tertiary">
                    RECEIPT STATUS · SUCCESS
                  </p>
                </div>
              </m.div>

              <div className="absolute top-[48%] left-1/2 h-24 w-px -translate-x-1/2 bg-line">
                <m.span
                  className="absolute inset-x-[-3px] top-0 block h-full origin-top bg-signal"
                  style={{ scaleY: reduceMotion ? 1 : verificationScale }}
                />
                <span className="absolute top-9 left-4 whitespace-nowrap font-mono text-[10px] text-ink-tertiary">
                  ATTESTCOIN · VERIFIED EVIDENCE
                </span>
              </div>

              <div className="absolute inset-x-0 bottom-28 h-px bg-line-strong">
                <span className="absolute -top-5 left-0 font-mono text-[10px] text-ink-secondary">
                  FUNDED MANDATE
                </span>
                <span className="absolute -top-5 right-0 font-mono text-[10px] text-ink-secondary">
                  RESERVED SOLVER
                </span>
                <span className="absolute -top-2 left-[58%] h-4 w-px border-l border-dashed border-line-emphasis" />
                <span className="absolute -top-2 right-0 h-4 w-px bg-signal" />
                <m.span
                  className="absolute inset-y-0 left-[58%] block w-[42%] origin-left bg-signal"
                  style={{ scaleX: reduceMotion ? 1 : payoutScale }}
                />
              </div>
              <div className="absolute inset-x-0 bottom-7 flex justify-between font-mono text-[10px] text-ink-tertiary">
                <span>SETTLEMENT LEDGER</span>
                <span>CREDITCOIN CC3 · CHAIN 102031</span>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-4 border-b border-line">
              {mechanismStages.map((stage, index) => (
                <div
                  key={stage.label}
                  className={`border-t px-3 py-3 font-mono text-[10px] transition-colors first:pl-0 last:pr-0 ${
                    index === displayedStage
                      ? "border-signal text-ink"
                      : "border-line text-ink-tertiary"
                  }`}
                >
                  {stage.reference} · {stage.label.toUpperCase()}
                </div>
              ))}
            </div>
          </div>

          <ol className="border-y border-line lg:sr-only">
            {mechanismStages.map((stage, index) => (
              <li
                key={stage.label}
                className="grid grid-cols-[44px_1fr] gap-4 border-t border-line py-7 first:border-t-0"
              >
                <span className="font-mono text-[10px] text-signal">
                  {stage.reference}
                </span>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-tertiary">
                    {stage.label}
                  </p>
                  <h2 className="mt-3 text-xl font-medium">{stage.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-ink-secondary">
                    {stage.detail}
                  </p>
                  <div className="mt-5 flex items-center" aria-hidden="true">
                    <span className="h-2 w-2 border border-ink" />
                    <span className="h-px flex-1 bg-line-strong" />
                    <span
                      className={`h-3 w-px ${index >= 2 ? "bg-signal" : "bg-ink"}`}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
