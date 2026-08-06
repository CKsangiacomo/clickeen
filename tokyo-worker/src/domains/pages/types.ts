export type PageOperationErrorKind =
  | 'VALIDATION'
  | 'DENY'
  | 'NOT_FOUND'
  | 'UPSTREAM_UNAVAILABLE';

export type PageGeneratedFiles = {
  indexHtml: string;
  stylesCss: string;
  runtimeJs: string;
};

export type PageServingOverlays = Record<
  string,
  {
    page: Record<string, string>;
    placements: Record<string, Record<string, string>>;
  }
>;

export type PageServeState = {
  published: boolean;
  needsUpdate: boolean;
};

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
    this.status = args.status ?? (args.kind === 'NOT_FOUND' ? 404 : args.kind === 'DENY' ? 409 : args.kind === 'VALIDATION' ? 422 : 502);
    this.paths = args.paths ?? [];
  }
}
