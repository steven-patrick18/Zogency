import { requireSession, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { disableTotpAction } from '@/modules/security/actions'
import { TotpSetup } from './totp-setup'

export default async function SecurityPage() {
  const session = await requireSession()
  const user = await withTenant(() =>
    prisma.user.findUnique({ where: { id: session.user.id }, select: { totpEnabled: true } }),
  )
  const enabled = user?.totpEnabled ?? false

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Two-factor authentication</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Protect your own account with a time-based one-time passcode (TOTP).
        </p>
        {enabled ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">
              2FA is on — you will be asked for a code at login.
            </p>
            <form
              action={async () => {
                'use server'
                await disableTotpAction()
              }}
            >
              <button className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                Disable 2FA
              </button>
            </form>
          </div>
        ) : (
          <TotpSetup />
        )}
      </div>
    </div>
  )
}
