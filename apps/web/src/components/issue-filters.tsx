'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Search } from 'lucide-react'

const ISSUE_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'bug', label: '🐛 Bugs' },
  { value: 'feature', label: '✨ Features' },
  { value: 'question', label: '❓ Questions' },
  { value: 'other', label: '📋 Other' },
]

const STATES = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
]

const SORT_OPTIONS = [
  { value: 'githubUpdatedAt', label: 'Last Updated' },
  { value: 'githubCreatedAt', label: 'Created Date' },
  { value: 'title', label: 'Title' },
]

interface IssueFiltersProps {
  repos: Array<{ id: string; fullName: string }>
}

export function IssueFilters({ repos }: IssueFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const createQueryString = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      }
      // Reset to page 1 on filter change
      if (!('page' in updates)) {
        params.delete('page')
      }
      return params.toString()
    },
    [searchParams],
  )

  const currentType = searchParams.get('type') ?? ''
  const currentState = searchParams.get('state') ?? 'open'
  const currentRepo = searchParams.get('repo') ?? ''
  const currentSort = searchParams.get('sort') ?? 'githubUpdatedAt'
  const currentOrder = searchParams.get('order') ?? 'desc'
  const currentQuery = searchParams.get('q') ?? ''

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Repo filter */}
        <select
          value={currentRepo}
          onChange={(e) =>
            router.push(pathname + '?' + createQueryString({ repo: e.target.value || null }))
          }
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Repos</option>
          {repos.map((repo) => (
            <option key={repo.id} value={repo.id}>
              {repo.fullName}
            </option>
          ))}
        </select>

        {/* Type filter */}
        <div className="flex rounded-md border border-input overflow-hidden">
          {ISSUE_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() =>
                router.push(
                  pathname + '?' + createQueryString({ type: t.value || null }),
                )
              }
              className={`px-3 py-1.5 text-sm transition-colors ${
                currentType === t.value
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* State toggle */}
        <div className="flex rounded-md border border-input overflow-hidden">
          {STATES.map((s) => (
            <button
              key={s.value}
              onClick={() =>
                router.push(
                  pathname + '?' + createQueryString({ state: s.value }),
                )
              }
              className={`px-3 py-1.5 text-sm transition-colors ${
                currentState === s.value
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search issues..."
            defaultValue={currentQuery}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const value = (e.target as HTMLInputElement).value
                router.push(
                  pathname + '?' + createQueryString({ q: value || null }),
                )
              }
            }}
            className="w-full rounded-md border border-input bg-background py-1.5 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Sort */}
        <select
          value={`${currentSort}-${currentOrder}`}
          onChange={(e) => {
            const [sort, order] = e.target.value.split('-') as [string, string]
            router.push(pathname + '?' + createQueryString({ sort, order }))
          }}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="githubUpdatedAt-desc">Newest First</option>
          <option value="githubUpdatedAt-asc">Oldest First</option>
          <option value="title-asc">Title A-Z</option>
          <option value="title-desc">Title Z-A</option>
        </select>
      </div>
    </div>
  )
}
