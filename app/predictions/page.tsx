'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { TrendingUp, Filter, Trophy, Clock, Users, History } from 'lucide-react';
import { Button, Card, Badge, Skeleton } from '@/components/ui';
import { BetSlip } from '@/components/predictions/BetSlip';
import { useMarkets, useLiveMatches, useUserBets } from '@/hooks';
import { useBetSlipStore } from '@/stores/betStore';
import { useUserStore } from '@/stores/userStore';
import { cn, formatUSDC, formatOdds, formatPercentage, formatRelativeTime, getArenaInfo } from '@/lib/utils';
import type { Market, Match } from '@/types';

type TabType = 'markets' | 'my-bets';
type MarketFilter = 'all' | 'winner' | 'agreement' | 'rounds';

export default function PredictionsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('markets');
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('all');

  const { data: markets, isLoading: marketsLoading } = useMarkets();
  const { data: matches } = useLiveMatches();
  const { data: userBets, isLoading: betsLoading } = useUserBets();
  const { selections, addSelection } = useBetSlipStore();
  const { isAuthenticated } = useUserStore();

  // Group markets by match
  const marketsByMatch = markets?.reduce((acc, market) => {
    if (!acc[market.matchId]) {
      acc[market.matchId] = [];
    }
    acc[market.matchId].push(market);
    return acc;
  }, {} as Record<string, Market[]>) || {};

  // Filter markets
  const filterMarket = (market: Market) => {
    if (marketFilter === 'all') return true;
    if (marketFilter === 'winner') return market.name.toLowerCase().includes('winner');
    if (marketFilter === 'agreement') return market.name.toLowerCase().includes('agreement');
    if (marketFilter === 'rounds') return market.name.toLowerCase().includes('round');
    return true;
  };

  const getMatchForMarket = (matchId: string): Match | undefined => {
    return matches?.find(m => m.id === matchId);
  };

  const handleSelectOption = (market: Market, option: typeof market.options[0], match: Match) => {
    addSelection({
      matchId: market.matchId,
      marketId: market.id,
      marketName: `${match.agents[0].name} vs ${match.agents[1].name} - ${market.name}`,
      option: option.id,
      optionName: option.name,
      odds: option.odds,
    });
  };

  const isSelected = (marketId: string, optionId: string) => {
    return selections.some(s => s.marketId === marketId && s.option === optionId);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8 text-accent-primary" />
            <h1 className="text-4xl font-bold">Prediction Markets</h1>
          </div>
          <p className="text-text-secondary">
            Every match is a market. Find your edge.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="text-sm text-text-muted mb-1">Active Markets</div>
            <div className="text-2xl font-bold">{markets?.filter(m => m.status === 'open').length || 0}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-text-muted mb-1">Total Pool</div>
            <div className="text-2xl font-bold text-accent-primary">
              {formatUSDC(markets?.reduce((sum, m) => sum + m.totalPool, 0) || 0)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-text-muted mb-1">Your Active Bets</div>
            <div className="text-2xl font-bold">{userBets?.active.length || 0}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-text-muted mb-1">Your Winnings</div>
            <div className="text-2xl font-bold text-accent-primary">
              {formatUSDC(
                userBets?.settled
                  .filter(b => b.status === 'won')
                  .reduce((sum, b) => sum + b.potentialWinnings, 0) || 0
              )}
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab('markets')}
            className={cn(
              'pb-3 px-1 font-semibold transition-colors border-b-2 -mb-px',
              activeTab === 'markets'
                ? 'text-accent-primary border-accent-primary'
                : 'text-text-muted border-transparent hover:text-text-primary'
            )}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Markets
            </div>
          </button>
          <button
            onClick={() => setActiveTab('my-bets')}
            className={cn(
              'pb-3 px-1 font-semibold transition-colors border-b-2 -mb-px',
              activeTab === 'my-bets'
                ? 'text-accent-primary border-accent-primary'
                : 'text-text-muted border-transparent hover:text-text-primary'
            )}
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" />
              My Bets
              {(userBets?.active.length || 0) > 0 && (
                <Badge variant="default" size="sm">{userBets?.active.length}</Badge>
              )}
            </div>
          </button>
        </div>

        {/* Markets Tab */}
        {activeTab === 'markets' && (
          <>
            {/* Filters */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-text-muted" />
                <span className="text-sm text-text-muted">Filter:</span>
              </div>
              <div className="flex gap-2">
                {(['all', 'winner', 'agreement', 'rounds'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setMarketFilter(filter)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg transition-colors capitalize',
                      marketFilter === filter
                        ? 'bg-accent-primary text-bg-primary font-semibold'
                        : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {filter === 'all' ? 'All Markets' : filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Markets Grid */}
            {marketsLoading ? (
              <div className="space-y-6">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-64 rounded-2xl" />
                ))}
              </div>
            ) : Object.keys(marketsByMatch).length === 0 ? (
              <Card className="p-12 text-center">
                <TrendingUp className="w-12 h-12 text-text-muted mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Active Markets</h3>
                <p className="text-text-secondary mb-6">
                  Markets appear when matches go live. Every outcome, an opportunity.
                </p>
                <Link href="/arena">
                  <Button>Browse Arena</Button>
                </Link>
              </Card>
            ) : (
              <div className="space-y-6">
                {Object.entries(marketsByMatch).map(([matchId, matchMarkets]) => {
                  const match = getMatchForMarket(matchId);
                  if (!match) return null;

                  const filteredMarkets = matchMarkets.filter(filterMarket);
                  if (filteredMarkets.length === 0) return null;

                  const arenaInfo = getArenaInfo(match.arena);

                  return (
                    <Card key={matchId} className="overflow-hidden">
                      {/* Match Header */}
                      <Link href={`/match/${matchId}`}>
                        <div className="px-6 py-4 bg-bg-tertiary border-b border-border hover:bg-bg-secondary transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <span className={`text-xl ${arenaInfo.color}`}>{arenaInfo.icon}</span>
                              <div>
                                <h3 className="font-semibold">
                                  {match.agents[0].name} vs {match.agents[1].name}
                                </h3>
                                <div className="flex items-center gap-3 text-sm text-text-muted">
                                  <span>{arenaInfo.name}</span>
                                  <span>Round {match.round}/{match.maxRounds}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="flex items-center gap-1 text-accent-primary">
                                  <Trophy className="w-4 h-4" />
                                  <span className="font-mono font-semibold">{formatUSDC(match.prizePool)}</span>
                                </div>
                                <div className="flex items-center gap-1 text-sm text-text-muted">
                                  <Users className="w-3 h-3" />
                                  <span>{match.spectatorCount} watching</span>
                                </div>
                              </div>
                              <Badge variant={match.status === 'live' ? 'live' : 'default'}>
                                {match.status === 'live' ? 'LIVE' : match.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </Link>

                      {/* Markets */}
                      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredMarkets.map((market) => (
                          <div key={market.id} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-sm">{market.name}</h4>
                              <span className="text-xs text-text-muted">
                                {formatUSDC(market.totalPool)} pool
                              </span>
                            </div>

                            <div className="space-y-2">
                              {market.options.map((option) => {
                                const selected = isSelected(market.id, option.id);

                                return (
                                  <motion.button
                                    key={option.id}
                                    onClick={() => handleSelectOption(market, option, match)}
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    className={cn(
                                      'w-full p-3 rounded-lg border transition-all text-left',
                                      'flex items-center justify-between',
                                      selected
                                        ? 'border-accent-primary bg-accent-primary/10'
                                        : 'border-border bg-bg-secondary hover:border-accent-primary/50'
                                    )}
                                  >
                                    <div>
                                      <span className={cn(
                                        'text-sm font-medium',
                                        selected && 'text-accent-primary'
                                      )}>
                                        {option.name}
                                      </span>
                                      <div className="text-xs text-text-muted mt-0.5">
                                        {formatPercentage(option.probability * 100)} implied
                                      </div>
                                    </div>
                                    <div className={cn(
                                      'px-2 py-1 rounded font-mono font-bold text-sm',
                                      selected
                                        ? 'bg-accent-primary text-bg-primary'
                                        : 'bg-bg-tertiary text-accent-primary'
                                    )}>
                                      {formatOdds(option.odds)}x
                                    </div>
                                  </motion.button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* My Bets Tab */}
        {activeTab === 'my-bets' && (
          <>
            {!isAuthenticated ? (
              <Card className="p-12 text-center">
                <History className="w-12 h-12 text-text-muted mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Connect to Continue</h3>
                <p className="text-text-secondary mb-6">
                  You&apos;ll need a wallet to place predictions. Don&apos;t worry, watching is always free.
                </p>
                <Button>Connect Wallet</Button>
              </Card>
            ) : betsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-24 rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Active Bets */}
                {userBets?.active && userBets.active.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-accent-yellow" />
                      Active Bets ({userBets.active.length})
                    </h3>
                    <div className="space-y-3">
                      {userBets.active.map((bet) => (
                        <Card key={bet.id} className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{bet.option}</p>
                              <p className="text-sm text-text-muted">
                                Stake: {formatUSDC(bet.stake)} at {formatOdds(bet.odds)}x
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-accent-primary font-mono font-semibold">
                                {formatUSDC(bet.potentialWinnings)}
                              </p>
                              <p className="text-xs text-text-muted">potential</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bet History */}
                {userBets?.settled && userBets.settled.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <History className="w-5 h-5 text-text-muted" />
                      History ({userBets.settled.length})
                    </h3>
                    <div className="space-y-3">
                      {userBets.settled.map((bet) => (
                        <Card key={bet.id} className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{bet.option}</p>
                                <Badge
                                  variant={bet.status === 'won' ? 'success' : 'danger'}
                                  size="sm"
                                >
                                  {bet.status === 'won' ? 'Won' : 'Lost'}
                                </Badge>
                              </div>
                              <p className="text-sm text-text-muted">
                                {formatRelativeTime(bet.settledAt || bet.createdAt)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={cn(
                                'font-mono font-semibold',
                                bet.status === 'won' ? 'text-accent-primary' : 'text-accent-red'
                              )}>
                                {bet.status === 'won' ? '+' : '-'}{formatUSDC(bet.status === 'won' ? bet.potentialWinnings : bet.stake)}
                              </p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {(!userBets?.active?.length && !userBets?.settled?.length) && (
                  <Card className="p-12 text-center">
                    <TrendingUp className="w-12 h-12 text-text-muted mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Bets Yet</h3>
                    <p className="text-text-secondary mb-6">
                      Start predicting match outcomes to see your bets here.
                    </p>
                    <Button onClick={() => setActiveTab('markets')}>
                      Browse Markets
                    </Button>
                  </Card>
                )}
              </div>
            )}
          </>
        )}

        {/* Bet Slip */}
        {selections.length > 0 && <BetSlip />}
      </div>
    </div>
  );
}
