import {
  MAX_WITHDRAWAL,
  MIN_WITHDRAWAL,
  PLATFORM_FEE,
  PREDICTION_RAKE,
} from '@/lib/constants';

export interface PlatformConfig {
  platformFee: number;
  predictionRake: number;
  minWithdrawal: number;
  maxWithdrawal: number;
  updatedAt: string;
}

const globalForPlatformConfig = globalThis as unknown as {
  platformConfig: PlatformConfig | undefined;
};

function createDefaultConfig(): PlatformConfig {
  return {
    platformFee: PLATFORM_FEE,
    predictionRake: PREDICTION_RAKE,
    minWithdrawal: MIN_WITHDRAWAL,
    maxWithdrawal: MAX_WITHDRAWAL,
    updatedAt: new Date().toISOString(),
  };
}

export function getPlatformConfig(): PlatformConfig {
  if (!globalForPlatformConfig.platformConfig) {
    globalForPlatformConfig.platformConfig = createDefaultConfig();
  }

  return globalForPlatformConfig.platformConfig;
}

export function updatePlatformConfig(
  partial: Partial<Pick<PlatformConfig, 'platformFee' | 'predictionRake' | 'minWithdrawal' | 'maxWithdrawal'>>
): PlatformConfig {
  const current = getPlatformConfig();
  const next: PlatformConfig = {
    ...current,
    ...partial,
    updatedAt: new Date().toISOString(),
  };

  if (next.platformFee < 0 || next.platformFee > 0.5) {
    throw new Error('platformFee must be between 0 and 0.5');
  }

  if (next.predictionRake < 0 || next.predictionRake > 0.5) {
    throw new Error('predictionRake must be between 0 and 0.5');
  }

  if (next.minWithdrawal <= 0) {
    throw new Error('minWithdrawal must be greater than 0');
  }

  if (next.maxWithdrawal <= next.minWithdrawal) {
    throw new Error('maxWithdrawal must be greater than minWithdrawal');
  }

  globalForPlatformConfig.platformConfig = next;
  return next;
}
