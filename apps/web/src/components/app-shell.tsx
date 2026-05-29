'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'

interface AppShellUser {
  name?: string | null
  email?: string | null
  image?: string | null
}

interface AppShellProps {
  user: AppShellUser | null
  isConfigured: boolean
  children: React.ReactNode
}

export function AppShell({ user, isConfigured, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar user={user} onMenuClick={() => setSidebarOpen(true)} />

        {/* Setup banner */}
        {!isConfigured && (
          <div className="border-b border-primary/20 bg-primary/10 px-4 py-2 text-center text-sm">
            <span className="text-muted-foreground">
              Mobster needs your GitHub Personal Access Token.{' '}
            </span>
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              Set up now →
            </Link>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
