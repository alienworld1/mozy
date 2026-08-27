export function StructuralSkeleton() {
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
