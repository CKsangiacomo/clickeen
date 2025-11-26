import { useEffect, useRef, useState } from 'react';
import type { PanelId } from '../lib/types';
import { getAt } from '../lib/utils/paths';

declare global {
  interface Window {
    Dieter?: {
      hydrateAll?: (scope?: HTMLElement) => void;
    };
  }
}

const loadedStyles = new Set<string>();
const loadedScripts = new Map<string, Promise<void>>();

function ensureStyles(urls: string[] | undefined) {
  if (!urls) return;
  const head = document.head;
  urls.forEach((href) => {
    if (!href || loadedStyles.has(href)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    head.appendChild(link);
    loadedStyles.add(href);
  });
}

function ensureScripts(urls: string[] | undefined): Promise<void[]> {
  if (!urls || urls.length === 0) return Promise.resolve([]);
  const promises = urls.map((src) => {
    if (!src) return Promise.resolve();
    const existing = loadedScripts.get(src);
    if (existing) return existing;
    const p = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false; // preserve order
      script.onload = () => resolve();
      script.onerror = () => {
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.error('[TdMenuContent] Failed to load script', src);
        }
        reject(new Error(`Failed to load script ${src}`));
      };
      document.head.appendChild(script);
    });
    loadedScripts.set(src, p);
    return p;
  });
  return Promise.all(promises);
}

function runHydrators(scope: HTMLElement) {
  if (typeof window === 'undefined' || !window.Dieter) return;
  const entries = Object.entries(window.Dieter).filter(
    ([name, fn]) => typeof fn === 'function' && name.toLowerCase().startsWith('hydrate'),
  );
  for (const [, fn] of entries) {
    try {
      (fn as (el?: HTMLElement) => void)(scope);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn('[TdMenuContent] Hydrator error', err);
      }
    }
  }
}

type TdMenuContentProps = {
  panelId: PanelId | null;
  panelHtml: string;
  widgetKey?: string;
  instanceData: Record<string, unknown>;
  setValue: (path: string, value: unknown) => void;
  defaults?: Record<string, unknown>;
  dieterAssets?: {
    styles: string[];
    scripts: string[];
  };
};

function evaluateShowIf(expr: string | undefined, data: Record<string, unknown>): boolean {
  if (!expr) return true;

  const trimmed = expr.trim();
  // Minimal expression support: "path == 'literal'" or "path != 'literal'"
  const eqMatch = trimmed.match(/^(.+?)(==|!=)\s*'([^']*)'$/);
  if (!eqMatch) {
    // If we can't parse the expression, fail open in dev but do not hide the control.
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn('[TdMenuContent] Unable to parse showIf expression', expr);
    }
    return true;
  }

  const [, rawPath, operator, literal] = eqMatch;
  const path = rawPath.trim();
  const value = getAt<unknown>(data, path);
  const valueStr = value == null ? '' : String(value);

  if (operator === '==') {
    return valueStr === literal;
  }
  if (operator === '!=') {
    return valueStr !== literal;
  }

  return true;
}

export function TdMenuContent({ panelId, panelHtml, widgetKey, instanceData, setValue, defaults, dieterAssets }: TdMenuContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderKey, setRenderKey] = useState(0);

  // Reset caches when switching widgets
  useEffect(() => {
    loadedStyles.clear();
    loadedScripts.clear();
  }, [widgetKey]);

  // Inject panel HTML when it changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = panelHtml || '';

    ensureStyles(dieterAssets?.styles);
    ensureScripts(dieterAssets?.scripts)
      .then(() => {
        if (container) {
          runHydrators(container);
          setRenderKey((n) => n + 1);
        }
      })
      .catch(() => {
        // errors already logged in dev
      });
  }, [panelHtml, dieterAssets?.styles, dieterAssets?.scripts]);

  // Bind controls: set values from instanceData, attach listeners, honor showIf
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const fields = Array.from(container.querySelectorAll<HTMLElement>('[data-bob-path]'));

    const cleanupFns: Array<() => void> = [];

    fields.forEach((field) => {
      const path = field.getAttribute('data-bob-path');
      if (!path) return;

      const showIfExpr = field.getAttribute('data-bob-showif') || undefined;
      const isVisible = evaluateShowIf(showIfExpr, instanceData);
      const hideTarget = field.closest('.diet-textfield, .diet-toggle, [data-bob-control]') || field;
      hideTarget.toggleAttribute('hidden', !isVisible);
      hideTarget.setAttribute('style', isVisible ? '' : 'display: none;');

      const rawValue = getAt(instanceData, path);
      const defaultValue = defaults ? getAt(defaults, path) : undefined;
      const value = rawValue === undefined ? defaultValue : rawValue;

      if (field instanceof HTMLInputElement && field.type === 'checkbox') {
        field.checked = Boolean(value);
      } else if ('value' in field) {
        if (field instanceof HTMLInputElement && field.dataset.bobJson != null) {
          try {
            (field as HTMLInputElement).value = JSON.stringify(value ?? defaultValue ?? []);
          } catch {
            (field as HTMLInputElement).value = '';
          }
        } else {
          (field as HTMLInputElement).value = value == null ? '' : String(value);
        }
      }

      const handler = (event: Event) => {
        const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
        if (!target) return;

        if (target instanceof HTMLInputElement && target.type === 'checkbox') {
          setValue(path, target.checked);
          return;
        }

        if ('value' in target) {
          const rawValue = (target as HTMLInputElement).value;
          if (target instanceof HTMLInputElement && target.dataset.bobJson != null) {
            try {
              const parsed = rawValue ? JSON.parse(rawValue) : [];
              setValue(path, parsed);
            } catch {
              setValue(path, rawValue);
            }
          } else {
            setValue(path, rawValue);
          }
        }
      };

      if (field instanceof HTMLInputElement && field.type === 'checkbox') {
        field.addEventListener('change', handler);
        cleanupFns.push(() => field.removeEventListener('change', handler));
      } else {
        field.addEventListener('input', handler);
        field.addEventListener('change', handler);
        cleanupFns.push(() => {
          field.removeEventListener('input', handler);
          field.removeEventListener('change', handler);
        });
      }
    });


    return () => {
      cleanupFns.forEach((fn) => fn());
    };
  }, [instanceData, setValue, panelHtml, renderKey, defaults]);

  if (!panelId) {
    return (
      <div className="tdmenucontent">
        <div className="heading-3">No controls</div>
      </div>
    );
  }

  return (
    <div className="tdmenucontent">
      <div className="heading-3">{panelId}</div>
      <div className="tdmenucontent__fields" ref={containerRef} />
    </div>
  );
}
