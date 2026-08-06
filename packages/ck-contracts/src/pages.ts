export type PageRobots = 'index-follow' | 'noindex-follow';

export type PageValues = {
  title: string;
  description?: string;
  socialTitle?: string;
  socialDescription?: string;
  socialImageAssetRef?: string;
};

export type PagePlacement = {
  placementId: string;
  instanceId: string;
};

export type AccountPage = {
  pageId: string;
  displayName: string;
  isTemplate: false;
  baseLocale: string;
  values: PageValues;
  robots: PageRobots;
  placements: PagePlacement[];
};

export type AccountPageTemplate = {
  pageId: string;
  displayName: string;
  isTemplate: true;
  values: PageValues;
  robots: PageRobots;
  placements: PagePlacement[];
  baseLocale?: never;
};

export type AccountPageSource = AccountPage | AccountPageTemplate;

export type PageLocaleOverlay = {
  values: Partial<
    Pick<PageValues, 'description' | 'socialTitle' | 'socialDescription'>
  > & {
    title: string;
  };
};
