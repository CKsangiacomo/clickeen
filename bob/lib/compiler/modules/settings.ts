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

function channelField(channel: SocialShareChannel): string {
  return `    <tooldrawer-field-settingsbehavior group-label='${channel.groupLabel}' type='toggle' size='md' path='behavior.socialShare.channels.${channel.key}' label='${channel.label}' show-if="behavior.socialShare.enabled == true" />`;
}

export function buildSettingsBehaviorPanelFields(): string[] {
  return [
    "  <tooldrawer-cluster label='Clickeen Branding'>",
    "    <tooldrawer-field-settingsbehavior group-label='' type='toggle' size='md' path='behavior.showBacklink' label='Show Made with Clickeen' />",
    "    <tooldrawer-field-settingsbehavior group-label='' type='toggle' size='md' path='behavior.socialShare.enabled' label='Enable social share' />",
    ...socialShareChannels.map(channelField),
    '  </tooldrawer-cluster>',
  ];
}
