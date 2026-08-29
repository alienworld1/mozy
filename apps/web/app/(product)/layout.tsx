import type { ReactNode } from "react";
import { AppProviders } from "@/components/providers/AppProviders";
import { AppFrame } from "@/components/shell/AppFrame";

export default function ProductLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <AppFrame>{children}</AppFrame>
    </AppProviders>
  );
}
