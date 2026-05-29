import { auth } from '@/lib/auth'
import { PatForm } from './pat-form'

export default async function LoginPage() {
  const session = await auth()

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-lg border p-8 text-center">
        <h1 className="text-2xl font-bold">Mobster</h1>

        {session ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              {session.user.image && (
                <img
                  src={session.user.image}
                  alt={session.user.name ?? ''}
                  className="h-10 w-10 rounded-full border"
                />
              )}
              <div className="text-left">
                <p className="font-medium">Connected as @{session.user.name}</p>
                <p className="text-xs text-muted-foreground">
                  Token is encrypted at rest
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <p className="text-muted-foreground">
              Enter your GitHub Personal Access Token to connect your account.
            </p>
            <PatForm />
            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground text-left">
              <p className="font-medium mb-1">How to create a token:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>
                  Go to{' '}
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    github.com/settings/tokens
                  </a>
                </li>
                <li>Click &ldquo;Generate new token (classic)&rdquo;</li>
                <li>
                  Select scopes: <strong>repo</strong>, <strong>read:user</strong>
                </li>
                <li>Copy the generated token and paste it below</li>
              </ol>
            </div>
          </>
        )}

        <div className="text-xs text-muted-foreground">
          <a href="/" className="hover:underline">
            ← Back to dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
