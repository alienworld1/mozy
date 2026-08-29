export function ActivitySkeleton() {
  return (
    <div className="mt-10 animate-pulse border-t border-line motion-reduce:animate-none" aria-label="Loading protocol activity">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="grid gap-4 border-b border-line py-6 md:grid-cols-[11rem_minmax(0,1fr)_10rem_8rem]">
          <span className="h-4 w-32 bg-wash" />
          <span className="h-5 w-full max-w-sm bg-wash-strong" />
          <span className="h-4 w-20 bg-wash" />
          <span className="h-5 w-24 bg-wash" />
        </div>
      ))}
    </div>
  );
}

