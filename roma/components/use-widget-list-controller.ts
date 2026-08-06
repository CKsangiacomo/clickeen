'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveAccountShellErrorCopy, resolveAccountShellReason } from '../lib/account-shell-copy';
import { buildWidgetPublicActions, type PublicActions } from '../lib/public-actions';
import { useRomaAccountApi } from './account-api';
import { prefetchWidgetEditorArtifact } from './widget-editor-artifact';
import { useRomaAccountContext } from './roma-account-context';
import {
  DEFAULT_INSTANCE_DISPLAY_NAME,
  isRomaWidgetsCacheFresh,
  loadRomaWidgetsForAccount,
  readRomaWidgetsCache,
  updateRomaWidgetsCache,
  type WidgetInstance,
} from './use-roma-widgets';
import { loadRomaWidgetTemplates } from './use-roma-widget-templates';

export type WidgetStatusFilter = 'all' | 'published' | 'unpublished';
export type WidgetSortKey = 'widget' | 'name' | 'status';
export type WidgetSortDirection = 'ascending' | 'descending';
export type WidgetSort = { key: WidgetSortKey; direction: WidgetSortDirection };

export type WidgetUpgradePrompt = {
  message: string;
  current: number;
  limit: number;
};

export type WidgetCopyCodeContext = {
  accountPublicId: string;
  instanceId: string;
  instanceName: string;
  actions: PublicActions | null;
};

export type CreatedWidgetTemplate = {
  templateId: string;
  templateName: string;
};

const DEFAULT_WIDGET_SORT: WidgetSort = { key: 'name', direction: 'ascending' };

function normalizeUpgradePrompt(payload: unknown): WidgetUpgradePrompt | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  if (record.kind !== 'UPGRADE_REQUIRED') return null;
  const upgrade = record.upgrade;
  if (!upgrade || typeof upgrade !== 'object' || Array.isArray(upgrade)) return null;
  const upgradeRecord = upgrade as Record<string, unknown>;
  const action = typeof upgradeRecord.action === 'string' ? upgradeRecord.action : '';
  const current = typeof upgradeRecord.current === 'number' && Number.isFinite(upgradeRecord.current)
    ? Math.max(0, Math.floor(upgradeRecord.current))
    : null;
  const limit = typeof upgradeRecord.limit === 'number' && Number.isFinite(upgradeRecord.limit)
    ? Math.max(0, Math.floor(upgradeRecord.limit))
    : null;
  if (current == null || limit == null) return null;
  if (action === 'create_instance' || action === 'duplicate_instance') {
    return { message: 'Upgrade to create more widget instances.', current, limit };
  }
  if (action === 'publish_instance') {
    return { message: 'Upgrade to publish more widget instances.', current, limit };
  }
  return null;
}

