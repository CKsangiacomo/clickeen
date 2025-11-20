function syncButtonState(input: HTMLInputElement) {
  const button = input
    .closest('.diet-segment')
    ?.querySelector<HTMLButtonElement>('.diet-btn-ictxt, .diet-btn-ic, .diet-btn-txt');
  if (!button) return;
  button.setAttribute('aria-pressed', input.checked ? 'true' : 'false');
}

export function hydrateSegmented(scope: Element | DocumentFragment): void {
  scope
    .querySelectorAll<HTMLElement>('.diet-segmented-ic, .diet-segmented-ictxt, .diet-segmented-txt')
    .forEach((group) => {
      const inputs = Array.from(group.querySelectorAll<HTMLInputElement>('.diet-segment__input'));
      inputs.forEach((input) => {
        syncButtonState(input);
        if (input.dataset.segmentedWired === 'true') return;
        input.dataset.segmentedWired = 'true';
        input.addEventListener('change', () => {
          inputs.forEach((peer) => syncButtonState(peer));
        });
      });
    });
}
