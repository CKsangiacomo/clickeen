import { SHELL_EDITABLE_FIELD_PATHS } from './contract';

export type WidgetShellEditableField = {
  path: (typeof SHELL_EDITABLE_FIELD_PATHS)[number];
  label: string;
  type: 'string' | 'richtext';
  role: 'title' | 'body' | 'header-cta-label';
  arrayItemIdentity: [];
  limits: [];
};

export const WIDGET_SHELL_EDITABLE_FIELDS: readonly WidgetShellEditableField[] = [
  {
    path: 'header.title',
    label: 'Header title',
    type: 'richtext',
    role: 'title',
    arrayItemIdentity: [],
    limits: [],
  },
  {
    path: 'header.subtitleHtml',
    label: 'Header subtitle',
    type: 'richtext',
    role: 'body',
    arrayItemIdentity: [],
    limits: [],
  },
  {
    path: 'headerCta.label',
    label: 'Header CTA label',
    type: 'string',
    role: 'header-cta-label',
    arrayItemIdentity: [],
    limits: [],
  },
];

export function composeWidgetEditableFields<TCoreField extends { path: string }>(coreFields: readonly TCoreField[]) {
  return [...WIDGET_SHELL_EDITABLE_FIELDS, ...coreFields] as const;
}
