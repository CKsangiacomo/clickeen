(function () {
  var COPY = {
    en: {
      share: 'Share',
      sendSection: 'Send this widget as message',
      socialSection: 'Share this widget on social',
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
      openingSuffix: '...'
    }
  };

  function normalizeLocale(value) {
    return String(value || 'en').toLowerCase().split('-')[0] || 'en';
  }

  function copyForLocale(locale) {
    return COPY[normalizeLocale(locale)] || COPY.en;
  }

  function closestWidgetRoot(node) {
    while (node && node instanceof HTMLElement) {
      if (node.hasAttribute('data-ck-widget') && node.getAttribute('data-role') === 'root') return node;
      node = node.parentElement;
    }
    return null;
  }

  function shareRootForWidget(root) {
    var candidates = root.querySelectorAll('[data-ck-social-share-root]');
    for (var i = 0; i < candidates.length; i += 1) {
      var candidate = candidates[i];
      if (candidate instanceof HTMLElement && closestWidgetRoot(candidate) === root) return candidate;
    }
    return null;
  }

  function applyCopy(root, copy) {
    var labels = root.querySelectorAll('[data-ck-share-copy-key]');
    labels.forEach(function (node) {
      if (!(node instanceof HTMLElement)) return;
      var key = node.getAttribute('data-ck-share-copy-key') || '';
      if (typeof copy[key] === 'string') node.textContent = copy[key];
    });
  }

  function shareUrlFor(anchorId, channel) {
    var url = new URL(window.location.href);
    if (anchorId) url.hash = anchorId;
    if (channel) {
      url.searchParams.set('ref', 'share');
      url.searchParams.set('channel', channel);
    }
    return url.toString();
  }

  function shareCopyFor(action, widgetLabel, copy) {
    var isSocial = ['x', 'linkedin', 'facebook', 'reddit', 'instagram', 'tiktok'].indexOf(action) >= 0;
    if (!isSocial) return copy.messageText;
    var label = String(widgetLabel || '').trim();
    return label
      ? copy.socialTextPrefix + ' ' + label + ' ' + copy.socialTextSuffix
      : copy.socialTextPrefix + ' ' + copy.socialTextSuffix;
  }

  function showToast(toast, message) {
    if (!(toast instanceof HTMLElement)) return;
    toast.textContent = message;
    toast.style.display = 'block';
    var timer = Number(toast.getAttribute('data-ck-toast-timer') || 0);
    if (timer) window.clearTimeout(timer);
    var nextTimer = window.setTimeout(function () {
      toast.style.display = 'none';
      toast.textContent = '';
      toast.removeAttribute('data-ck-toast-timer');
    }, 1600);
    toast.setAttribute('data-ck-toast-timer', String(nextTimer));
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_error) {}
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try { document.execCommand('copy'); } catch (_error) {}
    document.body.removeChild(textarea);
    return true;
  }

  function openUrl(url) {
    try {
      var opened = window.open(url, '_blank');
      if (opened) {
        try { opened.opener = null; } catch (_error) {}
        return true;
      }
    } catch (_error) {}
    return false;
  }

  async function handleShare(args) {
    var action = args.action;
    var url = shareUrlFor(args.anchorId, action);
    var title = document.title || 'Clickeen';
    var text = shareCopyFor(action, args.widgetLabel, args.copy);

    if (action === 'copy') {
      await copyText(url);
      showToast(args.toast, args.copy.linkCopied);
      return;
    }
    if (action === 'email') {
      window.location.href = 'mailto:?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(text + '\n\n' + url);
      showToast(args.toast, args.copy.openingEmail);
      return;
    }
    if (action === 'sms') {
      window.location.href = 'sms:?&body=' + encodeURIComponent(text + ' ' + url);
      showToast(args.toast, args.copy.openingMessages);
      return;
    }

    var intentUrls = {
      whatsapp: 'https://wa.me/?text=' + encodeURIComponent(text + '\n' + url),
      telegram: 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text),
      x: 'https://twitter.com/intent/tweet?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text),
      facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url),
      reddit: 'https://www.reddit.com/submit?url=' + encodeURIComponent(url) + '&title=' + encodeURIComponent(text)
    };
    if (action === 'linkedin') {
      await copyText(text + '\n\n' + url);
      showToast(args.toast, args.copy.copiedPasteLinkedIn);
      window.setTimeout(function () {
        openUrl('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url));
      }, 50);
      return;
    }
    if (intentUrls[action]) {
      var ok = openUrl(intentUrls[action]);
      if (ok) showToast(args.toast, args.copy.openingPrefix + args.channelLabel + args.copy.openingSuffix);
      else {
        await copyText(url);
        showToast(args.toast, args.copy.linkCopied);
      }
      return;
    }

    var appUrls = {
      signal: 'https://signal.me/',
      messenger: 'https://www.messenger.com/',
      line: 'https://line.me/',
      slack: 'https://slack.com/app',
      teams: 'https://teams.microsoft.com/',
      discord: 'https://discord.com/channels/@me',
      instagram: 'https://www.instagram.com/',
      tiktok: 'https://www.tiktok.com/'
    };
    await copyText(url);
    showToast(args.toast, args.copy.copiedPastePrefix + args.channelLabel + args.copy.copiedPasteSuffix);
    if (appUrls[action]) openUrl(appUrls[action]);
  }

  function bindRoot(root) {
    var shareRoot = shareRootForWidget(root);
    if (!shareRoot || shareRoot.getAttribute('data-ck-social-share-bound') === '1') return;
    shareRoot.setAttribute('data-ck-social-share-bound', '1');

    var instanceId = root.getAttribute('data-ck-instance-id') || '';
    var context = instanceId && window.CK_WIDGETS ? window.CK_WIDGETS[instanceId] : null;
    var copy = copyForLocale(context && context.locale);
    applyCopy(shareRoot, copy);

    var details = shareRoot.querySelector('.ck-socialShare__details');
    var menu = shareRoot.querySelector('.ck-socialShare__menu');
    var toast = shareRoot.querySelector('.ck-socialShare__toast');
    if (!(details instanceof HTMLDetailsElement) || !(menu instanceof HTMLElement)) return;

    function close() {
      details.open = false;
    }

    document.addEventListener('click', function (event) {
      if (!details.open) return;
      var target = event.target;
      if (target instanceof Node && details.contains(target)) return;
      close();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') close();
    });
    root.addEventListener('pointerleave', close);

    menu.addEventListener('click', async function (event) {
      var target = event.target;
      if (!(target instanceof Element)) return;
      var button = target.closest('[data-action]');
      if (!(button instanceof HTMLElement)) return;
      var action = button.getAttribute('data-action') || '';
      if (!action) return;
      event.preventDefault();
      try {
        await handleShare({
          action: action,
          anchorId: shareRoot.getAttribute('data-ck-share-anchor-id') || root.id || '',
          widgetLabel: shareRoot.getAttribute('data-ck-widget-label') || '',
          channelLabel: button.getAttribute('data-ck-share-label') || button.textContent || action,
          toast: toast,
          copy: copy
        });
      } finally {
        close();
      }
    });
  }

  function bindAll() {
    document.querySelectorAll('[data-ck-widget][data-role="root"][data-ck-instance-id]').forEach(function (root) {
      if (root instanceof HTMLElement) bindRoot(root);
    });
  }

  window.CKSocialShare = Object.assign({}, window.CKSocialShare || {}, { bindAll: bindAll });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAll, { once: true });
  } else {
    bindAll();
  }
})();
