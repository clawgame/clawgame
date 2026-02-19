'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Shield, Activity, Users, Wallet, SlidersHorizontal } from 'lucide-react';
import { useUserStore } from '@/stores/userStore';
import { Badge, Button, Card, CardContent, CardHeader, SkeletonCard } from '@/components/ui';
import { formatRelativeTime, formatUSDC, truncateAddress } from '@/lib/utils';

interface AdminApiError extends Error {
  status?: number;
}

async function fetchAdminJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload?.error || 'Request failed') as AdminApiError;
    error.status = response.status;
    throw error;
  }

  return payload as T;
}

interface PlatformConfigState {
  platformFee: string;
  predictionRake: string;
  minWithdrawal: string;
  maxWithdrawal: string;
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const walletAddress = useUserStore((state) => state.walletAddress);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const setWalletModalOpen = useUserStore((state) => state.setWalletModalOpen);

  const [statusFilter, setStatusFilter] = useState('live');
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  const [configState, setConfigState] = useState<PlatformConfigState>({
    platformFee: '',
    predictionRake: '',
    minWithdrawal: '',
    maxWithdrawal: '',
  });

  const statsQuery = useQuery({
    queryKey: ['admin', 'stats', walletAddress],
    queryFn: () =>
      fetchAdminJson<{
        users: { total: number };
        agents: { total: number; active: number };
        matches: { live: number; pending: number; completed: number; cancelled: number };
        balances: { platform: number; transactionVolume: number };
        notifications: { pendingEmail: number; pendingPush: number };
        feeConfig: {
          platformFee: number;
          predictionRake: number;
          minWithdrawal: number;
          maxWithdrawal: number;
          updatedAt: string;
        };
      }>(`/api/admin/stats?walletAddress=${encodeURIComponent(walletAddress || '')}`),
    enabled: !!walletAddress,
  });

