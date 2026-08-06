(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  const runtime = window.CKWidgetRuntime;
  if (!runtime || typeof runtime.register !== 'function') {
    throw new Error('[FAQ] Missing CKWidgetRuntime.register');
  }

  function readBoolean(element, name) {
    const value = element.dataset[name];
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new Error(`[FAQ] Missing boolean data setting: ${name}`);
  }

  function initFaq(widgetRoot) {
    const faqRoot = widgetRoot.querySelector('[data-role="faq"]');
    const list = widgetRoot.querySelector('[data-role="faq-list"]');
    if (!(faqRoot instanceof HTMLElement) || !(list instanceof HTMLElement)) {
      throw new Error('[FAQ] Missing generated FAQ markup');
    }

    const layout = faqRoot.dataset.layout;
    if (!['accordion', 'list', 'multicolumn'].includes(layout)) throw new Error('[FAQ] Invalid layout setting');
    const accordion = layout === 'accordion';
    const multiOpen = readBoolean(faqRoot, 'multiOpen');
    const expandAll = readBoolean(faqRoot, 'expandAll');
    const expandFirst = readBoolean(faqRoot, 'expandFirst');
    const deepLinks = readBoolean(faqRoot, 'deepLinks');
    const items = Array.from(list.querySelectorAll('[data-role="faq-item"]'));

    function setOpen(item, open) {
      const button = item.querySelector('[data-role="faq-question"]');
      const answer = item.querySelector('[data-role="faq-answer"]');
      if (!(button instanceof HTMLButtonElement) || !(answer instanceof HTMLElement)) return;
      item.dataset.open = open ? 'true' : 'false';
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      answer.hidden = !open;
    }

    if (!accordion) {
      items.forEach((item) => setOpen(item, true));
      return;
    }

    let hasOpenItem = false;
    items.forEach((item, index) => {
      const open = expandAll || item.dataset.defaultOpen === 'true' ||
        (!hasOpenItem && expandFirst && index === 0);
      setOpen(item, open);
      hasOpenItem = hasOpenItem || open;
    });

    list.addEventListener('click', (event) => {
      const button = event.target instanceof Element
        ? event.target.closest('[data-role="faq-question"]')
        : null;
      const item = button && button.closest('[data-role="faq-item"]');
      if (!(button instanceof HTMLButtonElement) || !(item instanceof HTMLElement)) return;
      const willOpen = item.dataset.open !== 'true';
      if (willOpen && !multiOpen) items.forEach((candidate) => setOpen(candidate, false));
      setOpen(item, willOpen);
      if (willOpen && deepLinks && item.id) window.location.hash = item.id;
    });

    if (deepLinks && window.location.hash) {
      const targetId = decodeURIComponent(window.location.hash.slice(1));
      const target = items.find((item) => item instanceof HTMLElement && item.id === targetId);
      if (target instanceof HTMLElement && target.matches('[data-role="faq-item"]')) {
        if (!multiOpen) items.forEach((item) => setOpen(item, false));
        setOpen(target, true);
      }
    }
  }

  runtime.register('faq', initFaq);
})();
