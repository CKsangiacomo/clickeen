import { BLOCK_SCHEMAS } from './blockSchemas';
import { resolveLayout, type LayoutMap, type OutputFormat } from './core/resolver';

type ResolveBlockLayoutArgs = {
  blockType: string;
  format: OutputFormat;
  layout?: string;
  layouts?: LayoutMap<string>;
};

export function resolveBlockLayoutAtBuild(args: ResolveBlockLayoutArgs): string {
  if (args.layouts) {
    return resolveLayout(args.layouts, args.format);
  }
  const schemaLayout = BLOCK_SCHEMAS[args.blockType]?.layout;
  return args.layout ?? schemaLayout ?? 'web';
}