  const matchesQuery = useQuery({
    queryKey: ['admin', 'matches', walletAddress, statusFilter],
    queryFn: () =>
      fetchAdminJson<{
        items: Array<{
          id: string;
          arena: string;
          status: string;
          agents: Array<{ id: string; name: string }>;
          prizePool: number;
          createdAt: string;
        }>;
      }>(
        `/api/admin/matches?walletAddress=${encodeURIComponent(walletAddress || '')}&status=${encodeURIComponent(statusFilter)}&limit=20`
      ),
    enabled: !!walletAddress,
  });

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', walletAddress],
    queryFn: () =>
      fetchAdminJson<{
        items: Array<{
          id: string;
          walletAddress: string;
          balance: number;
          createdAt: string;
          counts: { agents: number; bets: number; transactions: number; notifications: number };
        }>;
      }>(`/api/admin/users?walletAddress=${encodeURIComponent(walletAddress || '')}&limit=20`),
    enabled: !!walletAddress,
  });

  const configQuery = useQuery({
    queryKey: ['admin', 'config', walletAddress],
    queryFn: () =>
      fetchAdminJson<{
        config: {
          platformFee: number;
          predictionRake: number;
          minWithdrawal: number;
          maxWithdrawal: number;
          updatedAt: string;
        };
      }>(`/api/admin/config?walletAddress=${encodeURIComponent(walletAddress || '')}`),
    enabled: !!walletAddress,
  });

  useEffect(() => {
    if (!configQuery.data?.config) return;
    const { config } = configQuery.data;
    setConfigState({
      platformFee: String(config.platformFee),
      predictionRake: String(config.predictionRake),
      minWithdrawal: String(config.minWithdrawal),
      maxWithdrawal: String(config.maxWithdrawal),
    });
  }, [configQuery.data]);

  const cancelMatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      const response = await fetch('/api/admin/matches', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          matchId,
          action: 'cancel',
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Failed to cancel match');
      return payload;
    },
    onSuccess: () => {
      toast.success('Match cancelled');
      queryClient.invalidateQueries({ queryKey: ['admin', 'matches', walletAddress] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats', walletAddress] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const adjustBalanceMutation = useMutation({
    mutationFn: async ({ userId, amount }: { userId: string; amount: number }) => {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          userId,
          amount,
          reason: 'Admin dashboard adjustment',
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Failed to adjust balance');
      return payload;
    },
    onSuccess: () => {
      toast.success('Balance updated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', walletAddress] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats', walletAddress] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          platformFee: Number(configState.platformFee),
          predictionRake: Number(configState.predictionRake),
          minWithdrawal: Number(configState.minWithdrawal),
          maxWithdrawal: Number(configState.maxWithdrawal),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Failed to save config');
      return payload;
    },
    onSuccess: () => {
      toast.success('Fee configuration saved');
      queryClient.invalidateQueries({ queryKey: ['admin', 'config', walletAddress] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats', walletAddress] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const adminDenied = useMemo(() => {
    const errors = [statsQuery.error, matchesQuery.error, usersQuery.error, configQuery.error];
    return errors.some((error) => (error as AdminApiError | null)?.status === 403);
  }, [statsQuery.error, matchesQuery.error, usersQuery.error, configQuery.error]);

  if (!isAuthenticated || !walletAddress) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <Card className="p-10 text-center">
            <Shield className="w-10 h-10 mx-auto mb-4 text-accent-primary" />
            <h1 className="text-3xl font-bold mb-3">Admin Dashboard</h1>
            <p className="text-text-secondary mb-6">
              Connect an admin wallet to manage platform operations.
            </p>
            <Button onClick={() => setWalletModalOpen(true)}>Login</Button>
          </Card>
        </div>
      </div>
    );
  }

  if (adminDenied) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-3xl mx-auto">
          <Card className="p-8 text-center">
            <h1 className="text-2xl font-bold mb-2">Admin Access Denied</h1>
            <p className="text-text-secondary">
              Wallet `{truncateAddress(walletAddress, 4)}` is not in `ADMIN_WALLET_ADDRESSES`.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  const isLoading =
    statsQuery.isLoading || matchesQuery.isLoading || usersQuery.isLoading || configQuery.isLoading;

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-7xl mx-auto space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      </div>
    );
  }

  const stats = statsQuery.data;
  const matches = matchesQuery.data?.items || [];
  const users = usersQuery.data?.items || [];
  const configUpdatedAt = configQuery.data?.config.updatedAt;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-text-secondary">
            Monitor platform health, manage users/matches, and configure platform fees.
          </p>
        </div>

        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
            <StatCard icon={<Users className="w-4 h-4" />} label="Users" value={String(stats.users.total)} />
            <StatCard icon={<Shield className="w-4 h-4" />} label="Agents" value={`${stats.agents.active}/${stats.agents.total}`} />
            <StatCard icon={<Activity className="w-4 h-4" />} label="Live Matches" value={String(stats.matches.live)} />
            <StatCard icon={<Wallet className="w-4 h-4" />} label="Platform Balance" value={formatUSDC(stats.balances.platform)} />
            <StatCard icon={<Activity className="w-4 h-4" />} label="Pending Email" value={String(stats.notifications.pendingEmail)} />
            <StatCard icon={<Activity className="w-4 h-4" />} label="Pending Push" value={String(stats.notifications.pendingPush)} />
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          <Card className="xl:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-accent-primary" />
                <h2 className="text-lg font-semibold">Match Management</h2>
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-xs text-text-secondary focus:outline-none focus:border-accent-primary"
              >
                <option value="live">Live</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </CardHeader>
            <CardContent>
              {matches.length === 0 ? (
                <p className="text-sm text-text-muted">No matches for this filter.</p>
              ) : (
                <div className="space-y-3">
                  {matches.map((match) => (
                    <div key={match.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-bg-tertiary border border-border">
                      <div>
                        <div className="text-sm font-semibold">
                          {match.agents[0]?.name || 'Unknown'} vs {match.agents[1]?.name || 'Unknown'}
                        </div>
                        <div className="text-xs text-text-muted">
                          {match.arena} • {formatUSDC(match.prizePool)} • {formatRelativeTime(match.createdAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={match.status === 'live' ? 'live' : 'default'}>{match.status}</Badge>
                        {(match.status === 'live' || match.status === 'pending') && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => cancelMatchMutation.mutate(match.id)}
                            isLoading={cancelMatchMutation.isPending}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-accent-primary" />
                <h2 className="text-lg font-semibold">Fee Configuration</h2>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <ConfigInput label="Platform Fee (0-0.5)" value={configState.platformFee} onChange={(value) => setConfigState((prev) => ({ ...prev, platformFee: value }))} />
                <ConfigInput label="Prediction Rake (0-0.5)" value={configState.predictionRake} onChange={(value) => setConfigState((prev) => ({ ...prev, predictionRake: value }))} />
                <ConfigInput label="Min Withdrawal (USDC)" value={configState.minWithdrawal} onChange={(value) => setConfigState((prev) => ({ ...prev, minWithdrawal: value }))} />
                <ConfigInput label="Max Withdrawal (USDC)" value={configState.maxWithdrawal} onChange={(value) => setConfigState((prev) => ({ ...prev, maxWithdrawal: value }))} />
                <Button
                  className="w-full"
                  onClick={() => saveConfigMutation.mutate()}
                  isLoading={saveConfigMutation.isPending}
                >
                  Save Config
                </Button>
                {configUpdatedAt && (
                  <p className="text-xs text-text-muted">
                    Updated {formatRelativeTime(configUpdatedAt)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-accent-primary" />
              <h2 className="text-lg font-semibold">User Management</h2>
            </div>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <p className="text-sm text-text-muted">No users found.</p>
            ) : (
              <div className="space-y-3">
                {users.map((user) => {
                  const draft = adjustments[user.id] || '';
                  return (
                    <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-bg-tertiary border border-border">
                      <div>
                        <div className="text-sm font-semibold font-mono">{truncateAddress(user.walletAddress, 6)}</div>
                        <div className="text-xs text-text-muted">
                          Balance: {formatUSDC(user.balance)} • Agents: {user.counts.agents} • Bets: {user.counts.bets}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="+/- USDC"
                          value={draft}
                          onChange={(event) =>
                            setAdjustments((prev) => ({
                              ...prev,
                              [user.id]: event.target.value,
                            }))
                          }
                          className="w-28 bg-bg-primary border border-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-accent-primary"
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            const amount = Number(draft);
                            if (!amount || Number.isNaN(amount)) {
                              toast.error('Enter a non-zero adjustment amount');
                              return;
                            }
                            adjustBalanceMutation.mutate({ userId: user.id, amount });
                            setAdjustments((prev) => ({ ...prev, [user.id]: '' }));
                          }}
                          isLoading={adjustBalanceMutation.isPending}
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-text-muted text-xs mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </Card>
  );
}

function ConfigInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-text-muted">{label}</span>
      <input
        type="number"
        step="0.0001"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary"
      />
    </label>
  );
}
