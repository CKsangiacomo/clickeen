// Bob module: builds common Settings controls used by every widget type.
// Widgets declare this shared node; each setting remains owned by its named runtime accessory.

import { encodeHtmlEntities } from '../../compiler.shared';
import settingsCopy from '../../../l10n/editor/settings/en.json';

type SocialShareChannel = {
  key: keyof typeof settingsCopy.channels;
  group: keyof typeof settingsCopy.groups;
};

const socialShareChannels: SocialShareChannel[] = [
  { key: 'copy', group: 'messageShares' },
  { key: 'sms', group: 'messageShares' },
  { key: 'email', group: 'messageShares' },
  { key: 'whatsapp', group: 'messageShares' },
  { key: 'telegram', group: 'messageShares' },
  { key: 'signal', group: 'messageShares' },
  { key: 'messenger', group: 'messageShares' },
  { key: 'wechat', group: 'messageShares' },
  { key: 'line', group: 'messageShares' },
  { key: 'slack', group: 'messageShares' },
  { key: 'teams', group: 'messageShares' },
  { key: 'discord', group: 'messageShares' },
  { key: 'x', group: 'socialNetworks' },
  { key: 'linkedin', group: 'socialNetworks' },
  { key: 'facebook', group: 'socialNetworks' },
  { key: 'reddit', group: 'socialNetworks' },
  { key: 'instagram', group: 'socialNetworks' },
  { key: 'tiktok', group: 'socialNetworks' },
];

const encodeOptions = (value: Array<{ label: string; value: string }>) =>
  encodeHtmlEntities(JSON.stringify(value));

const localeSwitcherAttachOptions = encodeOptions(
  [
    { label: settingsCopy.options.stage, value: 'stage' },
    { label: settingsCopy.options.pod, value: 'pod' },
  ],
);

const shellUtilityAttachOptions = localeSwitcherAttachOptions;

const localeSwitcherPositionOptions = encodeOptions(
  [
    { label: settingsCopy.options.topLeft, value: 'top-left' },
    { label: settingsCopy.options.topCenter, value: 'top-center' },
    { label: settingsCopy.options.topRight, value: 'top-right' },
    { label: settingsCopy.options.rightMiddle, value: 'right-middle' },
    { label: settingsCopy.options.bottomRight, value: 'bottom-right' },
    { label: settingsCopy.options.bottomCenter, value: 'bottom-center' },
    { label: settingsCopy.options.bottomLeft, value: 'bottom-left' },
    { label: settingsCopy.options.leftMiddle, value: 'left-middle' },
  ],
);

const shellUtilityPositionOptions = localeSwitcherPositionOptions;

function channelField(channel: SocialShareChannel): string {
  return `    <tooldrawer-field-settingsbehavior group-label='${settingsCopy.groups[channel.group]}' type='toggle' size='md' path='behavior.socialShare.channels.${channel.key}' label='${settingsCopy.channels[channel.key]}' show-if="behavior.socialShare.enabled == true" />`;
}

export function buildLocaleSwitcherSettingsPanelFields(
  existingPaths: ReadonlySet<string> = new Set(),
): string[] {
  const fields: string[] = [];
  const push = (path: string, line: string) => {
    if (!existingPaths.has(path)) fields.push(line);
  };
  push(
    'localeSwitcher.enabled',
    `    <tooldrawer-field-settingsbehavior group-label='' type='toggle' size='md' path='localeSwitcher.enabled' label='${settingsCopy.fields.enableLocaleSwitcher}' />`,
  );
  push(
    'localeSwitcher.attachTo',
    `    <tooldrawer-field-settingsbehavior group-label='' type='dropdown-actions' size='md' path='localeSwitcher.attachTo' label='${settingsCopy.fields.attachTo}' value='{{localeSwitcher.attachTo}}' options='${localeSwitcherAttachOptions}' show-if="localeSwitcher.enabled == true" />`,
  );
  push(
    'localeSwitcher.position',
    `    <tooldrawer-field-settingsbehavior group-label='' type='dropdown-actions' size='md' path='localeSwitcher.position' label='${settingsCopy.fields.position}' value='{{localeSwitcher.position}}' options='${localeSwitcherPositionOptions}' show-if="localeSwitcher.enabled == true" />`,
  );
  return fields.length
    ? [`  <tooldrawer-cluster label='${settingsCopy.clusters.localeSwitcher}'>`, ...fields, '  </tooldrawer-cluster>']
    : [];
}

export function buildSettingsBehaviorPanelFields(): string[] {
  return [
    `  <tooldrawer-cluster label='${settingsCopy.clusters.seoGeo}'>`,
    `    <tooldrawer-field-settingsbehavior group-label='' type='toggle' size='md' path='behavior.seoGeo.enabled' label='${settingsCopy.fields.enableSeoGeo}' />`,
    '  </tooldrawer-cluster>',
    `  <tooldrawer-cluster label='${settingsCopy.clusters.branding}'>`,
    `    <tooldrawer-field-settingsbehavior group-label='' type='toggle' size='md' path='behavior.showBacklink' label='${settingsCopy.fields.showMadeWithClickeen}' />`,
    '  </tooldrawer-cluster>',
    `  <tooldrawer-cluster label='${settingsCopy.clusters.socialShare}'>`,
    `    <tooldrawer-field-settingsbehavior group-label='' type='toggle' size='md' path='behavior.socialShare.enabled' label='${settingsCopy.fields.enableSocialShare}' />`,
    `    <tooldrawer-field-settingsbehavior group-label='' type='dropdown-actions' size='md' path='behavior.socialShare.attachTo' label='${settingsCopy.fields.stickTo}' value='{{behavior.socialShare.attachTo}}' options='${shellUtilityAttachOptions}' show-if="behavior.socialShare.enabled == true" />`,
    `    <tooldrawer-field-settingsbehavior group-label='' type='dropdown-actions' size='md' path='behavior.socialShare.position' label='${settingsCopy.fields.position}' value='{{behavior.socialShare.position}}' options='${shellUtilityPositionOptions}' show-if="behavior.socialShare.enabled == true" />`,
    ...socialShareChannels.map(channelField),
    '  </tooldrawer-cluster>',
  ];
}
