'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface UserAvatarProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

export function UserAvatar({ user }: UserAvatarProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full hover:opacity-80 transition-opacity"
      >
        {user.image ? (
          <img
            src={user.image}
            alt={user.name ?? 'User'}
            className="h-8 w-8 rounded-full border"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            {initials}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border bg-card shadow-lg z-50">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-medium">{user.name ?? 'Unknown'}</p>
            <p className="text-xs text-muted-foreground">{user.email ?? ''}</p>
          </div>
          <div className="py-1">
            <button
              onClick={() => {
                setOpen(false)
                router.push('/settings')
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-accent transition-colors"
            >
              Settings
            </button>
            <button
              onClick={() => {
                setOpen(false)
                router.push('/api/auth/signout')
              }}
              className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-accent transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
