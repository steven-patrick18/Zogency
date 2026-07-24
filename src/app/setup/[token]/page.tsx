// One-time first-login setup (vendor-provisioned installs): the client opens
// the shared /setup/<token> link, confirms their name, and sets their password.
import { prismaUnscoped } from '@/lib/db/prisma'
import { SetupForm } from './setup-form'

export default async function SetupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const user = await prismaUnscoped.user.findUnique({
    where: { setupToken: token },
    select: { name: true, email: true },
  })

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">Zogency</h1>
          <p className="mt-1 text-sm text-slate-400">
            {user ? 'Welcome — set up your admin account' : 'Setup link'}
          </p>
        </div>
        {user ? (
          <SetupForm token={token} email={user.email} defaultName={user.name} />
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-300">
            This setup link has already been used or is invalid.
            <br />
            <a href="/login" className="mt-2 inline-block text-indigo-400 hover:underline">
              Go to login →
            </a>
          </div>
        )}
      </div>
    </main>
  )
}
