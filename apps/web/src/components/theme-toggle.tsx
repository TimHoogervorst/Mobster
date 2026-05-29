'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor } from 'lucide-react'

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="h-9 w-9" />
  }

  const themes = ['light', 'dark', 'system'] as const
  type Theme = (typeof themes)[number]

  const current = (theme as Theme) ?? 'system'
  const currentIndex = themes.indexOf(current)
  const nextIndex = (currentIndex + 1) % themes.length
  const nextTheme = themes[nextIndex] as Theme

  const icons: Record<Theme, typeof Sun> = {
    light: Sun,
    dark: Moon,
    system: Monitor,
  }

  const labels: Record<Theme, string> = {
    light: 'Light mode',
    dark: 'Dark mode',
    system: 'System',
  }

  const Icon = icons[current]

  return (
    <button
      onClick={() => setTheme(nextTheme)}
      className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      aria-label={`Theme: ${labels[current]}. Click for ${labels[nextTheme]}.`}
    >
      <Icon className="h-4 w-4" />
      <span>{labels[current]}</span>
    </button>
  )
}
