import { HttpError } from './http';

const MAX_INFLIGHT_PER_ISOLATE = 8;
let inflight = 0;

export async function withInflightLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (inflight >= MAX_INFLIGHT_PER_ISOLATE) {
    throw new HttpError(429, { code: 'BUDGET_EXCEEDED', message: 'Service concurrency limit reached' });
  }

  inflight++;
  try {
    return await fn();
  } finally {
    inflight--;
  }
}
