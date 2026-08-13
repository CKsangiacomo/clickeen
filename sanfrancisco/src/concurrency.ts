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

/**
 * Streaming-aware inflight limit.
 *
 * The standard withInflightLimit releases when fn() returns. For a streaming
 * Response, fn() returns immediately with a Response whose body hasn't been
 * consumed yet. This variant holds the lease until the stream body completes,
 * errors, or is cancelled by the downstream consumer, then releases exactly
 * once.
 *
 * PRD 128B correction: TransformStream.flush() does NOT run on downstream
 * cancellation — a runtime probe confirmed only the source's cancel hook
 * fires. This implementation uses an explicit ReadableStream wrapper with
 * a cancel() handler so the lease releases on ALL exit paths:
 * - normal completion (reader sees done)
 * - stream error (pump catch)
 * - downstream cancellation (wrapper cancel)
 * The release() function is idempotent — no double decrement.
 */
export function withStreamInflightLimit<T extends Response>(
  fn: () => Promise<T>,
): Promise<T> {
  if (inflight >= MAX_INFLIGHT_PER_ISOLATE) {
    return Promise.reject(
      new HttpError(429, { code: 'BUDGET_EXCEEDED', message: 'Service concurrency limit reached' }),
    );
  }

  inflight++;
  let released = false;
  const release = (): void => {
    if (!released) {
      released = true;
      inflight--;
    }
  };

  return fn().then(
    (response: T) => {
      if (!response.body) {
        release();
        return response;
      }

      const sourceBody = response.body;
      let sourceReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
      const wrapped = new ReadableStream<Uint8Array>({
        start(controller) {
          sourceReader = sourceBody.getReader();
          const pump = (): Promise<void> =>
            sourceReader!.read().then(
              ({ done, value }) => {
                if (done) {
                  release();
                  controller.close();
                  return;
                }
                controller.enqueue(value);
                return pump();
              },
              (err: unknown) => {
                release();
                controller.error(err);
              },
            );
          return pump();
        },
        cancel(reason) {
          release();
          // Cancel through the reader — the source stream is locked by getReader().
          // Calling sourceBody.cancel() on a locked stream throws in Node.js.
          return sourceReader ? sourceReader.cancel(reason) : sourceBody.cancel(reason);
        },
      });

      return new Response(wrapped, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      }) as T;
    },
    (err: unknown) => {
      release();
      throw err;
    },
  );
}
