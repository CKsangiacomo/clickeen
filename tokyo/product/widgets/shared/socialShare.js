(function () {
  'use strict';

  var COPY = {
    messageText: 'Check out this widget from Clickeen!',
    socialTextPrefix: 'This Clickeen',
    socialTextSuffix: 'widget is awesome',
    linkCopied: 'Link copied',
    openingEmail: 'Opening email...',
    openingMessages: 'Opening messages...',
    copiedPastePrefix: 'Link copied (paste in ',
    copiedPasteSuffix: ')',
    copiedPasteLinkedIn: 'Copied (paste in LinkedIn)',
    openingPrefix: 'Opening ',
    openingSuffix: '...',
    previewOnly: 'Preview only',
  };
  var documentBound = false;

  function shareUrl(anchorId, channel) {
    var url = new URL(window.location.href);
    url.hash = anchorId;
    url.searchParams.set('ref', 'share');
    url.searchParams.set('channel', channel);
    return url.toString();
  }

  function shareText(action, widgetLabel) {
    if (['x', 'linkedin', 'facebook', 'reddit', 'instagram', 'tiktok'].indexOf(action) < 0) {
      return COPY.messageText;
    }
    return COPY.socialTextPrefix + ' ' + widgetLabel + ' ' + COPY.socialTextSuffix;
  }

  function showToast(toast, message) {
    toast.textContent = message;
    toast.style.display = 'block';
    window.setTimeout(function () {
      toast.style.display = 'none';
      toast.textContent = '';
    }, 1600);
  }

  async function copyText(value) {
    await navigator.clipboard.writeText(value);
  }

  function openUrl(url) {
    var opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (opened) opened.opener = null;
  }

  async function handleShare(args) {
    var url = shareUrl(args.anchorId, args.action);
    var text = shareText(args.action, args.widgetLabel);
    var title = document.title;

    if (args.preview) {
      showToast(args.toast, COPY.previewOnly);
      return;
    }
    if (args.action === 'copy') {
      await copyText(url);
      showToast(args.toast, COPY.linkCopied);
      return;
    }
    if (args.action === 'email') {
      window.location.href =
        'mailto:?subject=' +
        encodeURIComponent(title) +
        '&body=' +
        encodeURIComponent(text + '\n\n' + url);
      showToast(args.toast, COPY.openingEmail);
      return;
    }
    if (args.action === 'sms') {
      window.location.href = 'sms:?&body=' + encodeURIComponent(text + ' ' + url);
      showToast(args.toast, COPY.openingMessages);
      return;
    }

    var intentUrls = {
      whatsapp: 'https://wa.me/?text=' + encodeURIComponent(text + '\n' + url),
      telegram:
        'https://t.me/share/url?url=' +
        encodeURIComponent(url) +
        '&text=' +
        encodeURIComponent(text),
      x:
        'https://twitter.com/intent/tweet?url=' +
        encodeURIComponent(url) +
        '&text=' +
        encodeURIComponent(text),
      facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url),
      reddit:
        'https://www.reddit.com/submit?url=' +
        encodeURIComponent(url) +
        '&title=' +
        encodeURIComponent(text),
    };
    if (args.action === 'linkedin') {
      await copyText(text + '\n\n' + url);
      showToast(args.toast, COPY.copiedPasteLinkedIn);
      openUrl('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url));
      return;
    }
    if (intentUrls[args.action]) {
      openUrl(intentUrls[args.action]);
      showToast(args.toast, COPY.openingPrefix + args.channelLabel + COPY.openingSuffix);
      return;
    }

    var appUrls = {
      signal: 'https://signal.me/',
      messenger: 'https://www.messenger.com/',
      wechat: 'https://www.wechat.com/',
      line: 'https://line.me/',
      slack: 'https://slack.com/app',
      teams: 'https://teams.microsoft.com/',
      discord: 'https://discord.com/channels/@me',
      instagram: 'https://www.instagram.com/',
      tiktok: 'https://www.tiktok.com/',
    };
    await copyText(url);
    showToast(args.toast, COPY.copiedPastePrefix + args.channelLabel + COPY.copiedPasteSuffix);
    openUrl(appUrls[args.action]);
  }

  function installDocumentHandlers() {
    if (documentBound) return;
    documentBound = true;
    document.addEventListener('click', function (event) {
      document.querySelectorAll('.ck-socialShare__details[open]').forEach(function (details) {
        if (!details.contains(event.target)) details.open = false;
      });
      var button = event.target.closest('[data-ck-social-share-root] [data-action]');
      if (!button) return;
      var root = button.closest('[data-ck-social-share-root]');
      var details = root.querySelector('.ck-socialShare__details');
      var toast = root.querySelector('.ck-socialShare__toast');
      event.preventDefault();
      void handleShare({
        action: button.dataset.action,
        anchorId: root.dataset.ckShareAnchorId,
        widgetLabel: root.dataset.ckWidgetLabel,
        channelLabel: button.dataset.ckShareLabel,
        toast: toast,
        preview: root.dataset.ckPreview === 'true',
      }).then(function () {
        details.open = false;
      });
    });
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      document.querySelectorAll('.ck-socialShare__details[open]').forEach(function (details) {
        details.open = false;
      });
    });
  }

  function bind() {
    installDocumentHandlers();
  }

  window.CKSocialShare = Object.freeze({ bind });
})();
