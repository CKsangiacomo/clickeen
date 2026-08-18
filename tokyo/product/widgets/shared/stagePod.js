(function () {
  'use strict';

  var observedStage = null;
  var observer = null;

  function postSize(stage) {
    if (window.parent === window) return;
    var rect = stage.getBoundingClientRect();
    window.parent.postMessage(
      {
        type: 'ck:resize',
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
        canvasMode: stage.dataset.canvasMode,
      },
      '*',
    );
  }

  function bind(widgetShell) {
    var stage = widgetShell.closest('.stage');
    postSize(stage);
    if (window.parent === window || observedStage === stage) return;
    if (observer) observer.disconnect();
    observedStage = stage;
    observer = new ResizeObserver(function () {
      postSize(observedStage);
    });
    observer.observe(stage);
  }

  window.CKStagePod = Object.freeze({ bind });
})();
