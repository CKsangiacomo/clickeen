type NavLayout = 'desktop' | 'mobile';
type NavPanel = 'none' | 'mega' | 'mobile';

type NavState = {
  layout: NavLayout;
  panel: NavPanel;
  activeMegaId: string | null;
  engaged: boolean;
};

const EXIT_ANIMATION_MS = 140;
const MEGA_HOVER_CLOSE_DELAY_MS = 180;
const STUCK_SCROLL_PX = 8;

function computeLayout(): NavLayout {
  if (!window.matchMedia) return 'desktop';
  return window.matchMedia('(max-width: 900px)').matches ? 'mobile' : 'desktop';
}

function syncNavHeight(headerEl: HTMLElement) {
  const h = headerEl.getBoundingClientRect().height;
  document.documentElement.style.setProperty('--ck-nav-h', h ? `${h}px` : '0px');
}

function isHoverCapable() {
  return !!window.matchMedia && window.matchMedia('(hover: hover)').matches;
}

function setScrollLock(locked: boolean) {
  if (locked) {
    const prev = document.documentElement.style.overflow;
    document.documentElement.dataset.ckPrevOverflow = prev;
    document.documentElement.style.overflow = 'hidden';
  } else {
    const prev = document.documentElement.dataset.ckPrevOverflow;
    if (prev !== undefined) document.documentElement.style.overflow = prev;
    delete document.documentElement.dataset.ckPrevOverflow;
  }
}

