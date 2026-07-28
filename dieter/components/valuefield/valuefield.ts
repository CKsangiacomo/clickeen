export function hydrateValuefield(scope: Element | DocumentFragment): void {
  scope.querySelectorAll<HTMLElement>('.diet-valuefield').forEach((root) => {
    const input = root.querySelector<HTMLInputElement>('.diet-valuefield__field');
    if (!input) return;
    if (input.dataset.valuefieldWired === 'true') return;
    input.dataset.valuefieldWired = 'true';

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        input.blur();
      }
    });
  });
}
