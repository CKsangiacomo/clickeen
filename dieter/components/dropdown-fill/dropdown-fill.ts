import { createDropdownHydrator } from '../shared/dropdownToggle';

type Mode = 'color' | 'image';

const hydrateHost = createDropdownHydrator({
  rootSelector: '.diet-dropdown-fill',
  triggerSelector: '.diet-dropdown-fill__control',
});

export function hydrateDropdownFill(scope: Element | DocumentFragment): void {
  const roots = Array.from(scope.querySelectorAll<HTMLElement>('.diet-dropdown-fill'));
  if (!roots.length) return;

  roots.forEach((root) => {
    wireModes(root);
  });

  hydrateHost(scope);
}

function wireModes(root: HTMLElement) {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('.diet-dropdown-fill__mode-btn'));
  if (!buttons.length) return;
  const setMode = (mode: Mode) => {
    root.dataset.mode = mode;
    buttons.forEach((btn) => {
      const isActive = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  };
  buttons.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const mode = btn.dataset.mode === 'image' ? 'image' : 'color';
      setMode(mode);
    });
  });
  const initial = root.dataset.mode === 'image' ? 'image' : 'color';
  setMode(initial);
}
