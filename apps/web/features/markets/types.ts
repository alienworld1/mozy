import type {
  Acquisition,
  ReservationQuote,
} from "@/features/acquisitions/types";

export type ExecutableMarketRow = {
  acquisition: Acquisition;
  openAmount: bigint;
  indicationQuantity: bigint;
  indication: ReservationQuote;
};
