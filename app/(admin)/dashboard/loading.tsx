export default function DashboardLoading() {
  return (
    <div className="space-y-4 fade-in">
      <div className="h-8 w-48 bg-gray-800 rounded-xl animate-pulse" />
      <div className="h-4 w-32 bg-gray-800/60 rounded-lg animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-gray-900 border border-gray-800 rounded-2xl animate-pulse" />
        ))}
      </div>
    </div>
  )
}
