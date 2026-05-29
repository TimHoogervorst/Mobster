import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { auth } from '@/lib/auth'
import { AppShell } from '@/components/app-shell'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Mobster — AI-Powered GitHub Issue Manager',
  description:
    'Connect your GitHub repos, generate PRDs with AI, and schedule overnight code generation.',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const isConfigured = !!session?.accessToken

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AppShell
            user={session?.user ?? null}
            isConfigured={isConfigured}
          >
            {children}
          </AppShell>
        </ThemeProvider>
      </body>
    </html>
  )
}
