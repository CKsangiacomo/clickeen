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
      openingSuffix: '...',
      previewOnly: 'Preview only'
    }
  };

  var MESSAGE_CARDS = [
    ['copy', 'Copy link', 'copy'],
    ['sms', 'SMS', 'copy'],
    ['email', 'Email', 'copy'],
    ['whatsapp', 'WhatsApp', 'copy'],
    ['telegram', 'Telegram', 'copy'],
    ['signal', 'Signal', 'copy'],
    ['messenger', 'Messenger', 'copy'],
    ['wechat', 'WeChat', 'copy'],
    ['line', 'LINE', 'copy'],
    ['slack', 'Slack', 'copy'],
    ['teams', 'Teams', 'copy'],
    ['discord', 'Discord', 'copy']
  ];

  var SOCIAL_CARDS = [
    ['x', 'X', 'share'],
    ['linkedin', 'LinkedIn', 'share'],
    ['facebook', 'Facebook', 'share'],
    ['reddit', 'Reddit', 'share'],
    ['instagram', 'Instagram', 'share'],
    ['tiktok', 'TikTok', 'share']
  ];

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

  function escapeHtml(raw) {
    return String(raw || '').replace(/[&<>"']/g, function (char) {
      switch (char) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        default:
          return '&#39;';
      }
    });
  }

  function socialShareIcon(name) {
    switch (name) {
      case 'share':
        return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 14V4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8.5 7.5 12 4l3.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 14v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      case 'copy':
        return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 9h9a2 2 0 0 1 2 2v9H11a2 2 0 0 1-2-2V9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      default:
        return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8"/><path d="M8 12h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    }
  }

  function shareCard(action, label, iconName) {
    var icon = iconName || action;
    return '<button type="button" class="ck-socialShare__card" data-action="' + escapeHtml(action) + '" data-ck-share-label="' + escapeHtml(label) + '"><span class="ck-socialShare__icon" aria-hidden="true">' + socialShareIcon(icon) + '</span><span class="ck-socialShare__cardLabel">' + escapeHtml(label) + '</span></button>';
  }

  function renderCardGrid(cards) {
    return cards.map(function (card) { return shareCard(card[0], card[1], card[2]); }).join('');
  }

  function shareMarkup(args) {
    return '<div class="ck-socialShare" data-ck-social-share-root data-ck-share-anchor-id="' + escapeHtml(args.anchorId) + '" data-ck-widget-label="' + escapeHtml(args.widgetLabel) + '">' +
      '<div class="ck-socialShare__toast" role="status" aria-live="polite"></div>' +
      '<div class="ck-socialShare__topbar">' +
      '<details class="ck-socialShare__details">' +
      '<summary class="ck-socialShare__button"><span class="ck-socialShare__icon" aria-hidden="true">' + socialShareIcon('share') + '</span><span data-ck-share-copy-key="share">Share</span></summary>' +
      '<div class="ck-socialShare__menu" role="menu" aria-label="Share">' +
      '<div class="ck-socialShare__section" data-ck-social-share-section="message">' +
      '<div class="ck-socialShare__sectionTitle" data-ck-share-copy-key="sendSection">Send this widget as message</div>' +
      '<div class="ck-socialShare__grid" data-ck-social-share-grid="message"></div>' +
      '</div>' +
      '<div class="ck-socialShare__section" data-ck-social-share-section="social">' +
      '<div class="ck-socialShare__sectionTitle" data-ck-share-copy-key="socialSection">Share this widget on social</div>' +
      '<div class="ck-socialShare__grid" data-ck-social-share-grid="social"></div>' +
      '</div>' +
      '</div>' +
      '</details>' +
      '</div>' +
      '</div>';
  }

  function channelEnabled(socialShare, action) {
    var channels = socialShare && typeof socialShare === 'object' && socialShare.channels && typeof socialShare.channels === 'object'
      ? socialShare.channels
      : null;
    if (!channels || channels[action] == null) return true;
    if (typeof channels[action] !== 'boolean') {
      throw new Error('[CKSocialShare] state.behavior.socialShare.channels.' + action + ' must be a boolean');
    }
    return channels[action] === true;
  }

  function enabledCardsFor(socialShare, cards) {
    return cards.filter(function (card) {
      return channelEnabled(socialShare, card[0]);
    });
  }

  function cardSignature(messageCards, socialCards) {
    return messageCards.map(function (card) { return card[0]; }).join(',') + '|' + socialCards.map(function (card) { return card[0]; }).join(',');
  }

  function applyCards(shareRoot, messageCards, socialCards) {
    var nextSignature = cardSignature(messageCards, socialCards);
    if (shareRoot.getAttribute('data-ck-social-share-card-signature') === nextSignature) return;
    shareRoot.setAttribute('data-ck-social-share-card-signature', nextSignature);

    var messageSection = shareRoot.querySelector('[data-ck-social-share-section="message"]');
    var socialSection = shareRoot.querySelector('[data-ck-social-share-section="social"]');
    var messageGrid = shareRoot.querySelector('[data-ck-social-share-grid="message"]');
    var socialGrid = shareRoot.querySelector('[data-ck-social-share-grid="social"]');

    if (messageGrid instanceof HTMLElement) messageGrid.innerHTML = renderCardGrid(messageCards);
    if (socialGrid instanceof HTMLElement) socialGrid.innerHTML = renderCardGrid(socialCards);
    if (messageSection instanceof HTMLElement) messageSection.hidden = messageCards.length === 0;
    if (socialSection instanceof HTMLElement) socialSection.hidden = socialCards.length === 0;
  }

  function normalizeAnchorId(value) {
    return String(value || '').replace(/[^a-z0-9_-]+/gi, '-');
  }

  function ensureShareRoot(root, options) {
    var existing = shareRootForWidget(root);
    if (existing) {
      applyCards(existing, options.messageCards || [], options.socialCards || []);
      return existing;
    }

    var instanceId = String(options && options.instanceId || root.getAttribute('data-ck-instance-id') || '').trim();
    var widgetType = String(options && options.widgetType || root.getAttribute('data-ck-widget') || 'widget').trim();
    if (instanceId) root.setAttribute('data-ck-instance-id', instanceId);
    if (!root.id) {
      var idSource = instanceId || widgetType || 'widget';
      root.id = 'ck-instance-' + normalizeAnchorId(idSource);
    }

    var holder = document.createElement('div');
    holder.innerHTML = shareMarkup({
      anchorId: root.id,
      widgetLabel: String(options && options.widgetLabel || widgetType || 'widget')
    });
    var shareRoot = holder.firstElementChild;
    if (!(shareRoot instanceof HTMLElement)) return null;
    applyCards(shareRoot, options.messageCards || [], options.socialCards || []);
    root.appendChild(shareRoot);
    return shareRoot;
  }

  function applyShareRootContext(shareRoot, options) {
    if (!(shareRoot instanceof HTMLElement)) return;
    if (options && options.widgetLabel) {
      shareRoot.setAttribute('data-ck-widget-label', String(options.widgetLabel));
    }
    if (options && options.previewMode) {
      shareRoot.setAttribute('data-ck-preview', 'true');
    } else {
      shareRoot.removeAttribute('data-ck-preview');
    }
  }

  function removeShareRoot(root) {
    var shareRoot = shareRootForWidget(root);
    if (shareRoot) shareRoot.remove();
  }

  function resolveRuntimeContext(root) {
    var runtime = window.CKWidgetRuntime;
    if (!runtime || typeof runtime.contextFor !== 'function') return null;
    var widgetType = root.getAttribute('data-ck-widget') || '';
    if (!widgetType) return null;
    try {
      return runtime.contextFor(root, widgetType);
    } catch (_error) {
      return null;
    }
  }

  function applySocialShare(root, state, options) {
    if (!(root instanceof HTMLElement)) return;
    var behavior = state && typeof state === 'object' ? state.behavior : null;
    var socialShare = behavior && typeof behavior === 'object' ? behavior.socialShare : null;
    var enabled = socialShare && socialShare.enabled;
    if (enabled == null) {
      removeShareRoot(root);
      return;
    }
    if (typeof enabled !== 'boolean') {
      throw new Error('[CKSocialShare] state.behavior.socialShare.enabled must be a boolean');
    }
    if (!enabled) {
      removeShareRoot(root);
      return;
    }
    var messageCards = enabledCardsFor(socialShare, MESSAGE_CARDS);
    var socialCards = enabledCardsFor(socialShare, SOCIAL_CARDS);
    if (messageCards.length === 0 && socialCards.length === 0) {
      removeShareRoot(root);
      return;
    }
    var shareRoot = ensureShareRoot(root, Object.assign({}, options || {}, {
      messageCards: messageCards,
      socialCards: socialCards
    }));
    if (!shareRoot) return;
    applyShareRootContext(shareRoot, options || {});
    shareRoot.hidden = false;
    bindRoot(root);
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

    if (args.previewMode) {
      showToast(args.toast, args.copy.previewOnly);
      return;
    }

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
    if (!shareRoot) return;

    var instanceId = root.getAttribute('data-ck-instance-id') || '';
    var context = instanceId && window.CK_WIDGETS ? window.CK_WIDGETS[instanceId] : null;
    var copy = copyForLocale(context && context.locale);
    applyCopy(shareRoot, copy);

    if (shareRoot.getAttribute('data-ck-social-share-bound') === '1') return;
    shareRoot.setAttribute('data-ck-social-share-bound', '1');

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
          copy: copy,
          previewMode: shareRoot.getAttribute('data-ck-preview') === 'true'
        });
      } finally {
        close();
      }
    });
  }

  function bindAll() {
    document.querySelectorAll('[data-ck-widget][data-role="root"][data-ck-instance-id]').forEach(function (root) {
      if (!(root instanceof HTMLElement)) return;
      var context = resolveRuntimeContext(root);
      if (context && context.state) {
        applySocialShare(root, context.state, {
          instanceId: context.instanceId,
          widgetType: root.getAttribute('data-ck-widget') || '',
          widgetLabel: document.title || root.getAttribute('data-ck-widget') || 'widget'
        });
        return;
      }
      bindRoot(root);
    });
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type !== 'ck:state-update') return;
    var state = data.state;
    var widgetname = typeof data.widgetname === 'string' ? data.widgetname : '';
    var roots = widgetname
      ? document.querySelectorAll('[data-ck-widget="' + widgetname + '"][data-role="root"]')
      : document.querySelectorAll('[data-ck-widget][data-role="root"]');
    roots.forEach(function (root) {
      if (!(root instanceof HTMLElement)) return;
      var rootInstanceId = root.getAttribute('data-ck-instance-id') || '';
      if (rootInstanceId && data.instanceId && rootInstanceId !== data.instanceId) return;
      applySocialShare(root, state, {
        instanceId: data.instanceId,
        widgetType: widgetname || root.getAttribute('data-ck-widget') || '',
        widgetLabel: document.title || widgetname || root.getAttribute('data-ck-widget') || 'widget',
        previewMode: data.previewMode
      });
    });
  });

  window.CKSocialShare = Object.assign({}, window.CKSocialShare || {}, {
    apply: applySocialShare,
    bindAll: bindAll
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAll, { once: true });
  } else {
    bindAll();
  }
})();
