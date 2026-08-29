export const productMentalModel = {
  statements: [
    "Fund the acquisition on Creditcoin.",
    "A solver reserves a fill and sends the asset directly to your supported-chain wallet.",
    "Their payment unlocks after delivery is verified.",
  ],
  flowStages: [
    {
      label: "Fund demand",
      detail: "The buyer locks the maximum settlement budget on Creditcoin.",
    },
    {
      label: "Reserve delivery",
      detail: "A solver locks an exact quantity and payout, and posts a bond.",
    },
    {
      label: "Deliver normally",
      detail: "The solver sends TEST directly to the buyer on Ethereum Sepolia.",
    },
    {
      label: "Verify",
      detail: "Attestcoin proves the receipt and Mozy checks the delivery terms.",
    },
    {
      label: "Pay",
      detail: "Creditcoin releases the locked payout to the reserved solver.",
    },
  ],
} as const;

export const buyerResponsibilities = [
  "Fund the maximum settlement budget on Creditcoin.",
  "Choose the Ethereum Sepolia wallet that should receive TEST.",
  "Keep the acquisition open while solvers reserve available quantity.",
] as const;

export const solverResponsibilities = [
  "Reserve an exact quantity and payout, and post the required bond.",
  "Send the approved TEST token from the same address that made the reservation.",
  "Wait for verified Creditcoin settlement before treating the payout as complete.",
] as const;

export const glossary = [
  {
    term: "Acquisition Mandate",
    definition:
      "Buyer-defined, pre-funded demand on Creditcoin with a target quantity, delivery wallet, price rule, and lifecycle state.",
  },
  {
    term: "Fill Reservation",
    definition:
      "An exclusive portion of open quantity with a locked payout, solver, bond, and delivery window.",
  },
  {
    term: "Delivery",
    definition:
      "The solver’s ordinary approved ERC-20 transfer directly to the buyer on Ethereum Sepolia. Delivery is not settlement.",
  },
  {
    term: "Verification",
    definition:
      "Attestcoin proof verification plus Mozy’s on-chain checks of chain, receipt success, token, sender, recipient, amount, source timing, reservation binding, and replay identity.",
  },
  {
    term: "Settlement",
    definition:
      "The canonical Creditcoin transition that spends the locked payout, pays the stored solver, returns the bond, and consumes the replay identity.",
  },
  {
    term: "Delivery Receipt",
    definition:
      "A deterministic public projection connecting the verified foreign delivery to the canonical Creditcoin settlement.",
  },
] as const;

export const knownLimitations = [
  "This release supports one configured market and testnet assets only.",
  "The solver uses one Ethereum address on both supported chains.",
  "Attestation and proof readiness have no promised completion time.",
  "Mozy does not rebalance a solver’s inventory after settlement.",
  "Only the configured standard ERC-20 behavior is supported.",
  "Overdelivery does not increase the reservation’s locked payout.",
  "Worker, indexer, or database delays can affect visibility and liveness, but not economic authority.",
  "The release contracts are non-upgradeable and have not been audited.",
] as const;
