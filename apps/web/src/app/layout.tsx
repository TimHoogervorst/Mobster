import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { auth } from '@/lib/auth'
import { UserAvatar } from '@/components/user-avatar'
import Link from 'next/link'
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
          <div className="flex min-h-screen flex-col">
            {/* Setup banner */}
            {!isConfigured && (
              <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 text-center text-sm">
                <span className="text-muted-foreground">
                  Mobster needs your GitHub Personal Access Token.{' '}
                </span>
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Set up now →
                </Link>
              </div>
            )}

            <header className="border-b">
              <div className="container mx-auto flex h-16 items-center px-4">
                <a href="/" className="text-xl font-bold">
                  🕵️ Mobster
                </a>
                <nav className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
                  <a href="/inbox" className="hover:text-foreground transition-colors">
                    Inbox
                  </a>
                  <a href="/prds" className="hover:text-foreground transition-colors">
                    PRDs
                  </a>
                  <a href="/jobs" className="hover:text-foreground transition-colors">
                    Jobs
                  </a>
                  <a href="/settings" className="hover:text-foreground transition-colors">
                    Settings
                  </a>
                  {session?.user ? (
                    <UserAvatar user={session.user} />
                  ) : (
                    <Link
                      href="/login"
                      className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      Connect GitHub
                    </Link>
                  )}
                </nav>
              </div>
            </header>
            <main className="container mx-auto flex-1 px-4 py-8">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
