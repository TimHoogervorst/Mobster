'use client'

import { useState } from 'react'
import { MessageSquare, Send, Loader2 } from 'lucide-react'

interface Comment {
  id: string
  content: string
  createdAt: string
}

interface PrdCommentsProps {
  prdId: string
  prdStatus: string
  initialComments: Comment[]
}

export function PrdComments({ prdId, prdStatus, initialComments }: PrdCommentsProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [sendingFeedback, setSendingFeedback] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedbackSent, setFeedbackSent] = useState(false)

  const handleAddComment = async () => {
    const trimmed = content.trim()
    if (!trimmed) return

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/prds/${prdId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to add comment')
      }

      const data = await res.json()
      setComments([...comments, data.comment])
      setContent('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSendFeedback = async () => {
    if (comments.length === 0) return

    setSendingFeedback(true)
    setError(null)

    // Combine all comments into one feedback message
    const feedback = comments.map((c) => c.content).join('\n\n')

    try {
      const res = await fetch(`/api/prds/${prdId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft', comment: feedback }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to send feedback')
      }

      setFeedbackSent(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSendingFeedback(false)
    }
  }

  const isDraft = prdStatus === 'draft'

  return (
    <div className="rounded-lg border p-6 space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Comments ({comments.length})
      </h3>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {feedbackSent && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-300">
          Feedback sent! The PRD is being regenerated with your comments.
        </div>
      )}

      {/* Comment list */}
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="rounded-md bg-muted/50 px-4 py-3">
              <p className="text-sm whitespace-pre-wrap">{c.content}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(c.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Add comment form */}
      <div className="space-y-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a review comment..."
          rows={3}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          disabled={saving}
        />
        <div className="flex items-center justify-between">
          <button
            onClick={handleAddComment}
            disabled={!content.trim() || saving}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Add Comment
          </button>

          {/* Send Feedback button — shown when there are comments and PRD is in draft */}
          {isDraft && comments.length > 0 && !feedbackSent && (
            <button
              onClick={handleSendFeedback}
              disabled={sendingFeedback}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {sendingFeedback && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <Send className="h-3.5 w-3.5" />
              Send Feedback for Regeneration
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
