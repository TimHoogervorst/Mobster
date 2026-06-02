'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, GitBranch, GitPullRequest, Hammer } from 'lucide-react'

interface IntegrateDialogProps {
  prdId: string
  prdTitle: string
  prdVersion: number
  repoFullName: string
  repoDefaultBranch: string
  isOwner: boolean
  hasPushAccess: boolean
  open: boolean
  onClose: () => void
}

export function IntegrateDialog({
  prdId,
  prdTitle,
  prdVersion,
  repoFullName,
  repoDefaultBranch,
  isOwner,
  hasPushAccess,
  open,
  onClose,
}: IntegrateDialogProps) {
  const [targetType, setTargetType] = useState<'new-branch' | 'existing-branch' | 'pull-request'>(
    'new-branch',
  )
  const [branchName, setBranchName] = useState('')
  const [cleanWorkspace, setCleanWorkspace] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)
  const [result, setResult] = useState<{
    buildJobId: string
    branchName: string
    useFork: boolean
  } | null>(null)
  const router = useRouter()

  const needsFork = !isOwner && !hasPushAccess
  const effectiveTarget = needsFork ? 'pull-request' : targetType

  // Auto-generate branch name slug
  const autoBranchName = `prd/${prdTitle
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)}`

  const doSubmit = async (force = false) => {
    setLoading(true)
    setError(null)

    try {
      const body: Record<string, string> = { targetType }

      if (targetType === 'existing-branch') {
        body.branchName = branchName
      } else if (branchName && branchName !== autoBranchName) {
        body.branchName = branchName
      }

      if (cleanWorkspace) {
        body.cleanWorkspace = 'true'
      }

      if (force) {
        body.force = 'true'
      }

      const res = await fetch(`/api/prds/${prdId}/integrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        throw { status: res.status, message: data.error ?? 'Failed to start integration' }
      }

      setResult(data.buildJob)

      // Refresh the page after a short delay to show updated status
      setTimeout(() => {
        router.refresh()
      }, 1500)
    } catch (err: any) {
      if (err.status === 409) {
        // Show force option instead of plain error
        setError('__CONFLICT__')
        setConflictMessage(err.message)
      } else {
        setError(err.message || 'Failed to start integration')
        setConflictMessage(null)
      }
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Hammer className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Integrate PRD</h2>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Implement &quot;{prdTitle}&quot; in <span className="font-medium">{repoFullName}</span>
        </p>

        {/* Error display */}
        {error && error !== '__CONFLICT__' && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Conflict: existing integration in progress */}
        {error === '__CONFLICT__' && (
          <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 space-y-2">
            <p>{conflictMessage}</p>
            <p className="text-xs">You can force a restart — the previous job will be cancelled.</p>
            <button
              onClick={() => doSubmit(true)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3 w-3 animate-spin" />}
              Force restart
            </button>
          </div>
        )}

        {/* Success state */}
        {result && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-300 space-y-2">
            <p className="font-medium">✓ Integration started!</p>
            <p>
              Branch: <code className="text-xs bg-green-100 dark:bg-green-900/50 px-1 rounded">{result.branchName}</code>
              {result.useFork && ' (fork)'}
            </p>
            <a
              href={`/runners/build-${prdId}-v${prdVersion}`}
              className="inline-flex items-center gap-1 text-green-700 dark:text-green-300 underline hover:no-underline"
            >
              View progress →
            </a>
          </div>
        )}

        {/* Fork notice */}
        {needsFork && !result && (
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            You don&apos;t have push access to this repo. Changes will be pushed to a fork and a
            pull request will be created.
          </div>
        )}

        {/* Default branch warning */}
        {!needsFork && (
          <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
            The default branch ({repoDefaultBranch}) is protected. All integrations to it will
            create a pull request.
          </div>
        )}

        {!result && (
          <>
            {/* Target type selector */}
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">Push target</label>
              <div className="grid grid-cols-1 gap-2">
                <label
                  className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent transition-colors ${
                    targetType === 'new-branch' ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="targetType"
                    value="new-branch"
                    checked={targetType === 'new-branch'}
                    onChange={() => setTargetType('new-branch')}
                    className="sr-only"
                  />
                  <GitBranch className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">New branch</div>
                    <div className="text-xs text-muted-foreground">
                      Creates a new branch with auto-generated name
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent transition-colors ${
                    targetType === 'existing-branch' ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="targetType"
                    value="existing-branch"
                    checked={targetType === 'existing-branch'}
                    onChange={() => setTargetType('existing-branch')}
                    className="sr-only"
                  />
                  <GitBranch className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Existing branch</div>
                    <div className="text-xs text-muted-foreground">
                      Push directly to an existing branch
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent transition-colors ${
                    targetType === 'pull-request' ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="targetType"
                    value="pull-request"
                    checked={targetType === 'pull-request'}
                    onChange={() => setTargetType('pull-request')}
                    className="sr-only"
                  />
                  <GitPullRequest className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Pull request</div>
                    <div className="text-xs text-muted-foreground">
                      Creates a branch and opens a PR into {repoDefaultBranch}
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Branch name input */}
            <div className="mb-4">
              <label className="text-sm font-medium">
                {targetType === 'existing-branch' ? 'Branch name' : 'Branch name (optional)'}
              </label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder={
                  targetType === 'existing-branch'
                    ? 'main'
                    : autoBranchName
                }
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {targetType !== 'existing-branch' && !branchName && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Default: <code className="text-xs">{autoBranchName}</code>
                </p>
              )}
            </div>

            {/* Clean workspace option */}
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cleanWorkspace}
                  onChange={(e) => setCleanWorkspace(e.target.checked)}
                  className="rounded border-input"
                />
                <span className="text-sm">Clean workspace before integrating</span>
              </label>
              <p className="mt-1 text-xs text-muted-foreground ml-6">
                Deletes the existing workspace and re-clones from scratch. Useful when a previous
                attempt left the workspace in a bad state.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t">
              <button
                onClick={onClose}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={() => doSubmit(false)}
                disabled={
                  loading ||
                  (targetType === 'existing-branch' && !branchName.trim())
                }
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                <Hammer className="h-4 w-4" />
                Start Integration
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
