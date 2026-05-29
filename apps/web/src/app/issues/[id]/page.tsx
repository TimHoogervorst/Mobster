import { notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { issues, githubRepos } from '@mobster/db'
import { eq } from 'drizzle-orm'
import { IssueDetail } from '@/components/issue-detail'
import { EmptyState } from '@/components/empty-state'
import { ArrowLeft } from 'lucide-react'

interface IssueDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function IssueDetailPage({ params }: IssueDetailPageProps) {
  const session = await auth()
  if (!session?.accessToken) {
    return (
      <EmptyState
        icon="🔗"
        title="Connect GitHub to view issues"
        description="Sign in to view issue details."
        action={{ label: 'Go to Settings', href: '/settings' }}
      />
    )
  }

  const { id } = await params
  const db = getDb()

  const issue = db.select().from(issues).where(eq(issues.id, id)).get()

  if (!issue) {
    notFound()
  }

  const repo = db.select().from(githubRepos).where(eq(githubRepos.id, issue.repoId)).get()

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/inbox"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Inbox
      </Link>

      <IssueDetail
        issue={{
          id: issue.id,
          number: issue.number,
          title: issue.title,
          body: issue.body,
          state: issue.state,
          issueType: issue.issueType,
          labels: parseLabels(issue.labels),
          userTags: parseLabels(issue.userTags),
          userNotes: issue.userNotes,
          assignee: issue.assignee,
          milestone: issue.milestone,
          githubUrl: issue.githubUrl,
          repoFullName: repo?.fullName ?? 'unknown',
          githubCreatedAt: issue.githubCreatedAt ?? new Date().toISOString(),
          githubUpdatedAt: issue.githubUpdatedAt ?? new Date().toISOString(),
        }}
      />
    </div>
  )
}

function parseLabels(labels: string | null): string[] {
  if (!labels) return []
  try {
    return JSON.parse(labels)
  } catch {
    return []
  }
}
