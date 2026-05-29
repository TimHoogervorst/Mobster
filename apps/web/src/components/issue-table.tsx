import Link from 'next/link'

interface IssueRow {
  id: string
  number: number
  title: string
  state: 'open' | 'closed'
  issueType: 'bug' | 'feature' | 'question' | 'other' | null
  labels: string[]
  repoFullName: string
  assignee: string | null
  githubUpdatedAt: string
}

interface IssueTableProps {
  issues: IssueRow[]
}

const TYPE_ICONS: Record<string, string> = {
  bug: '🐛',
  feature: '✨',
  question: '❓',
  other: '📋',
}

export function IssueTable({ issues }: IssueTableProps) {
  if (issues.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">No issues found.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Try adjusting your filters or sync a repository from Settings.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-8">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Issue
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Repo
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Labels
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Assignee
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Updated
            </th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr
              key={issue.id}
              className="border-b hover:bg-accent/50 transition-colors"
            >
              <td className="px-4 py-3 text-sm">
                <span title={issue.issueType ?? 'other'}>
                  {TYPE_ICONS[issue.issueType ?? 'other'] ?? '📋'}
                </span>
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/issues/${issue.id}`}
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  <span className="text-muted-foreground">#{issue.number}</span>{' '}
                  {issue.title}
                </Link>
                {issue.state === 'closed' && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                    Closed
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {issue.repoFullName}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {issue.labels.slice(0, 3).map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                    >
                      {label}
                    </span>
                  ))}
                  {issue.labels.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{issue.labels.length - 3}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {issue.assignee ?? '—'}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground text-right whitespace-nowrap">
                {formatDate(issue.githubUpdatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString()
}
