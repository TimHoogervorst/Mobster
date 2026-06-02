'use client'

import { useState } from 'react'
import { Hammer } from 'lucide-react'
import { IntegrateDialog } from '@/components/integrate-dialog'

interface IntegrateButtonProps {
  prdId: string
  prdTitle: string
  prdVersion: number
  repoFullName: string
  repoDefaultBranch: string
  isOwner: boolean
  hasPushAccess: boolean
  label?: string
}

export function IntegrateButton({
  prdId,
  prdTitle,
  prdVersion,
  repoFullName,
  repoDefaultBranch,
  isOwner,
  hasPushAccess,
  label = 'Integrate',
}: IntegrateButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Hammer className="h-4 w-4" />
        {label}
      </button>
      <IntegrateDialog
        prdId={prdId}
        prdTitle={prdTitle}
        prdVersion={prdVersion}
        repoFullName={repoFullName}
        repoDefaultBranch={repoDefaultBranch}
        isOwner={isOwner}
        hasPushAccess={hasPushAccess}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  )
}
