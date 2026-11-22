export interface Environment {
  apiPort: number;
  databaseUrl: string;
  isProduction: boolean;
  jobTimeoutMs: number;
  pdfEncryptionKey: Buffer;
  redisUrl: string;
  sessionAbsoluteTimeoutMs: number;
  sessionIdleTimeoutMs: number;
  sessionSecret: string;
  storageAccessKey?: string;
  storageBucket: string;
  storageEndpoint?: string;
  storageForcePathStyle: boolean;
  storageRegion: string;
  storageSecretKey?: string;
  webOrigin: string;
  workerConcurrency: number;
}

function getRequiredValue(name: string): string {
  const value = process.env[name]?.trim();

  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getPositiveInteger(name: string, fallback: number): number {
  const rawValue = process.env[name];

  if (rawValue === undefined) {
    return fallback;
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

function getOptionalValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
}

function getBoolean(name: string, fallback: boolean): boolean {
  const rawValue = process.env[name]?.trim().toLowerCase();
  if (rawValue === undefined) return fallback;
  if (rawValue === 'true') return true;
  if (rawValue === 'false') return false;
  throw new Error(`${name} must be true or false.`);
}

export function loadEnvironment(): Environment {
  const sessionSecret = getRequiredValue('SESSION_SECRET');
  if (Buffer.byteLength(sessionSecret, 'utf8') < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 bytes.');
  }

  const storageAccessKey = getOptionalValue('STORAGE_ACCESS_KEY');
  const storageEndpoint = getOptionalValue('STORAGE_ENDPOINT');
  const storageSecretKey = getOptionalValue('STORAGE_SECRET_KEY');
  const pdfEncryptionKey = Buffer.from(getRequiredValue('PDF_ENCRYPTION_KEY'), 'base64');
  if (pdfEncryptionKey.length !== 32) {
    throw new Error('PDF_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  }

  return {
    apiPort: getPositiveInteger('API_PORT', 3000),
    databaseUrl: getRequiredValue('DATABASE_URL'),
    isProduction: process.env.NODE_ENV === 'production',
    jobTimeoutMs: getPositiveInteger('JOB_TIMEOUT_MS', 60_000),
    pdfEncryptionKey,
    redisUrl: getRequiredValue('REDIS_URL'),
    sessionAbsoluteTimeoutMs: getPositiveInteger('SESSION_ABSOLUTE_TIMEOUT_MS', 28_800_000),
    sessionIdleTimeoutMs: getPositiveInteger('SESSION_IDLE_TIMEOUT_MS', 1_800_000),
    sessionSecret,
    ...(storageAccessKey === undefined ? {} : { storageAccessKey }),
    storageBucket: getRequiredValue('STORAGE_BUCKET'),
    ...(storageEndpoint === undefined ? {} : { storageEndpoint }),
    storageForcePathStyle: getBoolean('STORAGE_FORCE_PATH_STYLE', false),
    storageRegion: getRequiredValue('STORAGE_REGION'),
    ...(storageSecretKey === undefined ? {} : { storageSecretKey }),
    webOrigin: getRequiredValue('WEB_ORIGIN'),
    workerConcurrency: getPositiveInteger('WORKER_CONCURRENCY', 1),
  };
}
