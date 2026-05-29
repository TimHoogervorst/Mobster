'use client'

import { useState, useCallback } from 'react'
import { ExternalLink, X, Plus } from 'lucide-react'

interface IssueDetailData {
  id: string
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  issueType: 'bug' | 'feature' | 'question' | 'other' | null
  labels: string[]
  userTags: string[]
  userNotes: string | null
  assignee: string | null
  milestone: string | null
  githubUrl: string
  repoFullName: string
  githubCreatedAt: string
  githubUpdatedAt: string
}

interface IssueDetailProps {
  issue: IssueDetailData
}

export function IssueDetail({ issue: initialIssue }: IssueDetailProps) {
  const [issue, setIssue] = useState(initialIssue)
  const [notes, setNotes] = useState(initialIssue.userNotes ?? '')
  const [tags, setTags] = useState<string[]>(initialIssue.userTags)
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)

  const patchIssue = useCallback(
    async (updates: Record<string, any>) => {
      setSaving(true)
      try {
        const res = await fetch(`/api/issues/${initialIssue.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        if (res.ok) {
          const updated = await res.json()
          setIssue((prev) => ({ ...prev, ...updated }))
        }
      } catch (err) {
        console.error('Failed to update issue:', err)
      } finally {
        setSaving(false)
      }
    },
    [initialIssue.id],
  )

  const handleNotesBlur = () => {
    if (notes !== (issue.userNotes ?? '')) {
      patchIssue({ userNotes: notes })
    }
  }

  const handleTypeChange = (newType: string) => {
    patchIssue({ issueType: newType })
  }

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !tags.includes(tag) && tags.length < 10) {
      const newTags = [...tags, tag]
      setTags(newTags)
      patchIssue({ userTags: newTags })
      setTagInput('')
    }
  }

  const removeTag = (tag: string) => {
    const newTags = tags.filter((t) => t !== tag)
    setTags(newTags)
    patchIssue({ userTags: newTags })
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="text-muted-foreground">#{issue.number}</span> {issue.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{issue.repoFullName}</span>
              <span>·</span>
              <span>
                {issue.state === 'open' ? '🟢 Open' : '🟣 Closed'}
              </span>
              {issue.assignee && (
                <>
                  <span>·</span>
                  <span>Assigned to @{issue.assignee}</span>
                </>
              )}
              {issue.milestone && (
                <>
                  <span>·</span>
                  <span>{issue.milestone}</span>
                </>
              )}
              <span>·</span>
              <span>Created {new Date(issue.githubCreatedAt).toLocaleDateString()}</span>
            </div>
          </div>
          <a
            href={issue.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent transition-colors shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View on GitHub
          </a>
        </div>

        {/* Labels */}
        {issue.labels.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {issue.labels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      {issue.body && (
        <div className="rounded-lg border p-6">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {issue.body.split('\n').map((line, i) => (
              <p key={i}>{line || ' '}</p>
            ))}
          </div>
        </div>
      )}

      {/* Annotations */}
      <div className="rounded-lg border p-6 space-y-5">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Annotations (Local)
        </h3>

        {/* Issue Type */}
        <div>
          <label className="text-sm font-medium">Issue Type</label>
          <select
            value={issue.issueType ?? 'other'}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="mt-1 block w-full max-w-xs rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="bug">🐛 Bug</option>
            <option value="feature">✨ Feature</option>
            <option value="question">❓ Question</option>
            <option value="other">📋 Other</option>
          </select>
        </div>

        {/* Tags */}
        <div>
          <label className="text-sm font-medium">Tags</label>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
                placeholder="Add tag..."
                className="w-24 rounded-md border border-input bg-background px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={addTag}
                disabled={!tagInput.trim()}
                className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs hover:bg-accent disabled:opacity-50 transition-colors"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-sm font-medium">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Add local notes about this issue..."
            rows={4}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
          {saving && (
            <p className="mt-1 text-xs text-muted-foreground">Saving...</p>
          )}
        </div>
      </div>
    </div>
  )
}
