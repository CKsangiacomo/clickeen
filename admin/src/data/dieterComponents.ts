import { componentCssByName, componentSources } from './componentRegistry';

export const dieterComponentCssByName = componentCssByName;
export const dieterComponentSlugs = componentSources.map((source) => source.name);
