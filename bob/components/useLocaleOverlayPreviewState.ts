'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWidgetSessionTransport } from '../lib/session/useWidgetSession';
import {
  normalizeLocaleOverlayInventory,
  normalizeLocaleOverlayObject,
  type LocaleOverlayInventoryData,
} from '../lib/translations-preview';

export type { LocaleOverlayInventoryData, TranslationSetup } from '../lib/translations-preview';

type ErrorPayload = {
  error?: {
    reasonKey?: unknown;
    detail?: unknown;
  };
};

function resolveRouteErrorReason(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const errorPayload = payload as ErrorPayload;
  const reasonKey =
    typeof errorPayload.error?.reasonKey === 'string' ? errorPayload.error.reasonKey.trim() : '';
  if (reasonKey) return reasonKey;
  const detail =
    typeof errorPayload.error?.detail === 'string' ? errorPayload.error.detail.trim() : '';
  return detail || null;
}

function resolveStorageReadError(args: {
  status?: number;
  reasonKey?: string | null;
}): string {
  if (args.status === 404) return 'No saved translation overlays yet.';
  if (args.reasonKey === 'coreui.errors.payload.invalid') return 'Saved translation overlays could not be read.';
  return 'Saved translation overlays could not be read.';
}

export function useLocaleOverlayPreviewState(args: {
  instanceId: string;
  baseLocale: string;
  enabled: boolean;
  selectedLocale: string;
  refreshVersion: number;
}) {
  const { listLocaleOverlays, readLocaleOverlay } = useWidgetSessionTransport();
  const [inventory, setInventory] = useState<LocaleOverlayInventoryData | null>(null);
  const [valuesByLocale, setValuesByLocale] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInventory(null);
    setValuesByLocale({});
    setLoading(false);
    setError(null);
  }, [args.instanceId]);

  useEffect(() => {
    if (!args.instanceId || !args.baseLocale) {
      setInventory(null);
      setValuesByLocale({});
      setLoading(false);
      setError(null);
      return;
    }
    if (!args.enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    listLocaleOverlays({
      instanceId: args.instanceId,
      baseLocale: args.baseLocale,
    })
      .then((response) => {
        if (cancelled) return;
        if (!response.ok) {
          throw {
            status: response.status,
            reasonKey: resolveRouteErrorReason(response.json),
          };
        }
        const payload = normalizeLocaleOverlayInventory(response.json);
        if (!payload) throw new Error('coreui.errors.payload.invalid');
        if (payload.baseLocale !== args.baseLocale) throw new Error('coreui.errors.payload.invalid');
        setInventory(payload);
      })
      .catch((caught) => {
        if (cancelled) return;
        setInventory({ v: 1, baseLocale: args.baseLocale, overlays: [] });
        const status =
          typeof (caught as { status?: unknown } | null | undefined)?.status === 'number'
            ? (caught as { status: number }).status
            : undefined;
        const reasonKey =
          caught instanceof Error
            ? caught.message
            : typeof (caught as { reasonKey?: unknown } | null | undefined)?.reasonKey === 'string'
              ? ((caught as { reasonKey: string }).reasonKey || null)
              : null;
        setError(resolveStorageReadError({ status, reasonKey }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    args.baseLocale,
    args.enabled,
    args.instanceId,
    args.refreshVersion,
    listLocaleOverlays,
  ]);

  const selectedOverlay = useMemo(() => {
    if (!inventory) return null;
    if (!args.selectedLocale || args.selectedLocale === inventory.baseLocale) return null;
    return inventory.overlays.find((entry) => entry.locale === args.selectedLocale) ?? null;
  }, [args.selectedLocale, inventory]);

  useEffect(() => {
    if (!args.enabled || !args.instanceId || !selectedOverlay) return;
    if (valuesByLocale[selectedOverlay.locale]) return;

    let cancelled = false;
    readLocaleOverlay({
      instanceId: args.instanceId,
      overlayId: selectedOverlay.overlayId,
    })
      .then((response) => {
        if (cancelled) return;
        if (!response.ok) {
          throw {
            status: response.status,
            reasonKey: resolveRouteErrorReason(response.json),
          };
        }
        const payload = normalizeLocaleOverlayObject(response.json);
        if (!payload || payload.overlayId !== selectedOverlay.overlayId) {
          throw new Error('coreui.errors.payload.invalid');
        }
        setValuesByLocale((current) => ({
          ...current,
          [selectedOverlay.locale]: payload.values,
        }));
      })
      .catch((caught) => {
        if (cancelled) return;
        const status =
          typeof (caught as { status?: unknown } | null | undefined)?.status === 'number'
            ? (caught as { status: number }).status
            : undefined;
        const reasonKey =
          caught instanceof Error
            ? caught.message
            : typeof (caught as { reasonKey?: unknown } | null | undefined)?.reasonKey === 'string'
              ? ((caught as { reasonKey: string }).reasonKey || null)
              : null;
        setError(resolveStorageReadError({ status, reasonKey }));
      });

    return () => {
      cancelled = true;
    };
  }, [
    args.enabled,
    args.instanceId,
    readLocaleOverlay,
    selectedOverlay,
    valuesByLocale,
  ]);

  return {
    inventory,
    valuesByLocale,
    loading,
    error,
  };
}
