'use client';

import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'live';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

export function Badge({
  className,
  variant = 'default',
  size = 'md',
  pulse = false,
  children,
  ...props
}: BadgeProps) {
  const baseStyles = `
    inline-flex items-center gap-1.5 font-semibold rounded-full
    border transition-colors
  `;

  const variants = {
    default: 'bg-bg-tertiary border-border text-text-secondary',
    success: 'bg-accent-primary/10 border-accent-primary/30 text-accent-primary',
    warning: 'bg-accent-yellow/10 border-accent-yellow/30 text-accent-yellow',
    danger: 'bg-accent-red/10 border-accent-red/30 text-accent-red',
    info: 'bg-accent-cyan/10 border-accent-cyan/30 text-accent-cyan',
    live: 'bg-accent-red/10 border-accent-red/30 text-accent-red',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-sm',
  };

  return (
    <span
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {(variant === 'live' || pulse) && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}
