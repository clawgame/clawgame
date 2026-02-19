'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Sparkles, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, Badge } from '@/components/ui';
import { useUserStore } from '@/stores/userStore';
import * as api from '@/lib/api';

type StrategyMode = 'aggressive' | 'defensive' | 'balanced' | 'chaotic' | 'custom';

const STRATEGY_PRESETS: Array<{
  id: StrategyMode;
  label: string;
  description: string;
}> = [
  { id: 'aggressive', label: 'Aggressive', description: 'Pushes for bigger shares and quick pressure plays.' },
  { id: 'balanced', label: 'Balanced', description: 'Stable profile tuned for consistent outcomes.' },
  { id: 'defensive', label: 'Defensive', description: 'Accepts slower deals to avoid downside.' },
  { id: 'chaotic', label: 'Chaotic', description: 'High-variance behavior with unpredictable concessions.' },
  { id: 'custom', label: 'Custom Builder', description: 'Tune negotiation logic with live controls.' },
];

interface BuilderState {
  openingBase: number;
  ratingInfluence: number;
  randomRange: number;
  concessionMin: number;
  concessionMax: number;
  floorBase: number;
  urgencyDrop: number;
  acceptanceGenerous: number;
  acceptanceGood: number;
  acceptanceFair: number;
  acceptanceTight: number;
  acceptanceBelow: number;
  bluffProbability: number;
  emotionalVolatility: number;
  timePreferencePressure: number;
}

const DEFAULT_BUILDER: BuilderState = {
  openingBase: 54,
  ratingInfluence: 3,
  randomRange: 2,
  concessionMin: 1,
  concessionMax: 3,
  floorBase: 45,
  urgencyDrop: 5,
  acceptanceGenerous: 0.95,
  acceptanceGood: 0.75,
  acceptanceFair: 0.5,
  acceptanceTight: 0.3,
  acceptanceBelow: 0.05,
  bluffProbability: 0.25,
  emotionalVolatility: 0.5,
  timePreferencePressure: 0.6,
};

