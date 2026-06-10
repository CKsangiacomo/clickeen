// Bob module: builds shared Settings controls for shell-owned widget behavior.
// Widgets declare this shared node in the Settings panel; the shell owns the paths and labels.

type SocialShareChannel = {
  key: string;
  label: string;
  groupLabel: 'Message shares' | 'Social networks';
};

const socialShareChannels: SocialShareChannel[] = [
  { key: 'copy', label: 'Copy link', groupLabel: 'Message shares' },
  { key: 'sms', label: 'SMS', groupLabel: 'Message shares' },
  { key: 'email', label: 'Email', groupLabel: 'Message shares' },
  { key: 'whatsapp', label: 'WhatsApp', groupLabel: 'Message shares' },
  { key: 'telegram', label: 'Telegram', groupLabel: 'Message shares' },
  { key: 'signal', label: 'Signal', groupLabel: 'Message shares' },
  { key: 'messenger', label: 'Messenger', groupLabel: 'Message shares' },
  { key: 'wechat', label: 'WeChat', groupLabel: 'Message shares' },
  { key: 'line', label: 'LINE', groupLabel: 'Message shares' },
  { key: 'slack', label: 'Slack', groupLabel: 'Message shares' },
  { key: 'teams', label: 'Teams', groupLabel: 'Message shares' },
  { key: 'discord', label: 'Discord', groupLabel: 'Message shares' },
  { key: 'x', label: 'X', groupLabel: 'Social networks' },
  { key: 'linkedin', label: 'LinkedIn', groupLabel: 'Social networks' },
  { key: 'facebook', label: 'Facebook', groupLabel: 'Social networks' },
  { key: 'reddit', label: 'Reddit', groupLabel: 'Social networks' },
  { key: 'instagram', label: 'Instagram', groupLabel: 'Social networks' },
  { key: 'tiktok', label: 'TikTok', groupLabel: 'Social networks' },
];

const localeSwitcherAttachOptions =
  '[{\"label\":\"Stage\",\"value\":\"stage\"},{\"label\":\"Pod\",\"value\":\"pod\"}]'.replace(
    /"/g,
    '&quot;',
  );

const localeSwitcherPositionOptions =
  '[{\"label\":\"Top left\",\"value\":\"top-left\"},{\"label\":\"Top center\",\"value\":\"top-center\"},{\"label\":\"Top right\",\"value\":\"top-right\"},{\"label\":\"Right middle\",\"value\":\"right-middle\"},{\"label\":\"Bottom right\",\"value\":\"bottom-right\"},{\"label\":\"Bottom center\",\"value\":\"bottom-center\"},{\"label\":\"Bottom left\",\"value\":\"bottom-left\"},{\"label\":\"Left middle\",\"value\":\"left-middle\"}]'.replace(
    /"/g,
    '&quot;',
  );

function channelField(channel: SocialShareChannel): string {
  return `    <tooldrawer-field-settingsbehavior group-label='${channel.groupLabel}' type='toggle' size='md' path='behavior.socialShare.channels.${channel.key}' label='${channel.label}' show-if="behavior.socialShare.enabled == true" />`;
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
    "    <tooldrawer-field-settingsbehavior group-label='' type='toggle' size='md' path='localeSwitcher.enabled' label='Enable locale switcher' />",
  );
  push(
    'localeSwitcher.byIp',
    "    <tooldrawer-field-settingsbehavior group-label='' type='toggle' size='md' path='localeSwitcher.byIp' label='Use visitor locale' show-if=\"localeSwitcher.enabled == true\" />",
  );
  push(
    'localeSwitcher.alwaysShowLocale',
    "    <tooldrawer-field-settingsbehavior group-label='' type='textfield' size='md' path='localeSwitcher.alwaysShowLocale' label='Pinned locale' placeholder='e.g. en' show-if=\"localeSwitcher.enabled == true\" />",
  );
  push(
    'localeSwitcher.attachTo',
    `    <tooldrawer-field-settingsbehavior group-label='' type='dropdown-actions' size='md' path='localeSwitcher.attachTo' label='Attach to' value='{{localeSwitcher.attachTo}}' options='${localeSwitcherAttachOptions}' show-if=\"localeSwitcher.enabled == true\" />`,
  );
  push(
    'localeSwitcher.position',
    `    <tooldrawer-field-settingsbehavior group-label='' type='dropdown-actions' size='md' path='localeSwitcher.position' label='Position' value='{{localeSwitcher.position}}' options='${localeSwitcherPositionOptions}' show-if=\"localeSwitcher.enabled == true\" />`,
  );
  return fields.length
    ? ["  <tooldrawer-cluster label='Locale switcher'>", ...fields, '  </tooldrawer-cluster>']
    : [];
}

export function buildSettingsBehaviorPanelFields(): string[] {
  return [
    "  <tooldrawer-cluster label='Clickeen branding'>",
    "    <tooldrawer-field-settingsbehavior group-label='' type='toggle' size='md' path='behavior.showBacklink' label='Show Made with Clickeen' />",
    '  </tooldrawer-cluster>',
    "  <tooldrawer-cluster label='Social share'>",
    "    <tooldrawer-field-settingsbehavior group-label='' type='toggle' size='md' path='behavior.socialShare.enabled' label='Enable social share' />",
    ...socialShareChannels.map(channelField),
    '  </tooldrawer-cluster>',
  ];
}
