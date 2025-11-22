// Minimal hydrator for toggle; ensures focus/checked state is managed when Dieter JS is loaded.
export function hydrateToggle(scope: Element | DocumentFragment): void {
  scope.querySelectorAll<HTMLElement>('.diet-toggle').forEach((root) => {
    const input = root.querySelector<HTMLInputElement>('.diet-toggle__input');
    if (!input || input.dataset.toggleWired === 'true') return;
    input.dataset.toggleWired = 'true';

    // Ensure space/enter toggles when the wrapping label is clicked (native works, but keep parity with other controls)
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
