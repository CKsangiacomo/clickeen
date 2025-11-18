export function hydrateButton(scope: Element | DocumentFragment): void {
  scope
    .querySelectorAll<HTMLButtonElement>('.diet-btn-ictxt, .diet-btn-ic, .diet-btn-txt')
    .forEach((btn) => {
      if (!btn.hasAttribute('type')) {
        btn.type = 'button';
      }
    });
}
