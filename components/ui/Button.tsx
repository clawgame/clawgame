'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    const baseStyles = `
      inline-flex items-center justify-center gap-2
      font-semibold rounded-xl border
      transition-all duration-300
      disabled:opacity-50 disabled:cursor-not-allowed
      focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary
      active:translate-y-[1px]
    `;

    const variants = {
      primary: `
        border-accent-primary/40 text-white
        bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-primary
        shadow-glow-green
        hover:shadow-glow-green-lg hover:-translate-y-0.5 hover:brightness-110
      `,
      secondary: `
        bg-bg-tertiary/80 text-text-primary
        border-border
        hover:border-accent-secondary/60 hover:text-white hover:bg-bg-elevated
      `,
      ghost: `
        bg-transparent text-text-secondary border-transparent
        hover:text-white hover:bg-bg-tertiary/70 hover:border-border
      `,
      danger: `
        bg-accent-red/10 text-accent-red border-accent-red/30
        hover:bg-accent-red/20 hover:border-accent-red/60
      `,
      success: `
        bg-accent-primary/10 text-accent-secondary border-accent-primary/30
        hover:bg-accent-primary/20 hover:border-accent-primary/60
      `,
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
