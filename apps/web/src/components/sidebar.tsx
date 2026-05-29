'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FolderGit2,
  Inbox,
  FileText,
  Activity,
  Filter,
  Bot,
  Settings,
  X,
} from 'lucide-react'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Repos', href: '/repos', icon: FolderGit2 },
  { label: 'Inbox', href: '/inbox', icon: Inbox },
  { label: 'PRDs', href: '/prds', icon: FileText },
  { label: 'Runners', href: '/runners', icon: Activity },
  { label: 'Triage', href: '/triage', icon: Filter },
  { label: 'Agents', href: '/agents', icon: Bot },
  { label: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card transition-transform duration-200 md:relative md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b px-4">
          <Link href="/" className="text-lg font-bold" onClick={onClose}>
            Mobster
          </Link>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
