export function ReceiptSkeleton() {
  return (
    <div className="animate-pulse motion-reduce:animate-none" aria-label="Loading delivery receipt">
      <div className="border-b border-line pb-8">
        <div className="h-4 w-40 bg-wash" />
        <div className="mt-3 h-9 w-full max-w-lg bg-wash-strong" />
      </div>
      <div className="mt-10 grid gap-6 border-y border-line py-8 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
        <div className="h-36 bg-wash" />
        <div className="h-px w-full bg-line-strong md:w-10" />
        <div className="h-36 bg-wash-strong" />
        <div className="h-px w-full bg-line-strong md:w-10" />
        <div className="h-36 bg-wash" />
      </div>
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {[0, 1, 2, 3].map((row) => <div key={row} className="h-16 border-b border-line bg-wash" />)}
      </div>
    </div>
  );
}