export function initPragueSiteNav() {
  const headers = document.querySelectorAll<HTMLElement>('.ck-siteNavHeader');
  if (!headers.length) return;

  for (const header of headers) {
    if (header.dataset.ckNavBound === '1') continue;
    header.dataset.ckNavBound = '1';

    const megaLayer = header.querySelector<HTMLElement>('[data-ck-mega-layer]');
    const megaBackdrop = header.querySelector<HTMLElement>('[data-ck-mega-layer] .ck-megaLayer__backdrop');
    const megaCurtain = header.querySelector<HTMLElement>('[data-ck-mega-layer] .ck-megaLayer__curtain');
    const megaTriggers = Array.from(
      header.querySelectorAll<HTMLElement>('[data-ck-mega-trigger]'),
    );

    const mobileMenu = header.querySelector<HTMLElement>('[data-ck-mobile-menu]');
    const mobileTrigger = header.querySelector<HTMLElement>('[data-ck-nav-mobile-trigger]');
    const mobileBackdrop = header.querySelector<HTMLElement>('[data-ck-nav-mobile-close]');
    const mobilePanel = header.querySelector<HTMLElement>('.ck-mobileMenu__panel');

    if (!megaLayer) continue;

    // Allow curtain/backdrop to render; visibility controlled by data attrs.
    megaLayer.hidden = false;

    const state: NavState = {
      layout: computeLayout(),
      panel: 'none',
      activeMegaId: null,
      engaged: false,
    };

    let mobileExitTimer = 0;
    let mobileIsClosing = false;
    let megaCloseTimer = 0;

    const mqMobile = window.matchMedia ? window.matchMedia('(max-width: 900px)') : null;

    const updateAttrs = () => {
      header.setAttribute('data-nav-layout', state.layout);
      header.setAttribute('data-nav-panel', state.panel);
      header.setAttribute('data-nav-phase', state.panel === 'none' ? 'closed' : 'open');
      header.setAttribute('data-nav-engaged', state.engaged ? 'true' : 'false');
      const expanded = state.panel === 'mega';
      for (const trigger of megaTriggers) {
        trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      }
      if (mobileTrigger) mobileTrigger.setAttribute('aria-expanded', state.panel === 'mobile' ? 'true' : 'false');
    };

    const clearHoverTimers = () => {
      if (!megaCloseTimer) return;
      window.clearTimeout(megaCloseTimer);
      megaCloseTimer = 0;
    };

    const setEngaged = (engaged: boolean) => {
      if (state.engaged === engaged) return;
      state.engaged = engaged;
      updateAttrs();
    };

    const scheduleCloseMega = () => {
      clearHoverTimers();
      if (!isHoverCapable() || state.layout !== 'desktop') return;
      if (state.panel !== 'mega') return;
      megaCloseTimer = window.setTimeout(() => {
        closeMega();
      }, MEGA_HOVER_CLOSE_DELAY_MS);
    };

    const closeMega = () => {
      clearHoverTimers();
      state.panel = 'none';
      state.activeMegaId = null;
      setEngaged(false);
      onScroll();
    };

    const openMega = (id: string) => {
      if (state.panel === 'mobile') closeMobileImmediate();
      clearHoverTimers();
      state.activeMegaId = id;
      state.panel = 'mega';
      setEngaged(true);
      onScroll();
      syncNavHeight(header);
    };

    function closeMobileImmediate() {
      mobileIsClosing = false;
      if (mobileExitTimer) window.clearTimeout(mobileExitTimer);
      mobileExitTimer = 0;
      if (mobileMenu) mobileMenu.classList.remove('is-closing');
      setScrollLock(false);
      state.panel = 'none';
      state.activeMegaId = null;
      setEngaged(false);
      onScroll();
    }

    function closeMobileAnimated() {
      if (state.panel !== 'mobile') return closeMobileImmediate();
      if (mobileIsClosing) return;
      mobileIsClosing = true;
      if (mobileMenu) mobileMenu.classList.add('is-closing');
      mobileExitTimer = window.setTimeout(() => {
        if (mobileMenu) mobileMenu.classList.remove('is-closing');
        mobileIsClosing = false;
        closeMobileImmediate();
      }, EXIT_ANIMATION_MS);
    }

    function openMobile() {
      closeMega();
      if (mobileMenu) mobileMenu.classList.remove('is-closing');
      setScrollLock(true);
      state.panel = 'mobile';
      state.activeMegaId = null;
      setEngaged(true);
      onScroll();
      syncNavHeight(header);
    }

    const updateLayout = () => {
      const next = computeLayout();
      if (next === state.layout) return;
      state.layout = next;
      if (next === 'mobile') {
        closeMega();
      } else if (state.panel === 'mobile') {
        closeMobileImmediate();
      }
      updateAttrs();
      onScroll();
    };

    const onScroll = () => {
      const stuck = typeof window !== 'undefined' && window.scrollY > STUCK_SCROLL_PX;
      header.setAttribute('data-nav-stuck', stuck ? 'true' : 'false');
    };

    // Wire mega trigger interactions
    for (const trigger of megaTriggers) {
      const id = trigger.getAttribute('data-ck-mega-trigger') || 'widgets';

      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        const engaged = state.panel === 'mega';
        if (engaged) closeMega();
        else openMega(id);
      });

      trigger.addEventListener('pointerenter', () => {
        if (!isHoverCapable() || state.layout !== 'desktop') return;
        openMega(id);
      });
    }

    header.addEventListener('pointerenter', () => {
      if (!isHoverCapable() || state.layout !== 'desktop') return;
      clearHoverTimers();
      setEngaged(true);
    });

    header.addEventListener('pointerleave', () => {
      if (!isHoverCapable() || state.layout !== 'desktop') return;
      if (state.panel === 'mega') return scheduleCloseMega();
      setEngaged(false);
    });

    if (megaBackdrop) {
      megaBackdrop.addEventListener('click', (e) => {
        e.preventDefault();
        closeMega();
      });
    }

    if (megaCurtain) {
      megaCurtain.addEventListener('click', (e) => {
        const t = e.target;
        if (!(t instanceof Element)) return;
        if (t.closest('a')) closeMega();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (state.panel === 'mega') closeMega();
      if (state.panel === 'mobile') closeMobileAnimated();
    });

    // Keyboard engagement: keep header white while focus is inside nav.
    header.addEventListener('focusin', () => {
      setEngaged(true);
    });
    header.addEventListener('focusout', () => {
      // If a panel is open, keep engaged; otherwise release.
      if (state.panel !== 'none') return;
      setEngaged(false);
    });

    // Mobile wiring
    if (mobileTrigger) {
      mobileTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        if (state.panel === 'mobile') closeMobileAnimated();
        else openMobile();
      });
    }

    if (mobileBackdrop) {
      mobileBackdrop.addEventListener('click', (e) => {
        e.preventDefault();
        closeMobileAnimated();
      });
    }

    if (mobilePanel) {
      mobilePanel.addEventListener('click', (e) => {
        const t = e.target;
        if (!(t instanceof Element)) return;
        if (t.closest('a')) closeMobileImmediate();
      });
    }

    // Resize + scroll + height sync
    const syncHeight = () => syncNavHeight(header);
    syncHeight();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => syncHeight());
      ro.observe(header);
    } else {
      window.addEventListener('resize', syncHeight, { passive: true });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    if (mqMobile) mqMobile.addEventListener('change', () => updateLayout());

    updateAttrs();
    onScroll();
  }
}
