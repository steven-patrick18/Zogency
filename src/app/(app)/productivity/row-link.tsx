'use client'

// Whole-row navigation for the productivity table (a <tr> can't be a <Link>).
import { useRouter } from 'next/navigation'

export function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter()
  return (
    <tr
      onClick={() => router.push(href)}
      className="cursor-pointer hover:bg-indigo-50/50"
      title="View full activity"
    >
      {children}
    </tr>
  )
}
