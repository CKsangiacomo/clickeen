import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePolicy } from './policy';

test('Tier 4 resolves through the account entitlement matrix', () => {
  const policy = resolvePolicy({ profile: 'tier4', role: 'owner' });

  assert.equal(policy.profile, 'tier4');
  assert.equal(policy.flags['branding.remove'], true);
  assert.equal(policy.flags['embed.seoGeo.enabled'], true);
  assert.equal(policy.flags['widget.socialShare.enabled'], true);
  assert.equal(policy.limits['instances.published.max'], null);
  assert.equal(policy.limits['widgets.types.max'], null);
  assert.equal(policy.limits['copilot.turns.monthly.max'], null);
});

test('Widget social share is a paid account flag', () => {
  const free = resolvePolicy({ profile: 'free', role: 'owner' });
  const paid = resolvePolicy({ profile: 'tier1', role: 'owner' });

  assert.equal(free.flags['widget.socialShare.enabled'], false);
  assert.equal(paid.flags['widget.socialShare.enabled'], true);
});
