import { Loader2 } from 'lucide-react'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2
        className={`animate-spin text-muted-foreground ${sizeClasses[size]} ${className}`}
      />
    </div>
  )
}
