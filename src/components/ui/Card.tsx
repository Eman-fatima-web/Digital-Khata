import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '../../lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  isGlass?: boolean
}

export function Card({ children, className, isGlass, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-surface-hairline shadow-sm',
        isGlass
          ? 'bg-surface-card/80 backdrop-blur-md'
          : 'bg-surface-card',
        'transition-all duration-200',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  children: ReactNode
  className?: string
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={cn('border-b border-surface-hairline px-5 py-4', className)}>
      {children}
    </div>
  )
}

interface CardTitleProps {
  children: ReactNode
  className?: string
}

export function CardTitle({ children, className }: CardTitleProps) {
  return (
    <h3 className={cn('font-bold text-ink', className)}>{children}</h3>
  )
}

interface CardContentProps {
  children: ReactNode
  className?: string
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={cn('p-5', className)}>{children}</div>
}
