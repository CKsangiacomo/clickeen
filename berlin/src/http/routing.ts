import { type Env } from '../types';

export type RouteHandlerContext = {
  request: Request;
  env: Env;
  match: RegExpMatchArray;
};

export type RouteHandler = (context: RouteHandlerContext) => Response | Promise<Response>;

export type BerlinRoute = {
  pattern: RegExp;
  methods: Partial<Record<string, RouteHandler>>;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function exact(pathname: string, methods: BerlinRoute['methods']): BerlinRoute {
  return {
    pattern: new RegExp(`^${escapeRegex(pathname)}$`),
    methods,
  };
}

export function capture(match: RegExpMatchArray, index: number): string {
  return decodeURIComponent(match[index] || '');
}

