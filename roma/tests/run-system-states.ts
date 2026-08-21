import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readSource(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

async function run(): Promise<void> {
  const [stateComponent, widgets, assets, account, accountLocales, team, defaults, settings, copySource] = await Promise.all([
    readSource('components/roma-system-state.tsx'),
    readSource('components/widgets-domain.tsx'),
    readSource('components/assets-domain.tsx'),
    readSource('components/roma-account-context.tsx'),
    readSource('components/account-locale-settings-card.tsx'),
    readSource('components/team-domain.tsx'),
    readSource('components/widget-defaults-domain.tsx'),
    readSource('components/settings-domain.tsx'),
    readSource('l10n/en.json'),
  ]);
  const copy = JSON.parse(copySource) as {
    state: {
      loadingAccessibleLabel: string;
      empty: Record<string, string>;
    };
  };

  assert.equal(copy.state.loadingAccessibleLabel, 'Loading');
  assert.deepEqual(copy.state.empty, {
    widgets: 'No widgets',
    filteredWidgets: 'No matching widgets',
    widgetTypes: 'No widget types',
    assets: 'No assets',
    filteredAssets: 'No matching assets',
    teamMembers: 'No team members',
    invitations: 'No pending invitations',
    ownerCandidates: 'No eligible members',
  });

  assert.match(stateComponent, /className="diet-spinner" data-size="medium" aria-hidden="true"/);
  assert.match(stateComponent, /diet-empty-state__icon diet-icon diet-icon-mask/);
  assert.match(stateComponent, /\/dieter\/icons\/svg\/ellipsis\.svg/);
  assert.match(stateComponent, /diet-empty-state__label body-s/);
  assert.doesNotMatch(stateComponent, /action|description|title/);

  const migrated = [widgets, assets, account, accountLocales, team, defaults, settings].join('\n');
  assert.match(migrated, /<RomaLoadingState/);
  assert.match(migrated, /<RomaEmptyState/);
  assert.doesNotMatch(
    migrated,
    /Loading (?:domain|widgets|assets|team members|invitations|widget defaults|Builder controls)/,
  );
  assert.match(accountLocales, /data-loading=\{refreshing \|\| undefined\}/);
  assert.doesNotMatch(accountLocales, /data-loading=\{loading \|\| undefined\}/);
  assert.match(account, /if \(!value && me\.loading && !retryPending\)/);
  assert.match(account, /data-loading=\{retryPending \|\| undefined\}/);
  assert.doesNotMatch(account, /me\.loading \|\| me\.error/);
  assert.match(assets, /data-loading=\{headerActions\.listRefreshPending \|\| undefined\}/);
  assert.doesNotMatch(assets, /data-loading=\{headerActions\.listLoading \|\| undefined\}/);
  assert.match(team, /data-loading=\{revokingInvitationId === invitation\.invitationId \|\| undefined\}/);
  assert.match(team, /revokingInvitationId === invitation\.invitationId \? <span className="diet-spinner"/);
  assert.doesNotMatch(
    migrated,
    /No widgets yet|No widget types available|No assets found|No assets match|No members found/,
  );

  console.log('PASS Roma systemic loading and empty state contracts');
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
