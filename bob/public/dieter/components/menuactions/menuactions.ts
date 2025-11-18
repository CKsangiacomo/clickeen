export function hydrateMenuactions(scope: Element | DocumentFragment): void {
  scope.querySelectorAll<HTMLButtonElement>('.diet-btn-menuactions').forEach((button) => {
    if (!button.hasAttribute('type')) {
      button.type = 'button';
    }
  });
}
