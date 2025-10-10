'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface ConfigState {
  title: string;
  successText: string;
  theme: 'light' | 'dark';
  fields: {
    name: boolean;
    email: boolean;
    message: boolean;
  };
}

const STORAGE_KEY = 'cf_cfg';

const defaultConfig: ConfigState = {
  title: 'Contact us',
  successText: 'Thanks! We\'ll get back to you soon.',
  theme: 'light',
  fields: {
    name: true,
    email: true,
    message: true,
  },
};

export default function Configurator() {
  const [config, setConfig] = useState<ConfigState>(defaultConfig);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [snippet, setSnippet] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [previewSrcDoc, setPreviewSrcDoc] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const encodeCfg = (cfg: ConfigState) => btoa(unescape(encodeURIComponent(JSON.stringify(cfg))));

  const previewHtml = (cfg: ConfigState) => `
     <!doctype html>
     <html>
       <head>
         <meta charset="utf-8" />
         <meta name="viewport" content="width=device-width,initial-scale=1" />
         <style>
           html,body{margin:0;padding:0;background:#f7f8fa;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;}
           #root{padding:12px}
           .err{font:12px/1.4 system-ui;color:#b00020;background:#fff3f3;border:1px solid #ffd7d7;border-radius:6px;padding:8px}
         </style>
       </head>
       <body>
         <div id="ckeen-DEMO"></div>
         <script>
           window.__CKEEN_PREVIEW__ = {
             config: ${JSON.stringify(cfg)},
             embedOrigin: 'https://c-keen-embed.vercel.app'
           };
         </script>
         <script async src="https://c-keen-embed.vercel.app/api/e/DEMO?v=1&cfg=${encodeCfg(cfg)}"></` + `script>
         <script>
           window.addEventListener('error', (e) => {
             const d=document.createElement('div');
             d.className='err';
             d.textContent='Preview error: ' + (e.message||'unknown');
             document.body.appendChild(d);
           });
         </script>
       </body>
     </html>`;

  // Load config from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig({ ...defaultConfig, ...parsed });
      } catch (e) {
        console.warn('Failed to parse saved config:', e);
      }
    }
  }, []);

  // Debounced preview srcDoc rebuild (external script via srcDoc)
  const rebuildPreview = useCallback((cfg: ConfigState) => {
    setIsUpdating(true);
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => {
      setPreviewSrcDoc(previewHtml(cfg));
      setIsUpdating(false);
    }, 250);
  }, []);

  // Save config and rebuild preview on changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    rebuildPreview(config);
  }, [config, rebuildPreview]);

  // No fallback needed with srcDoc

  const updateConfig = (updates: Partial<ConfigState>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const updateFields = (field: keyof ConfigState['fields'], value: boolean) => {
    setConfig(prev => ({
      ...prev,
      fields: { ...prev.fields, [field]: value }
    }));
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleGetSnippet = async () => {
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/widgets/anonymous', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          type: 'contact-form',
          config
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate snippet');
      }

      const data = await response.json();
      setPublicKey(data.publicKey);
      
      const snippetText = `<div id="ckeen-${data.publicKey}"></div>
<script async src="https://c-keen-embed.vercel.app/api/e/${data.publicKey}?v=1"></script>
<!-- Powered by Clickeen — remove with Pro -->`;
      
      setSnippet(snippetText);
      // Optionally show publicId hint in UI without changing layout
      console.log('PublicId for direct POST smoke:', data.publicId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate snippet');
    } finally {
      setIsLoading(false);
    }
  };

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy snippet:', err);
    }
  };

  // Using srcDoc-based preview; no external src URL required

  return (
    <div style={{ marginBottom: '48px' }}>
      <h2 style={{ fontSize: '1.8rem', marginBottom: '24px', color: '#1a1a1a' }}>
        Configure Your Widget
      </h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>
        {/* Configuration Panel */}
        <div style={{ display: 'grid', gap: '20px' }}>
          {/* Title */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              Form Title
            </label>
            <input
              type="text"
              value={config.title}
              onChange={(e) => updateConfig({ title: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e1e5e9',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Success Text */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              Success Message
            </label>
            <input
              type="text"
              value={config.successText}
              onChange={(e) => updateConfig({ successText: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e1e5e9',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Fields */}
          <div>
            <label style={{ display: 'block', marginBottom: '12px', fontSize: '14px', fontWeight: '500' }}>
              Form Fields
            </label>
            <div style={{ display: 'grid', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                <input
                  type="checkbox"
                  checked={config.fields.name}
                  onChange={(e) => updateFields('name', e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                Name field
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', opacity: 0.6 }}>
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  style={{ width: '16px', height: '16px' }}
                />
                Email field (always required)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                <input
                  type="checkbox"
                  checked={config.fields.message}
                  onChange={(e) => updateFields('message', e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                Message field
              </label>
            </div>
          </div>

          {/* Theme */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              Theme
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                <input
                  type="radio"
                  name="theme"
                  checked={config.theme === 'light'}
                  onChange={() => updateConfig({ theme: 'light' })}
                  style={{ width: '16px', height: '16px' }}
                />
                Light
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                <input
                  type="radio"
                  name="theme"
                  checked={config.theme === 'dark'}
                  onChange={() => updateConfig({ theme: 'dark' })}
                  style={{ width: '16px', height: '16px' }}
                />
                Dark
              </label>
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div style={{ position: 'relative' }}>
          <div style={{ 
            position: 'absolute', 
            top: '8px', 
            right: '8px', 
            backgroundColor: '#007bff', 
            color: 'white', 
            padding: '4px 8px', 
            borderRadius: '4px', 
            fontSize: '12px', 
            fontWeight: '500',
            zIndex: 10
          }}>
            Preview
          </div>
          {isUpdating && (
            <div style={{ 
              position: 'absolute', 
              top: '8px', 
              left: '8px', 
              backgroundColor: '#ffc107', 
              color: '#000', 
              padding: '4px 8px', 
              borderRadius: '4px', 
              fontSize: '12px', 
              fontWeight: '500',
              zIndex: 10
            }}>
              Updating...
            </div>
          )}
          <div style={{ 
            border: '1px solid #e1e5e9', 
            borderRadius: '8px', 
            padding: '24px',
            backgroundColor: config.theme === 'dark' ? '#1a1a1a' : '#f8f9fa',
            minHeight: '200px',
            position: 'relative'
          }}>
            <iframe
              ref={iframeRef}
              sandbox="allow-scripts allow-same-origin"
              srcDoc={previewSrcDoc}
              style={{
                width: '100%',
                height: '280px',
                border: 'none',
                borderRadius: '4px'
              }}
              title="Widget Preview"
            />
            <div style={{ marginTop: '8px' }}>
              <a href={`https://c-keen-embed.vercel.app/api/e/DEMO?v=1&cfg=${encodeCfg(config)}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#007bff' }}>
                Open preview in new tab
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Snippet Generation */}
      <div style={{ marginTop: '32px', padding: '24px', border: '1px solid #e1e5e9', borderRadius: '8px', backgroundColor: '#f8f9fa' }}>
        <h3 style={{ fontSize: '1.4rem', marginBottom: '16px', color: '#1a1a1a' }}>Get Your Snippet</h3>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              Your email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e1e5e9',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>
          <button
            onClick={handleGetSnippet}
            disabled={isLoading}
            style={{
              padding: '12px 24px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: isLoading ? 0.6 : 1
            }}
          >
            {isLoading ? 'Generating...' : 'Get Snippet'}
          </button>
        </div>

        {error && (
          <div style={{ color: '#dc3545', fontSize: '14px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {snippet && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '1.1rem', margin: 0, color: '#1a1a1a' }}>Your Snippet</h4>
              <button
                onClick={copySnippet}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500'
                }}
              >
                Copy
              </button>
            </div>
            <textarea
              readOnly
              value={snippet}
              style={{
                width: '100%',
                minHeight: '100px',
                fontFamily: 'monospace',
                fontSize: '14px',
                padding: '12px',
                border: '1px solid #e1e5e9',
                borderRadius: '8px',
                backgroundColor: '#fff',
                resize: 'vertical'
              }}
            />
            <p style={{ fontSize: '13px', color: '#666', marginTop: '8px', marginBottom: 0 }}>
              Free plan includes a small Powered by Clickeen badge.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
