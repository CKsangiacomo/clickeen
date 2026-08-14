type SliderState = {
  sync: () => void;
};

const states = new WeakMap<HTMLInputElement, SliderState>();

function syncProgress(input: HTMLInputElement): void {
  input.style.setProperty('--value', input.value);
  input.style.setProperty('--min', input.min);
  input.style.setProperty('--max', input.max);
}

export function hydrateSlider(scope: Element | DocumentFragment): void {
  scope.querySelectorAll<HTMLInputElement>('.diet-slider__input').forEach((input) => {
    const current = states.get(input);
    if (current) {
      current.sync();
      return;
    }
    const sync = () => syncProgress(input);
    syncProgress(input);
    input.addEventListener('input', sync);
    input.addEventListener('external-sync', sync);
    states.set(input, { sync });
  });
}

export function destroySlider(input: HTMLInputElement): void {
  const state = states.get(input);
  if (!state) return;
  input.removeEventListener('input', state.sync);
  input.removeEventListener('external-sync', state.sync);
  states.delete(input);
}
