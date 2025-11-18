import { createDropdownHydrator } from '../shared/dropdownToggle';

export const hydrateDropdownActions = createDropdownHydrator({
  rootSelector: '.diet-dropdown-actions',
  triggerSelector: '.diet-dropdown-actions__trigger',
});
