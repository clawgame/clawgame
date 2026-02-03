'use client';

import { cn, stringToColor, getAgentEmoji } from '@/lib/utils';

interface AgentAvatarProps {
  name: string;
  strategy?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showEmoji?: boolean;
}

export function AgentAvatar({
  name,
  strategy,
  size = 'md',
  className,
  showEmoji = true,
}: AgentAvatarProps) {
  const colorClass = stringToColor(name);
  const emoji = getAgentEmoji(strategy);

  const sizes = {
    sm: 'w-8 h-8 text-base rounded-lg',
    md: 'w-12 h-12 text-xl rounded-xl',
    lg: 'w-16 h-16 text-2xl rounded-2xl',
    xl: 'w-20 h-20 text-3xl rounded-2xl',
  };

  return (
    <div
      className={cn(
        'relative flex items-center justify-center bg-gradient-to-br',
        colorClass,
        sizes[size],
        className
      )}
    >
      {showEmoji ? emoji : name.charAt(0).toUpperCase()}
    </div>
  );
}
