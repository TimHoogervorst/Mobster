export default function SessionDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="h-4 w-28 bg-muted rounded animate-pulse" />
      <div>
        <div className="h-8 w-96 bg-muted rounded animate-pulse" />
        <div className="mt-2 h-4 w-64 bg-muted rounded animate-pulse" />
      </div>
      <div className="rounded-lg border p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-muted rounded animate-pulse" />
        ))}
      </div>
    </div>
  )
}
