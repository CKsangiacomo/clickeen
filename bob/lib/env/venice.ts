export function resolveVeniceBaseUrl(): string {
  const raw =
    typeof process !== 'undefined'
      ? (process.env.NEXT_PUBLIC_VENICE_URL ?? process.env.VENICE_URL ?? undefined)
      : undefined;
  const fromEnv = raw?.trim();
  if (fromEnv) return fromEnv;

  // Local default (Venice is started by scripts/dev-up.sh).
  return 'http://localhost:3003';
}

