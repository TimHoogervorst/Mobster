import { Construction } from 'lucide-react'

interface ComingSoonProps {
  title: string
  description?: string
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="rounded-lg border border-dashed p-12 max-w-md">
        <Construction className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-6 text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          This feature is under construction and will be available soon.
        </p>
      </div>
    </div>
  )
}
