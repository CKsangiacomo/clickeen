import { mountShadow, beacon } from '@ck/embed-core';

interface WidgetConfig {
  title?: string;
  successText?: string;
  theme?: 'light' | 'dark';
  fields?: {
    name?: boolean;
    email?: boolean;
    message?: boolean;
  };
}

class ContactFormWidget {
  private host: HTMLElement;
  private config: WidgetConfig;
  private root: ShadowRoot | null = null;

  constructor(host: HTMLElement, config: WidgetConfig = {}) {
    this.host = host;
    this.config = this.validateConfig(config);
    this.mount();
  }

  private validateConfig(config: WidgetConfig): WidgetConfig {
    return {
      title: config.title || 'Contact us',
      successText: config.successText || 'Thanks! We received your message.',
      theme: config.theme || 'light',
      fields: {
        name: config.fields?.name !== false,
        email: true, // Always required
        message: config.fields?.message !== false,
        ...config.fields
      }
    };
  }

  private getLabels() {
    return {
      name: this.config.fields?.name ? 'Name' : '',
      email: 'Email',
      message: this.config.fields?.message ? 'Message' : '',
      submit: 'Send',
      success: this.config.successText || 'Thanks! We received your message.'
    };
  }

  private getCSS() {
    const isDark = this.config.theme === 'dark';
    return `
      :host{all:initial}
      *{font-family:ui-sans-serif,system-ui,-apple-system;box-sizing:border-box}
      .ck{display:grid;gap:10px;padding:16px;border-radius:10px;border:1px solid ${isDark ? '#444' : '#ddd'};background:${isDark ? '#1a1a1a' : '#fff'};color:${isDark ? '#fff' : '#000'}}
      input,textarea{padding:10px 12px;border:1px solid ${isDark ? '#555' : '#ccc'};border-radius:8px;background:${isDark ? '#2a2a2a' : '#fff'};color:${isDark ? '#fff' : '#000'}}
      button{padding:10px 14px;border-radius:8px;border:0;background:#2F80ED;color:#fff;cursor:pointer}
      label{display:block;margin-bottom:4px;font-weight:500}
    `;
  }

  private getHTML() {
    const L = this.getLabels();
    const title = this.config.title ? `<h3 style="margin:0 0 16px 0;font-size:1.2rem">${this.config.title}</h3>` : '';
    
    const fields = [];
    if (L.name) fields.push(`<label>${L.name}<input name="name" required/></label>`);
    if (L.email) fields.push(`<label>${L.email}<input type="email" name="email" required/></label>`);
    if (L.message) fields.push(`<label>${L.message}<textarea name="message" rows="4" required></textarea></label>`);
    
    return `
      <form class="ck" aria-label="Contact form">
        ${title}
        ${fields.join('')}
        <button type="submit">${L.submit}</button>
        <p id="ck-success" style="display:none">${L.success}</p>
      </form>
    `;
  }

  private mount(reuse = false) {
    if (reuse && this.root) {
      // Update existing shadow root
      const newHTML = this.getHTML();
      const newCSS = this.getCSS();
      
      // Update styles
      const styleEl = this.root.querySelector('style');
      if (styleEl) styleEl.textContent = newCSS;
      
      // Update content
      const wrap = this.root.querySelector('div');
      if (wrap) wrap.innerHTML = newHTML;
      
      // Re-attach event listeners
      this.attachEventListeners();
    } else {
      // Create new shadow root
      this.root = mountShadow(this.host, this.getHTML(), this.getCSS());
      this.attachEventListeners();
    }
  }

  private attachEventListeners() {
    if (!this.root) return;
    
    const form = this.root.querySelector('form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form as HTMLFormElement).entries());
      
      try {
        await fetch('/api/form/DEMO_PUBLIC_ID', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        const successEl = this.root?.getElementById('ck-success');
        if (successEl) successEl.style.display = 'block';
        
        beacon('submit', { ok: true });
      } catch (error) {
        console.error('Form submission failed:', error);
        beacon('submit', { ok: false, error: error.message });
      }
    });
    
    beacon('impression', {});
  }

  update(newConfig: WidgetConfig) {
    this.config = this.validateConfig({ ...this.config, ...newConfig });
    this.mount(true);
  }
}

export function renderContactForm(host: HTMLElement, config: WidgetConfig = {}) {
  return new ContactFormWidget(host, config);
}
