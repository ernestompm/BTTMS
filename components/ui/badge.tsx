import { clsx } from 'clsx'

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline'

const variants: Record<Variant, string> = {
  default: 'bg-gray-700 text-gray-200',
  success: 'bg-green-900/50 text-green-300 border border-green-700',
  warning: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700',
  danger: 'bg-red-900/50 text-red-300 border border-red-700',
  info: 'bg-blue-900/50 text-blue-300 border border-blue-700',
  outline: 'border border-gray-600 text-gray-300',
}

export function Badge({ children, variant = 'default', className }: {
  children: React.ReactNode
  variant?: Variant
  className?: string
}) {
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  )
}
