export function InstrumentChartLoading() {
  return (
    <div className="animate-pulse" aria-label="Loading acquisition chart" role="status">
      <div className="h-40 border-y border-line bg-wash/60 sm:h-44" />
      <div className="mt-4 h-32 border-y border-line bg-wash/60" />
      <div className="mt-3 h-20 border-y border-line bg-wash/60" />
    </div>
  );
}
