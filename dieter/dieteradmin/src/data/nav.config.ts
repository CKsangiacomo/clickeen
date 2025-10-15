export interface NavConfigGroup { id: string; title: string; items: string[] }
export interface NavConfig {
  groups: NavConfigGroup[];
}

export const navConfig: NavConfig = {
  groups: [
    { id: 'foundations', title: 'Foundations', items: ['typography', 'colors', 'icons'] },
    { id: 'components', title: 'Components', items: ['button', 'segmented', 'textfield', 'dropdown', 'expander', 'toggle', 'tabs', 'textrename'] },
    // Removed widget previews from Dieter Admin nav; use External → Bob to preview
    { id: 'external', title: 'External', items: ['bob'] },
  ],
};
