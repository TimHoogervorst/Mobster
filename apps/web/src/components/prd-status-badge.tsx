'use client'

import { Loader2 } from 'lucide-react'

interface PrdStatusBadgeProps {
  status: string
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  generating: {
    label: 'Generating',
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  },
  draft: {
    label: 'Draft',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  reviewed: {
    label: 'Reviewed',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  },
  approved: {
    label: 'Approved',
    className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  scheduled: {
    label: 'Scheduled',
    className: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
  },
  building: {
    label: 'Building',
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  },
  done: {
    label: 'Done',
    className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  },
}

export function PrdStatusBadge({ status }: PrdStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: 'bg-secondary text-secondary-foreground',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {status === 'generating' && <Loader2 className="h-3 w-3 animate-spin" />}
      {config.label}
    </span>
  )
}
