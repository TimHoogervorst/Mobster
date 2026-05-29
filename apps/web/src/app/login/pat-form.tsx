'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { savePatToken } from './actions'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

const initialState = { success: false, error: undefined as string | undefined }

export function PatForm() {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(savePatToken, initialState)

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => router.push('/'), 1000)
      return () => clearTimeout(timer)
    }
  }, [state?.success, router])

  if (state?.success) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <CheckCircle className="h-8 w-8 text-green-500" />
        <p className="font-medium">Connected successfully!</p>
        <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>{state.error}</p>
        </div>
      )}

      <div className="space-y-2 text-left">
        <input
          id="token"
          name="token"
          type="password"
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          required
          autoComplete="off"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? 'Connecting...' : 'Connect GitHub Account'}
      </button>

      <p className="text-xs text-muted-foreground text-center">
        Your token is encrypted at rest and never exposed to the client.
      </p>
    </form>
  )
}
