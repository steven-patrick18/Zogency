// Shared person avatar. Photos are data-URIs on users.avatar (set by HR on the
// employee profile, or by an admin on Settings → Users), so there is no image
// host to configure and next/image would give nothing here — hence the plain
// <img> and the lint exception.
//
// Falling back to initials rather than a generic silhouette keeps a team list
// readable when only some people have uploaded a photo.

const SIZES = {
  xs: { box: 'h-6 w-6', text: 'text-[10px]' },
  sm: { box: 'h-8 w-8', text: 'text-xs' },
  md: { box: 'h-10 w-10', text: 'text-sm' },
  lg: { box: 'h-16 w-16', text: 'text-lg' },
  xl: { box: 'h-20 w-20', text: 'text-xl' },
} as const

export type AvatarSize = keyof typeof SIZES

export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  )
}

export function Avatar({
  avatar,
  name,
  size = 'sm',
  className = '',
}: {
  avatar?: string | null
  name: string
  size?: AvatarSize
  className?: string
}) {
  const { box, text } = SIZES[size]
  if (avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatar}
        alt={name}
        title={name}
        className={`${box} shrink-0 rounded-full object-cover ${className}`}
      />
    )
  }
  return (
    <div
      title={name}
      className={`${box} ${text} flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-600 ${className}`}
    >
      {initialsOf(name)}
    </div>
  )
}
