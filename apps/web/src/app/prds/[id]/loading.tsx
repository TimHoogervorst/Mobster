export default function PrdDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="h-4 w-24 bg-muted rounded animate-pulse" />
      <div>
        <div className="flex items-center gap-3">
          <div className="h-8 w-96 bg-muted rounded animate-pulse" />
          <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
        </div>
        <div className="mt-2 h-4 w-64 bg-muted rounded animate-pulse" />
      </div>
      <div className="rounded-lg border p-4 space-y-2">
        <div className="h-4 w-32 bg-muted rounded animate-pulse" />
        <div className="h-4 w-48 bg-muted rounded animate-pulse" />
        <div className="h-4 w-40 bg-muted rounded animate-pulse" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-lg border p-4">
            <div className="h-5 w-32 bg-muted rounded animate-pulse mb-2" />
            <div className="h-20 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
