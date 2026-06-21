export class TranslationAgentError extends Error {
  readonly status: number;
  readonly code: 'BAD_REQUEST' | 'PROVIDER_ERROR';
  readonly provider?: string;

  constructor(status: number, args: { code: 'BAD_REQUEST' | 'PROVIDER_ERROR'; message: string; provider?: string }) {
    super(args.message);
    this.name = 'TranslationAgentError';
    this.status = status;
    this.code = args.code;
    this.provider = args.provider;
  }
}
