export type PageRobots = 'index,follow' | 'noindex,nofollow';

export type PageServeState = 'published' | 'unpublished';

export type AccountPageServeState = {
  v: 1;
  accountId: string;
  pageId: string;
  status: PageServeState;
  publishedAt?: string;
  updatedAt: string;
};

export type AccountPageSummary = {
  pageId: string;
  title: string;
  description: string;
  robots: PageRobots;
  placementCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AccountPagesIndex = {
  v: 1;
  accountId: string;
  pages: AccountPageSummary[];
};

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
