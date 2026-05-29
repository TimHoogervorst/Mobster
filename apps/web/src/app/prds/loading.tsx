export default function PrdsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        <div className="mt-2 h-4 w-64 bg-muted rounded animate-pulse" />
      </div>
      <div className="rounded-lg border">
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
