/**
 * Secrets seam. The app never reads credentials from settings, the DB or request bodies.
 * Local/CI: environment variables from .env (dev-only values). Production: swap `provider` for
 * AWS Secrets Manager / Vault; callers don't change. `*_PREVIOUS` supports zero-downtime rotation.
 */
type Provider = { get(name: string): string | undefined };

const envProvider: Provider = { get: (name) => process.env[name] };
const provider: Provider = envProvider;

const DEV_DEFAULTS: Record<string, string> = {
  SESSION_SECRET: "dev-only-session-secret-change-me",
  KYC_WEBHOOK_SECRET: "dev-only-kyc-webhook-secret",
  PII_KEY: "dev-only-pii-key-change-me",
};

export function getSecret(name: string): string {
  const v = provider.get(name) ?? (process.env.NODE_ENV !== "production" ? DEV_DEFAULTS[name] : undefined);
  if (!v) throw new Error(`Secret ${name} is not configured`);
  return v;
}

/** Current key first, then the previous one while a rotation is in flight. */
export function getSecretVersions(name: string): string[] {
  const prev = provider.get(`${name}_PREVIOUS`);
  return prev ? [getSecret(name), prev] : [getSecret(name)];
}