async function readJsonOrNull(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function useWidgetListController(statusFilter: WidgetStatusFilter) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { accountContext, accountPolicy } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();
  const productAccountId = accountContext.accountPublicId;
  const canMutateWidgets = accountPolicy.role !== 'viewer';
  const cachedWidgets = readRomaWidgetsCache(productAccountId);

  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState<WidgetUpgradePrompt | null>(null);
  const [upsellReason, setUpsellReason] = useState<string | null>(null);
  const [widgetInstances, setWidgetInstances] = useState<WidgetInstance[]>(() => cachedWidgets?.data.instances ?? []);
  const [templateCount, setTemplateCount] = useState<number | null>(null);
  const [domainLoading, setDomainLoading] = useState(() => !cachedWidgets);
  const [domainRefreshing, setDomainRefreshing] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [renamingInstanceId, setRenamingInstanceId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [saveAsTemplateInstance, setSaveAsTemplateInstance] = useState<WidgetInstance | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [saveAsTemplateError, setSaveAsTemplateError] = useState<string | null>(null);
  const [createdTemplate, setCreatedTemplate] = useState<CreatedWidgetTemplate | null>(null);
  const [sort, setSort] = useState<WidgetSort>(DEFAULT_WIDGET_SORT);
  const [copyCodeContext, setCopyCodeContext] = useState<WidgetCopyCodeContext | null>(null);

  const selectedInstanceId = useMemo(() => (searchParams.get('selected') || '').trim(), [searchParams]);
  const applyWidgets = useCallback((widgets: { instances: WidgetInstance[] }) => {
    setWidgetInstances(widgets.instances);
  }, []);

  const refreshWidgets = useCallback(async (args?: { force?: boolean }) => {
    const force = args?.force === true;
    const cached = readRomaWidgetsCache(productAccountId);
    if (!force && cached) {
      applyWidgets(cached.data);
      setDomainLoading(false);
      setDataError(null);
      if (isRomaWidgetsCacheFresh(cached)) return;
      setDomainRefreshing(true);
    } else {
      setDomainLoading(true);
    }
    setDataError(null);
    try {
      const normalized = await loadRomaWidgetsForAccount({
        accountId: productAccountId,
        fetchJson: accountApi.fetchJson,
        force,
      });
      applyWidgets(normalized);
      setDataError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!cached) setWidgetInstances([]);
      setDataError(resolveAccountShellErrorCopy(message, 'Failed to load widgets. Please try again.'));
    } finally {
      setDomainLoading(false);
      setDomainRefreshing(false);
    }
  }, [accountApi.fetchJson, applyWidgets, productAccountId]);

  useEffect(() => {
    const cached = readRomaWidgetsCache(productAccountId);
    if (cached) {
      applyWidgets(cached.data);
      setDomainLoading(false);
    } else {
      setWidgetInstances([]);
      setDomainLoading(true);
    }
    void refreshWidgets();
  }, [applyWidgets, productAccountId, refreshWidgets]);

  useEffect(() => {
    setTemplateCount(null);
    void loadRomaWidgetTemplates({ accountId: productAccountId, fetchJson: accountApi.fetchJson })
      .then((response) => setTemplateCount(response.templates.length))
      .catch(() => setTemplateCount(null));
  }, [accountApi.fetchJson, productAccountId]);

  const instanceWidgetTypes = useMemo(
    () => Array.from(new Set(widgetInstances.map((instance) => instance.widgetType))).sort((a, b) => a.localeCompare(b)),
    [widgetInstances],
  );
  useEffect(() => {
    instanceWidgetTypes.slice(0, 8).forEach((widgetType) => {
      void prefetchWidgetEditorArtifact(widgetType);
    });
  }, [instanceWidgetTypes]);

  const canRenderWidgetData = !dataError || widgetInstances.length > 0;
  const savedObjectLimit = accountPolicy.limits['widgets.instances.max'];
  const canSaveAsTemplate = canMutateWidgets &&
    productAccountId !== 'CLICKEEN' &&
    templateCount !== null &&
    typeof savedObjectLimit === 'number' &&
    Number.isFinite(savedObjectLimit) &&
    widgetInstances.length + templateCount < Math.max(0, Math.floor(savedObjectLimit));

  const displayedInstances = useMemo(() => {
    if (!canRenderWidgetData) return [];
    return widgetInstances
      .filter((instance) => statusFilter === 'all' || instance.status === statusFilter)
      .slice()
      .sort((left, right) => {
        const leftName = left.displayName || DEFAULT_INSTANCE_DISPLAY_NAME;
        const rightName = right.displayName || DEFAULT_INSTANCE_DISPLAY_NAME;
        const primary = sort.key === 'widget'
          ? left.widget.localeCompare(right.widget)
          : sort.key === 'name'
            ? leftName.localeCompare(rightName)
            : left.status.localeCompare(right.status);
        if (primary !== 0) return sort.direction === 'ascending' ? primary : -primary;
        const nameOrder = leftName.localeCompare(rightName);
        return nameOrder !== 0 ? nameOrder : left.instanceId.localeCompare(right.instanceId);
      });
  }, [canRenderWidgetData, sort, statusFilter, widgetInstances]);

  const changeSort = useCallback((key: WidgetSortKey) => {
    setSort((current) => current.key === key
      ? { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' }
      : { key, direction: 'ascending' });
  }, []);

  useEffect(() => {
    if (!copyCodeContext) return;
    const instance = widgetInstances.find((candidate) => candidate.instanceId === copyCodeContext.instanceId);
    if (copyCodeContext.accountPublicId !== productAccountId || instance?.status !== 'published') {
      setCopyCodeContext(null);
    }
  }, [copyCodeContext, productAccountId, widgetInstances]);

  const openCopyCode = useCallback((instance: WidgetInstance) => {
    if (instance.status !== 'published') return;
    const instanceName = instance.displayName || DEFAULT_INSTANCE_DISPLAY_NAME;
    try {
      setCopyCodeContext({
        accountPublicId: productAccountId,
        instanceId: instance.instanceId,
        instanceName,
        actions: buildWidgetPublicActions({ accountPublicId: productAccountId, instanceId: instance.instanceId }),
      });
    } catch {
      setCopyCodeContext({ accountPublicId: productAccountId, instanceId: instance.instanceId, instanceName, actions: null });
    }
  }, [productAccountId]);

  const handleDuplicateInstance = useCallback((instance: WidgetInstance) => {
    if (!productAccountId || !canMutateWidgets) return;
    setMutationError(null);
    setUpgradePrompt(null);
    router.push(`/builder?duplicate=${encodeURIComponent(instance.instanceId)}`);
  }, [canMutateWidgets, productAccountId, router]);

  const openSaveAsTemplate = useCallback((instance: WidgetInstance) => {
    if (!canSaveAsTemplate) return;
    setSaveAsTemplateError(null);
    setCreatedTemplate(null);
    setTemplateName('');
    setSaveAsTemplateInstance(instance);
  }, [canSaveAsTemplate]);

  const closeSaveAsTemplate = useCallback(() => {
    if (activeActionKey?.startsWith('save-template:')) return;
    setSaveAsTemplateInstance(null);
    setTemplateName('');
    setSaveAsTemplateError(null);
    setCreatedTemplate(null);
  }, [activeActionKey]);

  const dismissSaveAsTemplate = useCallback(() => {
    setSaveAsTemplateInstance(null);
  }, []);

  const handleSaveAsTemplate = useCallback(async () => {
    const instance = saveAsTemplateInstance;
    const nextName = templateName.trim();
    const sourceName = (instance?.displayName || DEFAULT_INSTANCE_DISPLAY_NAME).trim();
    if (!instance || !canSaveAsTemplate || !nextName || nextName === sourceName) return;
    const actionKey = `save-template:${instance.instanceId}`;
    setActiveActionKey(actionKey);
    setSaveAsTemplateError(null);
    try {
      const payload = await accountApi.fetchJson(`/api/account/instances/${encodeURIComponent(instance.instanceId)}/save-as-template`, {
        method: 'POST',
        headers: accountApi.buildHeaders({ contentType: 'application/json' }),
        body: JSON.stringify({ templateName: nextName }),
      });
      const record = payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload as { templateId?: unknown; templateName?: unknown }
        : null;
      const templateId = typeof record?.templateId === 'string' ? record.templateId.trim() : '';
      const savedName = typeof record?.templateName === 'string' ? record.templateName.trim() : '';
      if (!templateId || !savedName) throw new Error('coreui.errors.payload.invalid');
      setCreatedTemplate({ templateId, templateName: savedName });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveAsTemplateError(resolveAccountShellErrorCopy(message, 'The template could not be saved. Please try again.'));
      setActiveActionKey((current) => current === actionKey ? null : current);
      return;
    }
    setTemplateCount(null);
    try {
      const templates = await loadRomaWidgetTemplates({ accountId: productAccountId, fetchJson: accountApi.fetchJson });
      setTemplateCount(templates.templates.length);
    } catch {
      setMutationError('The template was saved, but template capacity could not be refreshed. Reload this page to try again.');
    } finally {
      setActiveActionKey((current) => current === actionKey ? null : current);
    }
  }, [accountApi, canSaveAsTemplate, productAccountId, saveAsTemplateInstance, templateName]);

  const handleDeleteInstance = useCallback(async (instance: WidgetInstance) => {
    if (!productAccountId || !canMutateWidgets) return;
    const actionKey = `delete:${instance.instanceId}`;
    setActiveActionKey(actionKey);
    setMutationError(null);
    try {
      await accountApi.fetchJson<{ deleted?: boolean }>(`/api/account/instances/${encodeURIComponent(instance.instanceId)}`, { method: 'DELETE' });
      await refreshWidgets({ force: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMutationError(resolveAccountShellErrorCopy(message, 'Deleting the widget failed. Please try again.'));
    } finally {
      setActiveActionKey((current) => current === actionKey ? null : current);
    }
  }, [accountApi, canMutateWidgets, productAccountId, refreshWidgets]);

  const handleStatusChange = useCallback(async (instance: WidgetInstance, nextStatus: 'published' | 'unpublished') => {
    if (!productAccountId || !canMutateWidgets) return;
    const actionKey = `${nextStatus}:${instance.instanceId}`;
    setActiveActionKey(actionKey);
    setMutationError(null);
    setUpgradePrompt(null);
    try {
      const response = await accountApi.fetchRaw(
        `/api/account/instances/${encodeURIComponent(instance.instanceId)}/${nextStatus === 'published' ? 'publish' : 'unpublish'}`,
        { method: 'POST' },
      );
      const payload = await readJsonOrNull(response);
      if (response.status === 402) {
        const prompt = normalizeUpgradePrompt(payload);
        if (prompt) {
          setUpgradePrompt(prompt);
          return;
        }
      }
      if (!response.ok) throw new Error(resolveAccountShellReason(payload, 'Updating widget status failed. Please try again.'));
      await refreshWidgets({ force: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMutationError(resolveAccountShellErrorCopy(message, 'Updating widget status failed. Please try again.'));
    } finally {
      setActiveActionKey((current) => current === actionKey ? null : current);
    }
  }, [accountApi, canMutateWidgets, productAccountId, refreshWidgets]);

  const startRename = useCallback((instance: WidgetInstance) => {
    if (!canMutateWidgets) return;
    setMutationError(null);
    setRenameError(null);
    setRenamingInstanceId(instance.instanceId);
    setRenameDraft(instance.displayName || DEFAULT_INSTANCE_DISPLAY_NAME);
  }, [canMutateWidgets]);

  const cancelRename = useCallback(() => {
    setRenamingInstanceId(null);
    setRenameDraft('');
    setRenameError(null);
  }, []);

  const handleRenameInstance = useCallback(async (instance: WidgetInstance) => {
    if (!productAccountId || !canMutateWidgets) return;
    const nextDisplayName = renameDraft.trim();
    if (!nextDisplayName) {
      setRenameError('Instance name cannot be empty.');
      return;
    }
    if (nextDisplayName === instance.displayName.trim()) {
      cancelRename();
      return;
    }
    const actionKey = `rename:${instance.instanceId}`;
    setActiveActionKey(actionKey);
    setMutationError(null);
    setRenameError(null);
    try {
      const payload = await accountApi.fetchJson<{ instanceId?: string; displayName?: string }>(
        `/api/account/instances/${encodeURIComponent(instance.instanceId)}/rename`,
        {
          method: 'POST',
          headers: accountApi.buildHeaders({ contentType: 'application/json' }),
          body: JSON.stringify({ displayName: nextDisplayName }),
        },
      );
      const resolvedDisplayName = typeof payload.displayName === 'string' && payload.displayName.trim()
        ? payload.displayName.trim()
        : nextDisplayName;
      setWidgetInstances((current) => current.map((entry) => entry.instanceId === instance.instanceId
        ? { ...entry, displayName: resolvedDisplayName }
        : entry));
      updateRomaWidgetsCache(productAccountId, (current) => ({
        ...current,
        instances: current.instances.map((entry) => entry.instanceId === instance.instanceId
          ? { ...entry, displayName: resolvedDisplayName }
          : entry),
      }));
      cancelRename();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRenameError(resolveAccountShellErrorCopy(message, 'Renaming the widget failed. Please try again.'));
    } finally {
      setActiveActionKey((current) => current === actionKey ? null : current);
    }
  }, [accountApi, canMutateWidgets, cancelRename, productAccountId, renameDraft]);

  return {
    activeActionKey,
    canMutateWidgets,
    canRenderWidgetData,
    canSaveAsTemplate,
    cancelRename,
    changeSort,
    closeSaveAsTemplate,
    copyCodeContext,
    createdTemplate,
    displayedInstances,
    dismissSaveAsTemplate,
    domainLoading,
    domainRefreshing,
    handleDeleteInstance,
    handleDuplicateInstance,
    handleRenameInstance,
    handleSaveAsTemplate,
    handleStatusChange,
    mutationError,
    openCopyCode,
    openSaveAsTemplate,
    productAccountId,
    refreshWidgets,
    renameDraft,
    renameError,
    renamingInstanceId,
    saveAsTemplateError,
    saveAsTemplateInstance,
    selectedInstanceId,
    setCopyCodeContext,
    setRenameDraft,
    setTemplateName,
    setUpgradePrompt,
    setUpsellReason,
    sort,
    startRename,
    templateName,
    upgradePrompt,
    upsellReason,
    widgetDataError: dataError,
    widgetInstances,
  };
}

export type WidgetListController = ReturnType<typeof useWidgetListController>;
