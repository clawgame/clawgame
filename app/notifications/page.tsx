'use client';

import { motion } from 'framer-motion';
import { Bell, CheckCircle2, Trophy, CircleDollarSign } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, Badge, SkeletonCard } from '@/components/ui';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/hooks';
import { useUserStore } from '@/stores/userStore';
import { formatRelativeTime } from '@/lib/utils';

function NotificationIcon({ type }: { type: 'match_result' | 'bet_settlement' }) {
  if (type === 'match_result') {
    return <Trophy className="w-4 h-4 text-accent-primary" />;
  }
  return <CircleDollarSign className="w-4 h-4 text-accent-cyan" />;
}

export default function NotificationsPage() {
  const walletAddress = useUserStore((state) => state.walletAddress);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const setWalletModalOpen = useUserStore((state) => state.setWalletModalOpen);

  const { data, isLoading, isFetching } = useNotifications({ limit: 50 });
  const markOneRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  if (!isAuthenticated || !walletAddress) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <Card className="p-10 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-accent-primary/10 flex items-center justify-center">
              <Bell className="w-7 h-7 text-accent-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Notification Inbox</h1>
            <p className="text-text-secondary mb-6">
              Connect your wallet to see match result and bet settlement alerts.
            </p>
            <Button onClick={() => setWalletModalOpen(true)}>Connect Wallet</Button>
          </Card>
        </div>
      </div>
    );
  }

  const notifications = data?.items || [];
  const unreadCount = data?.unreadCount || 0;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Notifications</h1>
            <p className="text-text-secondary">
              Match outcomes and bet settlements, delivered in one inbox.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={unreadCount > 0 ? 'success' : 'default'}>
              {unreadCount} unread
            </Badge>
            <Button
              variant="secondary"
              onClick={() => markAllRead.mutate()}
              disabled={unreadCount === 0}
              isLoading={markAllRead.isPending}
            >
              Mark all read
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <Card className="p-10 text-center">
            <h2 className="text-xl font-semibold mb-2">No notifications yet</h2>
            <p className="text-text-secondary">
              New match results and bet settlements will appear here.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification, index) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card className={notification.isRead ? 'opacity-80' : ''}>
                  <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <NotificationIcon type={notification.type} />
                      <h3 className="font-semibold text-base">{notification.title}</h3>
                      {!notification.isRead && (
                        <span className="w-2 h-2 rounded-full bg-accent-primary" aria-label="Unread" />
                      )}
                    </div>
                    <div className="text-xs text-text-muted">
                      {formatRelativeTime(notification.createdAt)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-text-secondary mb-4">{notification.message}</p>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <span>Email: {notification.emailStatus}</span>
                        <span>•</span>
                        <span>Push: {notification.pushStatus}</span>
                        {isFetching && <span>• refreshing...</span>}
                      </div>
                      {!notification.isRead && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => markOneRead.mutate(notification.id)}
                          isLoading={markOneRead.isPending}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Mark as read
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
