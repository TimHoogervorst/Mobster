'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const TABS = [
  { key: 'issues', label: 'Issues' },
  { key: 'prs', label: 'Pull Requests' },
] as const

interface IntakeTabsProps {
  activeTab: string
}

export function IntakeTabs({ activeTab }: IntakeTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function switchTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    params.delete('page') // Reset pagination on tab switch
    router.push(`/intake?${params.toString()}`)
  }

  return (
    <div className="flex gap-1 border-b">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => switchTab(tab.key)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
            activeTab === tab.key
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
