'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Edit, Archive, Play, CheckCircle2, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { PrdStatusBadge } from './prd-status-badge'

interface ProjectHeaderProps {
  project: {
    id: string
    name: string
    description: string | null
    status: string
    createdAt: string
  }
  repoFullName: string
}

export function ProjectHeader({ project, repoFullName }: ProjectHeaderProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function updateStatus(status: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        router.refresh()
      }
    } catch (err) {
      console.error('Failed to update project status:', err)
    } finally {
      setBusy(false)
    }
  }

  async function deleteProject() {
    if (!confirm('Delete this project and all its phases and items? This cannot be undone.')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/projects')
      }
    } catch (err) {
      console.error('Failed to delete project:', err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="h-4 w-4" />
        Projects
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight truncate">
              {project.name}
            </h1>
            <PrdStatusBadge status={project.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {repoFullName} · Created {new Date(project.createdAt).toLocaleDateString()}
          </p>
          {project.description && (
            <p className="text-sm mt-2 text-muted-foreground">
              {project.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {project.status === 'draft' && (
            <button
              onClick={() => updateStatus('active')}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              Activate
            </button>
          )}
          {project.status === 'active' && (
            <button
              onClick={() => updateStatus('testing')}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-yellow-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
            >
              Start Testing
            </button>
          )}
          {project.status === 'testing' && (
            <button
              onClick={() => updateStatus('complete')}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              Complete
            </button>
          )}
          {(project.status === 'active' || project.status === 'draft') && (
            <button
              onClick={() => updateStatus('archived')}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              <Archive className="h-4 w-4" />
              Archive
            </button>
          )}
          <button
            onClick={deleteProject}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-2 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
