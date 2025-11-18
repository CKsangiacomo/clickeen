import { useMemo } from 'react';
import type { CompiledPanel, ControlDescriptor } from '../lib/types';

type TdMenuContentProps = {
  panel: CompiledPanel | null;
  instanceData: Record<string, unknown>;
  setValue: (path: string, value: unknown) => void;
};

function getValueAtPath(data: Record<string, unknown>, path: string) {
  return path.split('.').reduce<any>((acc, segment) => {
    if (acc === undefined || acc === null) return undefined;
    if (typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[segment];
  }, data);
}

function shouldShowControl(control: ControlDescriptor, data: Record<string, unknown>) {
  if (!control.showIf) return true;
  const value = getValueAtPath(data, control.showIf);
  return Boolean(value);
}

function renderControl(
  control: ControlDescriptor,
  data: Record<string, unknown>,
  setValue: (path: string, value: unknown) => void
) {
  if (control.type === 'toggle') {
    const size = control.size ?? 'sm';
    const checked = Boolean(getValueAtPath(data, control.path));
    const id = `control-${control.key}`;
    return (
      <div key={control.key} className="diet-toggle diet-toggle--block" data-size={size}>
        <span className="diet-toggle__label label" id={`${id}-label`}>
          {control.label}
        </span>
        <input
          id={id}
          className="diet-toggle__input sr-only"
          type="checkbox"
          role="switch"
          aria-labelledby={`${id}-label`}
          checked={checked}
          onChange={(event) => setValue(control.path, event.target.checked)}
        />
        <label className="diet-toggle__switch" htmlFor={id} aria-hidden="true">
          <span className="diet-toggle__knob" />
        </label>
      </div>
    );
  }

  if (control.type === 'textfield') {
    const size = control.size ?? 'md';
    const value = getValueAtPath(data, control.path);
    const stringValue = typeof value === 'string' ? value : '';
    const id = `control-${control.key}`;
    const label = control.label ?? '';
    const hasLabel = Boolean(label);
    return (
      <div key={control.key} className="diet-textfield" data-size={size}>
        <label className="diet-textfield__control" htmlFor={id}>
          <span
            className={`diet-textfield__display-label label${hasLabel ? '' : ' is-hidden'}`}
          >
            {hasLabel ? `${label}:` : ''}
          </span>
          <input
            id={id}
            type="text"
            className="diet-textfield__field body"
            aria-label={label}
            value={stringValue}
            placeholder={control.placeholder ?? ''}
            onChange={(event) => setValue(control.path, event.target.value)}
          />
        </label>
      </div>
    );
  }

  return (
    <div key={control.key} className="label label-muted">
      Unsupported control type: {control.type}
    </div>
  );
}

export function TdMenuContent({ panel, instanceData, setValue }: TdMenuContentProps) {
  const controls = useMemo(() => panel?.controls ?? [], [panel]);

  if (!panel) {
    return (
      <div className="tdmenucontent">
        <div className="heading-3">No controls</div>
      </div>
    );
  }

  const visibleControls = controls.filter((control) => shouldShowControl(control, instanceData));

  return (
    <div className="tdmenucontent">
      <div className="heading-3">{panel.label}</div>
      {visibleControls.length === 0 ? (
        <div className="label label-muted">No controls available.</div>
      ) : (
        visibleControls.map((control) => renderControl(control, instanceData, setValue))
      )}
    </div>
  );
}
