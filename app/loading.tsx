export default function RootLoading() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-7xl mx-auto">
        <div className="h-8 w-56 rounded bg-bg-tertiary animate-pulse mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 rounded-2xl bg-bg-tertiary animate-pulse" />
          <div className="h-72 rounded-2xl bg-bg-tertiary animate-pulse" />
        </div>
      </div>
    </div>
  );
}
