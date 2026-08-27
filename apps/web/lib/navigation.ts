export const primaryNavigation = [
  { label: "Markets", href: "/markets", requiresWallet: false },
  { label: "Acquisitions", href: "/acquisitions", requiresWallet: true },
  { label: "Solver", href: "/solver", requiresWallet: true },
  { label: "Activity", href: "/activity", requiresWallet: false },
] as const;
