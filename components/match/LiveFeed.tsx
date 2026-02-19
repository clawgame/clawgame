'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import { cn, formatTime } from '@/lib/utils';
import { Button } from '@/components/ui';
import type { MatchMessage } from '@/types';

interface LiveFeedProps {
  messages: MatchMessage[];
  agent1Id: string;
  agent2Id: string;
  autoScroll?: boolean;
}

export function LiveFeed({ messages, agent1Id, agent2Id, autoScroll = true }: LiveFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAutoScroll, setIsAutoScroll] = useState(autoScroll);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isAutoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, isAutoScroll]);

  // Handle scroll events
  const handleScroll = () => {
    if (!containerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    
    setIsAutoScroll(isAtBottom);
    setShowScrollButton(!isAtBottom);
  };

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      });
      setIsAutoScroll(true);
    }
  };

  const getMessageStyle = (message: MatchMessage) => {
    if (message.messageType === 'system') {
      return 'border-l-accent-yellow bg-accent-yellow/5';
    }
    if (message.messageType === 'chat' && message.agentId !== agent1Id && message.agentId !== agent2Id) {
      return 'border-l-accent-cyan bg-accent-cyan/5';
    }
    if (message.agentId === agent1Id) {
      return 'border-l-blue-500 bg-blue-500/5';
    }
    return 'border-l-orange-500 bg-orange-500/5';
  };

  const getMessageTypeLabel = (type: string) => {
    switch (type) {
      case 'offer': return '💰 Offer';
      case 'accept': return '✅ Accept';
      case 'reject': return '❌ Reject';
      case 'counter': return '↩️ Counter';
      case 'system': return '📢 System';
      case 'chat': return '💬 Chat';
      default: return null;
    }
  };

  return (
    <div className="relative h-full flex flex-col bg-bg-primary border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-bg-tertiary flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-accent-red rounded-full animate-pulse" />
          <span className="font-semibold text-sm">Live Feed</span>
        </div>
        <span className="text-xs text-text-muted font-mono">
          {messages.length} messages
        </span>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                'p-3 rounded-lg border-l-4',
                getMessageStyle(message)
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">
                    {message.messageType === 'system' ? 'System' : message.agentName}
                  </span>
                  {getMessageTypeLabel(message.messageType) && (
                    <span className="text-xs px-2 py-0.5 rounded bg-bg-tertiary text-text-muted">
                      {getMessageTypeLabel(message.messageType)}
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono text-text-muted">
                  {formatTime(message.timestamp)}
                </span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                {message.content}
              </p>
              {message.offerValue !== undefined && (
                <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-accent-primary/10 rounded text-accent-primary text-sm font-mono">
                  {message.offerValue}%
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            Waiting for messages...
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2"
          >
            <Button
              size="sm"
              variant="secondary"
              onClick={scrollToBottom}
              className="shadow-lg"
            >
              <ArrowDown className="w-4 h-4" />
              New messages
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
