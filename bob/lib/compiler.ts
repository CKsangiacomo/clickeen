import { CompiledWidget } from './types';
import { RawWidget } from './compiler.shared';

export function compileWidget(widgetJson: RawWidget): CompiledWidget {
  if (process.env.NEXT_RUNTIME === 'edge') {
    throw new Error('[BobCompiler] compileWidget is not available on the edge runtime');
  }
  // Lazy require to keep fs/path out of client/edge bundles
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { compileWidgetServer } = require('./compiler.server') as { compileWidgetServer: (w: RawWidget) => CompiledWidget };
  return compileWidgetServer(widgetJson);
}
