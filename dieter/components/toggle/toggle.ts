// Minimal hydrator for toggle; ensures focus/checked state is managed when Dieter JS is loaded.
export function hydrateToggle(scope: Element | DocumentFragment): void {
  scope.querySelectorAll<HTMLElement>('.diet-toggle').forEach((root) => {
    const input = root.querySelector<HTMLInputElement>('.diet-toggle__input');
    if (!input || input.dataset.toggleWired === 'true') return;
    input.dataset.toggleWired = 'true';

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        input.click();
      }
    });

    // Ensure space/enter toggles when the visible switch receives delegated focus.
    const switchLabel = root.querySelector<HTMLElement>('.diet-toggle__switch');
    if (switchLabel) {
      switchLabel.addEventListener('keydown', (event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          input.click();
        }
      });
    }
  });
}
