export default function DashboardLoading() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-7xl mx-auto">
        <div className="h-10 w-48 rounded bg-bg-tertiary animate-pulse mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-24 rounded-2xl bg-bg-tertiary animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 rounded-2xl bg-bg-tertiary animate-pulse" />
          <div className="h-96 rounded-2xl bg-bg-tertiary animate-pulse" />
        </div>
      </div>
    </div>
  );
}
