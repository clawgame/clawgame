interface EnvResolution {
  value: string | null;
  source: string | null;
}

export interface PrivyCredentials {
  appId: string;
  appSecret: string;
  appIdSource: string;
  appSecretSource: string;
}

export interface PrivyConfigDiagnostics {
  auth: {
    configured: boolean;
    appIdSource: string | null;
    appSecretSource: string | null;
  };
  agentic: {
    configured: boolean;
    appIdSource: string | null;
    appSecretSource: string | null;
  };
  warnings: string[];
}

function resolveEnv(...keys: string[]): EnvResolution {
  for (const key of keys) {
    const rawValue = process.env[key];
    const value = rawValue?.trim();

    if (value) {
      return { value, source: key };
    }
  }

  return { value: null, source: null };
}

function getAuthCredentialResolution() {
  const appId = resolveEnv('PRIVY_AUTH_APP_ID', 'NEXT_PUBLIC_PRIVY_APP_ID');
  const appSecret = resolveEnv('PRIVY_AUTH_APP_SECRET', 'PRIVY_APP_SECRET');

  return { appId, appSecret };
}

function getAgenticCredentialResolution() {
  const appId = resolveEnv('AGENTIC_PRIVY_APP_ID', 'PRIVY_APP_ID');
  const appSecret = resolveEnv('AGENTIC_PRIVY_APP_SECRET', 'PRIVY_APP_SECRET');

  return { appId, appSecret };
}

export function getAuthPrivyCredentials(): PrivyCredentials {
  const { appId, appSecret } = getAuthCredentialResolution();

  if (!appId.value || !appSecret.value || !appId.source || !appSecret.source) {
    throw new Error(
      'Missing Privy auth credentials. Set PRIVY_AUTH_APP_ID (or NEXT_PUBLIC_PRIVY_APP_ID) and PRIVY_AUTH_APP_SECRET (or PRIVY_APP_SECRET).'
    );
  }

  return {
    appId: appId.value,
    appSecret: appSecret.value,
    appIdSource: appId.source,
    appSecretSource: appSecret.source,
  };
}

export function getAgenticPrivyCredentials(): PrivyCredentials {
  const { appId, appSecret } = getAgenticCredentialResolution();

  if (!appId.value || !appSecret.value || !appId.source || !appSecret.source) {
    throw new Error(
      'Missing agentic Privy credentials. Set AGENTIC_PRIVY_APP_ID/AGENTIC_PRIVY_APP_SECRET (or PRIVY_APP_ID/PRIVY_APP_SECRET).'
    );
  }

  return {
    appId: appId.value,
    appSecret: appSecret.value,
    appIdSource: appId.source,
    appSecretSource: appSecret.source,
  };
}

export function getPrivyConfigDiagnostics(): PrivyConfigDiagnostics {
  const auth = getAuthCredentialResolution();
  const agentic = getAgenticCredentialResolution();
  const warnings: string[] = [];

  if (
    auth.appSecret.source === 'PRIVY_APP_SECRET' &&
    !process.env.PRIVY_AUTH_APP_SECRET
  ) {
    warnings.push(
      'Auth secret is using PRIVY_APP_SECRET fallback. Set PRIVY_AUTH_APP_SECRET for explicit auth/app separation.'
    );
  }

  if (
    agentic.appId.source === 'PRIVY_APP_ID' &&
    !process.env.AGENTIC_PRIVY_APP_ID
  ) {
    warnings.push(
      'Agentic app ID is using PRIVY_APP_ID fallback. Set AGENTIC_PRIVY_APP_ID explicitly.'
    );
  }

  if (
    agentic.appSecret.source === 'PRIVY_APP_SECRET' &&
    !process.env.AGENTIC_PRIVY_APP_SECRET
  ) {
    warnings.push(
      'Agentic secret is using PRIVY_APP_SECRET fallback. Set AGENTIC_PRIVY_APP_SECRET explicitly.'
    );
  }

  if (auth.appId.value && agentic.appId.value && auth.appId.value === agentic.appId.value) {
    warnings.push(
      'Auth and agentic flows are sharing the same Privy app ID. Use separate apps if you want strict environment isolation.'
    );
  }

  return {
    auth: {
      configured: Boolean(auth.appId.value && auth.appSecret.value),
      appIdSource: auth.appId.source,
      appSecretSource: auth.appSecret.source,
    },
    agentic: {
      configured: Boolean(agentic.appId.value && agentic.appSecret.value),
      appIdSource: agentic.appId.source,
      appSecretSource: agentic.appSecret.source,
    },
    warnings,
  };
}
