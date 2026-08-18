import assert from 'node:assert/strict';
import { applyLocaleOverlayToContentSlot } from '../src/routes/clk-live-routes';

function createElement(attributes: Record<string, string>) {
  const currentAttributes = { ...attributes };
  const innerContent: Array<{ content: string; html: boolean }> = [];
  const element = {
    getAttribute(name: string) {
      return currentAttributes[name] ?? null;
    },
    setAttribute(name: string, value: string) {
      currentAttributes[name] = value;
      return element;
    },
    setInnerContent(content: string, options?: { html?: boolean }) {
      innerContent.push({ content, html: options?.html === true });
      return element;
    },
  };
  return { element, attributes: currentAttributes, innerContent };
}

const coordinate = 'cards|image-alt|cards.items[].imageAlt|cards.items[].id=card-1';

const textSlot = createElement({
  'data-ck-content-path': coordinate,
  'data-ck-content-mode': 'text',
});
applyLocaleOverlayToContentSlot({
  element: textSlot.element,
  values: { [coordinate]: 'Translated text' },
});
assert.deepEqual(textSlot.innerContent, [{ content: 'Translated text', html: false }]);

const richtextSlot = createElement({
  'data-ck-content-path': coordinate,
  'data-ck-content-mode': 'html',
});
applyLocaleOverlayToContentSlot({
  element: richtextSlot.element,
  values: { [coordinate]: '<strong>Translated</strong>' },
});
assert.deepEqual(richtextSlot.innerContent, [
  { content: '<strong>Translated</strong>', html: true },
]);

const attributeSlot = createElement({
  'data-ck-content-path': coordinate,
  'data-ck-content-attribute': 'alt',
  alt: 'Base alt',
});
applyLocaleOverlayToContentSlot({
  element: attributeSlot.element,
  values: { [coordinate]: 'Translated alt' },
});
assert.equal(attributeSlot.attributes.alt, 'Translated alt');
assert.deepEqual(attributeSlot.innerContent, []);

const untranslatedSlot = createElement({
  'data-ck-content-path': coordinate,
  'data-ck-content-attribute': 'title',
  title: 'New base title',
});
applyLocaleOverlayToContentSlot({
  element: untranslatedSlot.element,
  values: {},
});
assert.equal(untranslatedSlot.attributes.title, 'New base title');
assert.deepEqual(untranslatedSlot.innerContent, []);

console.log('content-slot overlay tests passed');
