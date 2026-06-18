export type PageServeState = 'published' | 'unpublished';

export type PageOperationErrorKind =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'UPSTREAM_UNAVAILABLE';

export class PageOperationError extends Error {
  kind: PageOperationErrorKind;
  reasonKey: string;
  status: number;
  paths: string[];

  constructor(args: {
    kind: PageOperationErrorKind;
    reasonKey: string;
    status?: number;
    detail?: string;
    paths?: string[];
  }) {
    super(args.detail ?? args.reasonKey);
    this.name = 'PageOperationError';
    this.kind = args.kind;
    this.reasonKey = args.reasonKey;
    this.status = args.status ?? (args.kind === 'NOT_FOUND' ? 404 : args.kind === 'VALIDATION' ? 422 : 502);
    this.paths = args.paths ?? [];
  }
}
