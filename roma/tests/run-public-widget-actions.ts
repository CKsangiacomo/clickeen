import assert from 'node:assert/strict';
import { buildWidgetPublicActions } from '../lib/public-widget-actions';

const actions = buildWidgetPublicActions({
  accountPublicId: 'CLICKEEN',
  instanceId: 'ABC123',
  baseUrl: 'https://dev.clk.live/',
});

assert.equal(actions.publicUrl, 'https://dev.clk.live/CLICKEEN/ABC123');
assert.match(actions.iframeSnippet, /src="https:\/\/dev\.clk\.live\/CLICKEEN\/ABC123"/);
console.log('PASS Roma owns exact public Widget actions');
