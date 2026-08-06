'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { createDialogLifecycle, type DialogLifecycle } from '../../dieter/components/shared/dialog-lifecycle';
import { DieterTextfield } from './dieter-textfield';
import { PublicCodeDialog } from './public-code-dialog';
import { RomaUpsellDialog } from './roma-upsell-dialog';
import type { WidgetListController, WidgetUpgradePrompt } from './use-widget-list-controller';
import { DEFAULT_INSTANCE_DISPLAY_NAME } from './use-roma-widgets';

function WidgetUpgradePromptDialog({
  prompt,
  onClose,
  onUpgrade,
}: {
  prompt: WidgetUpgradePrompt | null;
  onClose: () => void;
  onUpgrade: (reason: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lifecycleRef = useRef<DialogLifecycle | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const lifecycle = createDialogLifecycle({
      dialog,
      initialFocus: () => closeButtonRef.current,
      requestDismiss: () => onCloseRef.current(),
    });
    lifecycleRef.current = lifecycle;
    return () => lifecycle.destroy();
  }, []);

  useEffect(() => {
    if (prompt) lifecycleRef.current?.open();
    else lifecycleRef.current?.close();
  }, [prompt]);

  return (
    <dialog ref={dialogRef} className="diet-popup" data-size="medium" aria-labelledby="roma-widgets-upgrade-title">
      <header className="diet-popup__header">
        <h2 id="roma-widgets-upgrade-title" className="heading-4">{prompt?.message}</h2>
      </header>
      <div className="diet-popup__body">
        {prompt ? <p className="body-m">You are using {prompt.current} of {prompt.limit} widget instances.</p> : null}
      </div>
      <footer className="diet-popup__footer">
        <div className="diet-popup__actions">
          <button ref={closeButtonRef} className="diet-btn-txt" data-size="md" data-variant="neutral" type="button" onClick={onClose}>
            <span className="diet-btn-txt__label body-m">Close</span>
          </button>
          <button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" onClick={() => prompt && onUpgrade(prompt.message)}>
            <span className="diet-btn-txt__label body-m">Upgrade</span>
          </button>
        </div>
      </footer>
    </dialog>
  );
}

function SaveWidgetTemplateDialog({ controller }: { controller: WidgetListController }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lifecycleRef = useRef<DialogLifecycle | null>(null);
  const dismissRef = useRef(controller.dismissSaveAsTemplate);
  dismissRef.current = controller.dismissSaveAsTemplate;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const lifecycle = createDialogLifecycle({
      dialog,
      initialFocus: () => dialog.querySelector('input'),
      requestDismiss: () => dismissRef.current(),
    });
    lifecycleRef.current = lifecycle;
    return () => lifecycle.destroy();
  }, []);

  useEffect(() => {
    if (controller.saveAsTemplateInstance) lifecycleRef.current?.open();
    else lifecycleRef.current?.close();
  }, [controller.saveAsTemplateInstance]);

  const saving = Boolean(controller.activeActionKey?.startsWith('save-template:'));
  const sourceName = (controller.saveAsTemplateInstance?.displayName || DEFAULT_INSTANCE_DISPLAY_NAME).trim();
  return (
    <dialog ref={dialogRef} className="diet-popup" data-size="medium" aria-labelledby="roma-save-template-title">
      <header className="diet-popup__header">
        <h2 id="roma-save-template-title" className="heading-4">Save as template</h2>
      </header>
      <div className="diet-popup__body">
        {controller.createdTemplate ? (
          <p className="body-m">{controller.createdTemplate.templateName} was saved as a template.</p>
        ) : <>
          <DieterTextfield
            label="Template name"
            value={controller.templateName}
            maxLength={120}
            onChange={(event) => controller.setTemplateName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void controller.handleSaveAsTemplate();
              }
            }}
          />
          <p className="body-s">Your current changes will be saved first.</p>
          {controller.saveAsTemplateError ? <p className="body-s" role="alert">{controller.saveAsTemplateError}</p> : null}
        </>}
      </div>
      <footer className="diet-popup__footer">
        <div className="diet-popup__actions">
          {controller.createdTemplate ? <>
            <button className="diet-btn-txt" data-size="md" data-variant="neutral" type="button" onClick={controller.closeSaveAsTemplate}>
              <span className="diet-btn-txt__label body-m">Stay here</span>
            </button>
            <button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" onClick={() => router.push(`/builder/${encodeURIComponent(controller.createdTemplate?.templateId ?? '')}`)}>
              <span className="diet-btn-txt__label body-m">Open template</span>
            </button>
          </> : <>
            <button className="diet-btn-txt" data-size="md" data-variant="neutral" type="button" onClick={controller.closeSaveAsTemplate} disabled={saving}>
              <span className="diet-btn-txt__label body-m">Cancel</span>
            </button>
            <button
              className="diet-btn-txt"
              data-size="md"
              data-variant="primary"
              type="button"
              onClick={() => void controller.handleSaveAsTemplate()}
              disabled={!controller.canSaveAsTemplate || !controller.templateName.trim() || controller.templateName.trim() === sourceName || Boolean(controller.activeActionKey)}
            >
              <span className="diet-btn-txt__label body-m">{saving ? 'Saving...' : 'Save as template'}</span>
            </button>
          </>}
        </div>
      </footer>
    </dialog>
  );
}

export function WidgetListDialogs({ controller }: { controller: WidgetListController }) {
  return (
    <>
      <SaveWidgetTemplateDialog controller={controller} />
      <WidgetUpgradePromptDialog
        prompt={controller.upgradePrompt}
        onClose={() => controller.setUpgradePrompt(null)}
        onUpgrade={(reason) => {
          controller.setUpgradePrompt(null);
          controller.setUpsellReason(reason);
        }}
      />
      <RomaUpsellDialog open={Boolean(controller.upsellReason)} reason={controller.upsellReason ?? undefined} onClose={() => controller.setUpsellReason(null)} />
      <PublicCodeDialog
        open={Boolean(controller.copyCodeContext)}
        productName={controller.copyCodeContext?.instanceName ?? ''}
        actions={controller.copyCodeContext?.actions ?? null}
        onClose={() => controller.setCopyCodeContext(null)}
      />
    </>
  );
}
