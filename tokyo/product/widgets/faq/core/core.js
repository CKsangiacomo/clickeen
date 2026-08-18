(function () {
  'use strict';

  function setExpanded(question, expanded) {
    question.dataset.expanded = String(expanded);
    question.querySelector('[data-role="faq-question-toggle"]').ariaExpanded = String(expanded);
  }

  function collapseAll(list) {
    list.querySelectorAll('[data-role="faq-question"]').forEach(function (question) {
      setExpanded(question, false);
    });
  }

  function initialize(widgetShell) {
    var list = widgetShell.querySelector('[data-role="faq-list"]');
    var questions = list.querySelectorAll('[data-role="faq-question"]');
    var accordion = widgetShell.dataset.layout === 'accordion';
    var multiOpen = widgetShell.dataset.multiOpen === 'true';
    var deepLinks = widgetShell.dataset.deepLinks === 'true';

    function applyDeepLink() {
      if (!accordion || !deepLinks || !window.location.hash) return;
      var target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (!target || !target.matches('[data-role="faq-item"]')) return;
      if (!multiOpen) collapseAll(list);
      setExpanded(target.querySelector('[data-role="faq-question"]'), true);
    }

    if (accordion) {
      collapseAll(list);
      if (widgetShell.dataset.expandAll === 'true') {
        questions.forEach(function (question) {
          setExpanded(question, true);
        });
      } else if (widgetShell.dataset.expandFirst === 'true') {
        setExpanded(questions[0], true);
      }
      applyDeepLink();
    } else {
      questions.forEach(function (question) {
        setExpanded(question, true);
      });
    }

    list.addEventListener('click', function (event) {
      if (!accordion || !(event.target instanceof Element) || event.target.closest('a')) return;
      var question = event.target.closest('[data-role="faq-question"]');
      if (!question) return;
      var expanded = question.dataset.expanded !== 'true';
      if (!multiOpen) collapseAll(list);
      setExpanded(question, expanded);
      if (deepLinks && expanded) {
        window.location.hash = question.closest('[data-role="faq-item"]').id;
      }
    });
  }

  window.CKWidgetRuntime.register(initialize);
})();