export default function CreateAgentPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [strategy, setStrategy] = useState<StrategyMode>('balanced');
  const [builder, setBuilder] = useState<BuilderState>(DEFAULT_BUILDER);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { isAuthenticated, walletAddress, setWalletModalOpen, addAgent } = useUserStore();

  const strategyConfig = useMemo(() => {
    const concessionMin = Math.min(builder.concessionMin, builder.concessionMax);
    const concessionMax = Math.max(builder.concessionMin, builder.concessionMax);

    return {
      openingOffer: {
        base: builder.openingBase,
        ratingInfluence: builder.ratingInfluence,
        randomRange: builder.randomRange,
      },
      concession: {
        min: concessionMin,
        max: concessionMax,
      },
      floor: {
        base: builder.floorBase,
        urgencyDrop: builder.urgencyDrop,
      },
      acceptance: {
        generous: builder.acceptanceGenerous,
        good: builder.acceptanceGood,
        fair: builder.acceptanceFair,
        tight: builder.acceptanceTight,
        below: builder.acceptanceBelow,
      },
      bluffProbability: builder.bluffProbability,
      emotionalVolatility: builder.emotionalVolatility,
      timePreferencePressure: builder.timePreferencePressure,
    };
  }, [builder]);

  const handleCreateAgent = async () => {
    if (!isAuthenticated) {
      setWalletModalOpen(true);
      return;
    }

    const trimmed = name.trim();
    if (trimmed.length < 3) {
      toast.error('Agent name must be at least 3 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.registerAgent({
        name: trimmed,
        bio: bio.trim() || undefined,
        strategy: strategy === 'custom' ? 'custom' : strategy,
        walletAddress: walletAddress || undefined,
        strategyConfig: strategy === 'custom' ? strategyConfig : undefined,
      });

      if (!response.success || !response.data) {
        toast.error(response.error || 'Failed to create agent');
        return;
      }

      addAgent(response.data);
      toast.success(`Agent "${response.data.name}" created`);
      router.push(`/agents/${response.data.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-3xl mx-auto">
          <Card className="p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-accent-primary/15 text-accent-primary mx-auto mb-4 flex items-center justify-center">
              <Bot className="w-7 h-7" />
            </div>
            <h1 className="text-3xl font-bold mb-3">Create Your Agent</h1>
            <p className="text-text-secondary mb-6">
              Login to register an agent and configure its strategy profile.
            </p>
            <Button onClick={() => setWalletModalOpen(true)}>Login to Continue</Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link href="/dashboard" className="text-sm text-text-muted hover:text-text-primary transition-colors">
            Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold mt-2">Agent Builder</h1>
          <p className="text-text-secondary mt-2 max-w-3xl">
            Configure identity, strategy, and behavior controls before deploying your next competitor.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <Card className="p-6 xl:col-span-3">
            <div className="flex items-center gap-2 mb-5">
              <Sparkles className="w-5 h-5 text-accent-primary" />
              <h2 className="text-xl font-semibold">Profile Setup</h2>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm text-text-muted block mb-1">Agent Name</label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. QuantumNegotiator"
                  className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary"
                />
              </div>

              <div>
                <label className="text-sm text-text-muted block mb-1">Bio (optional)</label>
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  rows={3}
                  placeholder="Describe your edge in the arena..."
                  className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary resize-none"
                />
              </div>
            </div>

            <div className="mb-4 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-accent-primary" />
              <h3 className="font-semibold">Strategy Profile</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              {STRATEGY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setStrategy(preset.id)}
                  className={`text-left border rounded-xl p-3 transition-colors ${
                    strategy === preset.id
                      ? 'border-accent-primary bg-accent-primary/10'
                      : 'border-border bg-bg-tertiary hover:border-accent-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm">{preset.label}</p>
                    {strategy === preset.id && <Badge variant="success" size="sm">Selected</Badge>}
                  </div>
                  <p className="text-xs text-text-muted mt-1">{preset.description}</p>
                </button>
              ))}
            </div>

            {strategy === 'custom' && (
              <div className="space-y-5 border border-border rounded-2xl p-4 bg-bg-secondary/40">
                <RangeControl
                  label="Opening Offer Base"
                  hint="Starting claim percentage"
                  value={builder.openingBase}
                  min={35}
                  max={75}
                  step={1}
                  onChange={(value) => setBuilder((state) => ({ ...state, openingBase: value }))}
                />

                <RangeControl
                  label="Concession Range"
                  hint="Minimum and maximum concession per round"
                  value={builder.concessionMin}
                  min={-5}
                  max={10}
                  step={0.5}
                  onChange={(value) => setBuilder((state) => ({ ...state, concessionMin: value }))}
                  secondaryValue={builder.concessionMax}
                  onSecondaryChange={(value) => setBuilder((state) => ({ ...state, concessionMax: value }))}
                />

                <RangeControl
                  label="Floor Base"
                  hint="Minimum acceptable split"
                  value={builder.floorBase}
                  min={30}
                  max={60}
                  step={1}
                  onChange={(value) => setBuilder((state) => ({ ...state, floorBase: value }))}
                />

                <RangeControl
                  label="Bluff Probability"
                  hint="Chance to inject bluffing behavior"
                  value={builder.bluffProbability}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(value) => setBuilder((state) => ({ ...state, bluffProbability: value }))}
                />

                <RangeControl
                  label="Emotional Volatility"
                  hint="Higher values make behavior less predictable"
                  value={builder.emotionalVolatility}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(value) => setBuilder((state) => ({ ...state, emotionalVolatility: value }))}
                />
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                onClick={handleCreateAgent}
                isLoading={isSubmitting}
                disabled={!name.trim()}
              >
                Create Agent
              </Button>
              <Button
                variant="secondary"
                onClick={() => setBuilder(DEFAULT_BUILDER)}
                disabled={strategy !== 'custom'}
              >
                Reset Custom Controls
              </Button>
            </div>
          </Card>

          <Card className="p-6 xl:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Config Preview</h2>
              <Badge variant={strategy === 'custom' ? 'success' : 'default'} size="sm">
                {strategy === 'custom' ? 'Custom JSON' : `${strategy} preset`}
              </Badge>
            </div>
            <p className="text-xs text-text-muted mb-3">
              This payload is sent to `/api/agents/register`.
            </p>
            <pre className="text-xs leading-5 rounded-xl border border-border bg-bg-tertiary p-3 overflow-auto max-h-[420px]">
{JSON.stringify(
  {
    name: name.trim() || '<agent-name>',
    bio: bio.trim() || undefined,
    strategy,
    walletAddress: walletAddress || undefined,
    strategyConfig: strategy === 'custom' ? strategyConfig : undefined,
  },
  null,
  2
)}
            </pre>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface RangeControlProps {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  secondaryValue?: number;
  onSecondaryChange?: (value: number) => void;
}

function RangeControl({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
  secondaryValue,
  onSecondaryChange,
}: RangeControlProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-text-muted">{hint}</p>
        </div>
        <div className="text-xs font-mono text-text-muted">
          {value.toFixed(step < 1 ? 2 : 0)}
          {secondaryValue != null ? ` / ${secondaryValue.toFixed(step < 1 ? 2 : 0)}` : ''}
        </div>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(parseFloat(event.target.value))}
        className="w-full accent-accent-primary"
      />

      {secondaryValue != null && onSecondaryChange && (
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={secondaryValue}
          onChange={(event) => onSecondaryChange(parseFloat(event.target.value))}
          className="w-full accent-accent-cyan"
        />
      )}
    </div>
  );
}
