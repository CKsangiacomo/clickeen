import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSavedWidgetPublicPackage } from './publicPackage';
import type { CompiledWidget } from '../types';

const widgetHtml = `<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="../shared/stagePod.css" />
    <link rel="stylesheet" href="./widget.css" />
  </head>
  <body>
    <div class="ck-widget ck-test-widget" data-ck-widget="faq" data-role="root">
      <h2>Saved FAQ title</h2>
      <script src="../shared/runtime.js" defer></script>
      <script src="./widget.client.js" defer></script>
    </div>
  </body>
</html>`;

function compiledWidget(): CompiledWidget {
  return {
    widgetname: 'faq',
    displayName: 'FAQ',
    defaults: {},
    panels: [],
    controls: [],
    media: {
      htmlUrl: '',
      cssUrl: '',
      jsUrl: '',
    },
    widgetPackage: {
      v: 1,
      widgetType: 'faq',
      files: {
        'widget.html': {
          mediaType: 'text/html',
          source: widgetHtml,
        },
        'product/widgets/shared/stagePod.css': {
          mediaType: 'text/css',
          source: '.stage{display:block}',
        },
        'product/widgets/faq/widget.css': {
          mediaType: 'text/css',
          source: '.ck-test-widget{display:block}',
        },
        'product/widgets/shared/runtime.js': {
          mediaType: 'text/javascript',
          source: 'window.CKWidgetRuntime = window.CKWidgetRuntime || {};',
        },
        'product/widgets/faq/widget.client.js': {
          mediaType: 'text/javascript',
          source: 'window.__FAQ_CLIENT__ = true;',
        },
        'product/widgets/shared/socialShare.css': {
          mediaType: 'text/css',
          source: '.ck-socialShare{position:absolute}',
        },
        'product/widgets/shared/socialShare.js': {
          mediaType: 'text/javascript',
          source: 'window.__SOCIAL_SHARE_INCLUDED__ = true;',
        },
      },
    },
  };
}

function buildPackage(socialShareEnabled: boolean) {
  return buildSavedWidgetPublicPackage({
    compiled: compiledWidget(),
    instanceId: 'Z9Y8X7W6V5',
    baseLocale: 'en',
    displayName: 'FAQ',
    state: {
      behavior: {
        socialShare: {
          enabled: socialShareEnabled,
        },
      },
    },
  });
}

test('saved widget package omits social share chrome when disabled', () => {
  const pkg = buildPackage(false);

  assert.doesNotMatch(pkg.indexHtml, /ck-socialShare/);
  assert.doesNotMatch(pkg.stylesCss, /ck-socialShare/);
  assert.doesNotMatch(pkg.runtimeJs, /SOCIAL_SHARE/);
});

test('saved widget package includes paid social share chrome when enabled', () => {
  const pkg = buildPackage(true);

  assert.match(pkg.indexHtml, /data-ck-instance-id="Z9Y8X7W6V5"/);
  assert.match(pkg.indexHtml, /data-ck-social-share-root/);
  assert.match(pkg.indexHtml, /Saved FAQ title/);
  assert.match(pkg.stylesCss, /ck-style-module:shared-socialShare\.css/);
  assert.match(pkg.stylesCss, /ck-socialShare/);
  assert.match(pkg.runtimeJs, /ck-runtime-module:shared-socialShare\.js/);
  assert.match(pkg.runtimeJs, /SOCIAL_SHARE_INCLUDED/);
  assert.match(pkg.runtimeJs, /CK_WIDGETS\[payload\.instanceId\]/);
});
