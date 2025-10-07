export interface NavConfigGroup { id: string; title: string; items: string[] }
export interface NavConfig {
  groups: NavConfigGroup[];
  includeCandidatesGroup?: boolean;
  candidatesTitle?: string;
}

export const navConfig: NavConfig = {
  groups: [
    { id: 'foundations', title: 'Foundations', items: ['typography', 'colors', 'icons'] },
    { id: 'components', title: 'Components', items: ['button', 'segmented', 'textfield'] },
  ],
  includeCandidatesGroup: true,
  candidatesTitle: 'Previews',
};

