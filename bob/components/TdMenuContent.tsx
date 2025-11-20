import type { ControlDescriptor, PanelId } from '../lib/types';
import { getAt } from '../lib/utils/paths';

type TdMenuContentProps = {
  panelId: PanelId | null;
  controls: ControlDescriptor[];
  instanceData: Record<string, unknown>;
  setValue: (path: string, value: unknown) => void;
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

export function TdMenuContent({ panelId, controls, instanceData, setValue }: TdMenuContentProps) {
  if (!panelId) {
    return (
      <div className="tdmenucontent">
        <div className="heading-3">No controls</div>
      </div>
    );
  }

  if (!controls.length) {
    return (
      <div className="tdmenucontent">
        <div className="heading-3">Panel</div>
        <div className="label-s label-muted">No controls in this panel.</div>
      </div>
    );
  }

  const visibleControls = controls.filter((control) => evaluateShowIf(control.showIf, instanceData));

  if (!visibleControls.length) {
    return (
      <div className="tdmenucontent">
        <div className="heading-3">{panelId}</div>
        <div className="label-s label-muted">No controls in this panel.</div>
      </div>
    );
  }

  return (
    <div className="tdmenucontent">
      <div className="heading-3">{panelId}</div>
      <div className="tdmenucontent__fields">
        {visibleControls.map((control) => {
          const value = getAt(instanceData, control.path);
          const size = control.size ?? 'md';

          if (control.type === 'toggle') {
            const isChecked = Boolean(value);
            return (
              <div key={control.key} className="diet-toggle diet-toggle--split" data-size={size}>
                <label className="diet-toggle__label label-s">{control.label}</label>
                <label className="diet-toggle__switch">
                  <input
                    className="diet-toggle__input sr-only"
                    type="checkbox"
                    role="switch"
                    checked={isChecked}
                    onChange={(e) => setValue(control.path, e.target.checked)}
                    aria-label={control.label}
                  />
                  <span className="diet-toggle__knob" />
                </label>
              </div>
            );
          }

          if (control.type === 'textfield') {
            return (
              <div key={control.key} className="diet-textfield" data-size={size}>
                <div className="diet-textfield__control">
                  {control.label && (
                    <label className="diet-textfield__display-label label-s">{control.label}</label>
                  )}
                  <input
                    className="diet-textfield__field"
                    type="text"
                    placeholder={control.placeholder ?? control.label}
                    value={String(value ?? '')}
                    onChange={(e) => setValue(control.path, e.target.value)}
                    aria-label={control.label}
                  />
                </div>
              </div>
            );
          }

          return (
            <div key={control.key} className="label-s label-muted">
              {control.label || control.path}: {String(value ?? '')}
            </div>
          );
        })}
      </div>
    </div>
  );
}
