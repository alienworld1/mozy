export function StructuralSkeleton({ variant = "default" }: { variant?: "default" | "instrument" }) {
  if (variant === "instrument") return (
    <div className="animate-pulse motion-reduce:animate-none" aria-label="Loading acquisition structure">
      <div className="border-b border-line pb-8">
        <div className="h-4 w-24 bg-wash" />
        <div className="mt-3 h-9 w-56 bg-wash-strong" />
        <div className="mt-4 h-5 w-full max-w-md bg-wash" />
      </div>
      <div className="mt-10 border-y border-line py-8">
        <div className="h-7 w-52 bg-wash-strong" />
        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          <div className="min-h-64 bg-wash lg:col-span-8" />
          <div className="min-h-44 border-t border-line pt-6 lg:col-span-4 lg:border-t-0 lg:border-l lg:pl-8">
            <div className="h-6 w-32 bg-wash-strong" />
            <div className="mt-6 h-12 w-full bg-wash" />
          </div>
        </div>
      </div>
      <div className="mt-12 grid gap-12 lg:grid-cols-2">
        <div className="h-64 bg-wash" />
        <div className="h-64 bg-wash" />
      </div>
    </div>
  );
  return (
    <div className="animate-pulse motion-reduce:animate-none" aria-label="Loading workspace">
      <div className="max-w-3xl border-b border-line pb-8">
        <div className="h-9 w-40 bg-wash-strong" />
        <div className="mt-4 h-5 w-full max-w-md bg-wash" />
      </div>
      <div className="mt-10 min-h-56 border-y border-line py-5 sm:min-h-64">
        <div className="h-px w-full bg-line" />
        <div className="mt-32 h-5 w-full max-w-sm bg-wash" />
      </div>
    </div>
  );
}
