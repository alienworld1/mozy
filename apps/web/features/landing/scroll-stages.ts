export const mechanismStages = [
  {
    reference: "01",
    label: "Reserve",
    title: "Payment is committed first.",
    detail:
      "A solver claims an exact quantity and payout from a funded Creditcoin acquisition.",
  },
  {
    reference: "02",
    label: "Deliver",
    title: "The asset moves normally.",
    detail:
      "The solver calls the TEST token and sends it straight to the buyer wallet on Ethereum Sepolia.",
  },
  {
    reference: "03",
    label: "Verify",
    title: "The receipt gains force.",
    detail:
      "Attestcoin proves the receipt. Mozy checks its chain, token, sender, recipient, amount, timing, and identity.",
  },
  {
    reference: "04",
    label: "Pay",
    title: "The reserved payout is released.",
    detail:
      "Creditcoin consumes the receipt once, pays the reserved solver, and closes the acquisition interval.",
  },
] as const;

const stageThresholds = [0, 0.28, 0.58, 0.82] as const;

export function resolveMechanismStage(progress: number) {
  const boundedProgress = Math.min(1, Math.max(0, progress));
  for (let index = stageThresholds.length - 1; index >= 0; index -= 1) {
    if (boundedProgress >= stageThresholds[index]) return index;
  }
  return 0;
}
