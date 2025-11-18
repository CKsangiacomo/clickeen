export async function withTimeout<T>(factory: (signal: AbortSignal) => Promise<T>, timeoutMs = 1000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await factory(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}
