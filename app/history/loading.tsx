export default function HistoryLoading() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-7xl mx-auto">
        <div className="h-10 w-56 rounded bg-bg-tertiary animate-pulse mb-8" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="h-24 rounded-2xl bg-bg-tertiary animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
