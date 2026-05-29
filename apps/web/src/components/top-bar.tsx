'use client'

import Link from 'next/link'
import { Menu } from 'lucide-react'
import { UserAvatar } from './user-avatar'

interface TopBarUser {
  name?: string | null
  email?: string | null
  image?: string | null
}

interface TopBarProps {
  user: TopBarUser | null
  onMenuClick: () => void
}

export function TopBar({ user, onMenuClick }: TopBarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <UserAvatar user={user} />
        ) : (
          <Link
            href="/login"
            className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Connect GitHub
          </Link>
        )}
      </div>
    </header>
  )
}
