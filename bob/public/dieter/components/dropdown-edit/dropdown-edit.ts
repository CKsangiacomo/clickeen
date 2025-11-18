import { createDropdownHydrator } from '../shared/dropdownToggle';

export const hydrateDropdownEdit = createDropdownHydrator({
  rootSelector: '.diet-dropdown-edit',
  triggerSelector: '.diet-dropdown-edit__trigger',
});
