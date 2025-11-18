export type DropdownHydrateConfig = {
  rootSelector: string;
  triggerSelector: string;
  popoverSelector?: string;
};

export function createDropdownHydrator(_config: DropdownHydrateConfig) {
  return function hydrate(): void {
    /* noop stub – real implementation comes with dropdown feature */
  };
}
